// Types mirroring the backend API contract.

export type SourceType = "note" | "url";

export interface Item {
  id: string;
  source_type: SourceType;
  title: string;
  url: string | null;
  preview: string;
  chunk_count: number;
  /** ISO 8601 timestamp */
  created_at: string;
}

export interface ItemsResponse {
  items: Item[];
}

export type IngestRequest =
  | { type: "note"; content: string; title?: string }
  | { type: "url"; url: string };

export interface QueryRequest {
  question: string;
  top_k?: number;
}

export interface Source {
  /** 1-based; matches the [n] markers in the answer text */
  citation: number;
  item_id: string;
  title: string;
  source_type: SourceType;
  url: string | null;
  snippet: string;
  /** relevance, 0..1 */
  score: number;
}

export interface QueryResponse {
  answer: string | null;
  llm_configured: boolean;
  sources: Source[];
}

export interface HealthResponse {
  status: "ok";
  llm_configured: boolean;
  items: number;
}

/** Error envelope returned by every failing endpoint. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}
