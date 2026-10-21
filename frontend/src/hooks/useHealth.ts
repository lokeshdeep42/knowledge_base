import { useCallback, useEffect, useState } from "react";
import { api, isAbort } from "../api/client";
import type { HealthResponse } from "../api/types";

export type HealthState =
  | { status: "checking" }
  | { status: "ok"; health: HealthResponse }
  | { status: "offline" };

export function useHealth(): { health: HealthState; recheck: () => void } {
  const [health, setHealth] = useState<HealthState>({ status: "checking" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .health(controller.signal)
      .then((h) => setHealth({ status: "ok", health: h }))
      .catch((err) => {
        if (!isAbort(err)) setHealth({ status: "offline" });
      });
    return () => controller.abort();
  }, [attempt]);

  const recheck = useCallback(() => {
    setHealth({ status: "checking" });
    setAttempt((n) => n + 1);
  }, []);

  return { health, recheck };
}
