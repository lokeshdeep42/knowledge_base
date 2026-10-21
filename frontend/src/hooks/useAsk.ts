import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage, isAbort } from "../api/client";
import type { QueryResponse } from "../api/types";

export type AskState =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "success"; question: string; result: QueryResponse }
  | { status: "error"; question: string; error: string };

export interface UseAsk {
  state: AskState;
  ask: (question: string, topK?: number) => Promise<void>;
  reset: () => void;
}

export function useAsk(): UseAsk {
  const [state, setState] = useState<AskState>({ status: "idle" });
  const inflight = useRef<AbortController | null>(null);

  // Cancel any pending request on unmount.
  useEffect(() => () => inflight.current?.abort(), []);

  const ask = useCallback(async (question: string, topK?: number) => {
    const q = question.trim();
    if (!q) return;

    // A newer question supersedes an older one.
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;

    setState({ status: "loading", question: q });
    try {
      const result = await api.query(
        topK === undefined ? { question: q } : { question: q, top_k: topK },
        controller.signal,
      );
      setState({ status: "success", question: q, result });
    } catch (err) {
      if (isAbort(err)) return;
      setState({ status: "error", question: q, error: errorMessage(err) });
    } finally {
      if (inflight.current === controller) inflight.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    inflight.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, ask, reset };
}
