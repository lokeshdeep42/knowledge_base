import type {
  ApiErrorBody,
  HealthResponse,
  IngestRequest,
  Item,
  ItemsResponse,
  QueryRequest,
  QueryResponse,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/+$/, "");

/** A failed API call. `message` is always safe to show to the user. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const err = (value as { error: unknown }).error;
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { message?: unknown }).message === "string"
  );
}

/** Fallback for errors that don't use the envelope (e.g. a framework default 422 or a proxy 504). */
function fallbackMessage(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: unknown };
      if (typeof first?.msg === "string") return first.msg;
    }
  }
  // A 5xx without our error envelope means the backend never answered
  // (e.g. the dev proxy returns a bare 500 when nothing listens on :8000).
  if (status >= 500) {
    return "The server is unavailable. Check that the backend is running on port 8000.";
  }
  return `Request failed (HTTP ${status}).`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(
      "network_error",
      "Can't reach the server. Check that the backend is running on port 8000.",
      0,
    );
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    if (isErrorBody(body)) {
      throw new ApiError(body.error.code, body.error.message, res.status);
    }
    throw new ApiError(`http_${res.status}`, fallbackMessage(body, res.status), res.status);
  }

  if (body === null) {
    throw new ApiError("invalid_response", "The server sent an unreadable response.", res.status);
  }
  return body as T;
}

export const api = {
  health(signal?: AbortSignal): Promise<HealthResponse> {
    return request<HealthResponse>("/health", { signal });
  },

  listItems(signal?: AbortSignal): Promise<Item[]> {
    return request<ItemsResponse>("/items", { signal }).then((r) => r.items);
  },

  ingest(payload: IngestRequest, signal?: AbortSignal): Promise<Item> {
    return request<Item>("/ingest", {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    });
  },

  query(payload: QueryRequest, signal?: AbortSignal): Promise<QueryResponse> {
    return request<QueryResponse>("/query", {
      method: "POST",
      body: JSON.stringify(payload),
      signal,
    });
  },
};

/** Turn anything thrown into a user-facing message. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong.";
}

export function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
