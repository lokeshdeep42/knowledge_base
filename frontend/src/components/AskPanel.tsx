import { useId, useState, type FormEvent } from "react";
import { ArrowUp, MessageSquareText } from "lucide-react";
import { useAsk } from "../hooks/useAsk";
import { primaryButtonClass } from "../lib/styles";
import { AskResult } from "./AskResult";
import { EmptyState } from "./EmptyState";
import { ErrorBanner } from "./ErrorBanner";
import { Spinner } from "./Spinner";

function AnswerSkeleton() {
  return (
    <div
      className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5"
      aria-busy="true"
      aria-label="Searching your inbox"
    >
      <div className="space-y-2.5 motion-safe:animate-pulse">
        <div className="h-3 w-24 rounded bg-stone-200" />
        <div className="h-3.5 w-full rounded bg-stone-100" />
        <div className="h-3.5 w-11/12 rounded bg-stone-100" />
        <div className="h-3.5 w-3/5 rounded bg-stone-100" />
      </div>
    </div>
  );
}

export function AskPanel({ itemCount }: { itemCount: number }) {
  const uid = useId();
  const { state, ask } = useAsk();
  const [question, setQuestion] = useState("");

  const loading = state.status === "loading";
  const canAsk = question.trim() !== "" && !loading;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (canAsk) void ask(question);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={submit} aria-label="Ask a question">
        <label htmlFor={`${uid}-q`} className="sr-only">
          Question
        </label>
        <div className="rounded-xl border border-stone-200 bg-white transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-line hover:border-stone-300 focus-within:hover:border-accent">
          <textarea
            id={`${uid}-q`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Ask something about what you've saved…"
            aria-describedby={`${uid}-hint`}
            className="block max-h-48 min-h-16 w-full resize-none bg-transparent px-3.5 pt-3 text-[15px] leading-relaxed text-stone-900 [field-sizing:content] placeholder:text-stone-400 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3 px-3.5 pt-1 pb-2.5">
            <p id={`${uid}-hint`} className="text-xs text-stone-500">
              <kbd className="font-mono">Enter</kbd> to ask ·{" "}
              <kbd className="font-mono">Shift+Enter</kbd> for a new line
            </p>
            <button type="submit" disabled={!canAsk} className={`${primaryButtonClass} shrink-0`}>
              {loading ? (
                <Spinner className="size-3.5" />
              ) : (
                <ArrowUp aria-hidden className="size-3.5" />
              )}
              {loading ? "Asking" : "Ask"}
            </button>
          </div>
        </div>
      </form>

      <div aria-live="polite">
        {state.status === "idle" && (
          <EmptyState
            icon={<MessageSquareText aria-hidden className="size-4" />}
            title="Ask a question about your inbox"
            hint={
              itemCount === 0
                ? "Save a note or link first. Answers cite the sources they draw on."
                : "Answers cite the saved sources they draw on."
            }
          />
        )}
        {state.status === "loading" && <AnswerSkeleton />}
        {state.status === "error" && (
          <ErrorBanner message={state.error} onRetry={() => void ask(state.question)} />
        )}
        {state.status === "success" && (
          // Keyed so citation highlight state resets for each new question.
          <AskResult
            key={state.question}
            question={state.question}
            result={state.result}
            itemCount={itemCount}
          />
        )}
      </div>
    </div>
  );
}
