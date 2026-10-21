import type { HealthState } from "../hooks/useHealth";

interface Props {
  health: HealthState;
  onRecheck: () => void;
}

export function StatusBadge({ health, onRecheck }: Props) {
  let dot = "bg-stone-300";
  let label = "Checking server";
  let title = "Checking the backend status";

  if (health.status === "offline") {
    dot = "bg-red-500";
    label = "Server offline";
    title = "Couldn't reach the backend. Click to check again.";
  } else if (health.status === "ok") {
    if (health.health.llm_configured) {
      dot = "bg-emerald-500";
      label = "LLM connected";
      title = "Answers are written by the LLM from your saved sources";
    } else {
      dot = "bg-amber-500";
      label = "Retrieval only";
      title = "No LLM configured on the server: questions return the most relevant snippets";
    }
  }

  return (
    <button
      type="button"
      onClick={onRecheck}
      title={title}
      aria-label={`${label}. Check again`}
      className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:border-stone-300 hover:text-stone-900"
    >
      <span
        aria-hidden
        className={`size-1.5 rounded-full ${dot} ${health.status === "checking" ? "motion-safe:animate-pulse" : ""}`}
      />
      {label}
    </button>
  );
}
