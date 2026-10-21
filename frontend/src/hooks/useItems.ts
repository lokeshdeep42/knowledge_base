import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, isAbort } from "../api/client";
import type { IngestRequest, Item } from "../api/types";

export interface UseItems {
  items: Item[];
  loading: boolean;
  /** Error from loading the list (not from adding). */
  error: string | null;
  refresh: () => Promise<void>;
  /** Saves an item and puts it at the top of the list. Throws ApiError on failure. */
  addItem: (payload: IngestRequest) => Promise<Item>;
}

export function useItems(): UseItems {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const list = await api.listItems(signal);
      setItems(list);
      setError(null);
    } catch (err) {
      if (isAbort(err)) return;
      setError(errorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const addItem = useCallback(async (payload: IngestRequest) => {
    const item = await api.ingest(payload);
    // Show it immediately; drop any stale copy with the same id.
    setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
    return item;
  }, []);

  const refresh = useCallback(() => load(), [load]);

  return { items, loading, error, refresh, addItem };
}
