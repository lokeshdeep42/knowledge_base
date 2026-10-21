import { useCallback, useRef, useState } from "react";
import { Info, SearchX, Sparkles } from "lucide-react";
import type { QueryResponse } from "../api/types";
import { AnswerView } from "./AnswerView";
import { EmptyState } from "./EmptyState";
import { SourceList } from "./SourceList";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  question: string;
  result: QueryResponse;
  itemCount: number;
}

/** One answered question: the answer (or a notice) followed by its sources. */
export function AskResult({ question, result, itemCount }: Props) {
  const { answer, llm_configured, sources } = result;
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const cards = useRef(new Map<number, HTMLElement>());

  const registerCard = useCallback((n: number, el: HTMLElement | null) => {
    if (el) cards.current.set(n, el);
    else cards.current.delete(n);
  }, []);

  const jumpToSource = useCallback((n: number) => {
    const el = cards.current.get(n);
    if (!el) return;
    const reduce = prefersReducedMotion();
    setSelected(n);
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    el.focus({ preventScroll: true });
    if (!reduce) {
      el.animate(
        [
          { boxShadow: "0 0 0 4px var(--color-accent-line)" },
          { boxShadow: "0 0 0 0 transparent" },
        ],
        { duration: 1400, easing: "ease-out" },
      );
    }
  }, []);

  const linked = hovered ?? selected;

  // State 3: nothing retrieved.
  if (sources.length === 0 && !answer) {
    return (
      <EmptyState
        icon={<SearchX aria-hidden className="size-4" />}
        title="Nothing relevant found in your inbox."
        hint={
          itemCount === 0
            ? "Your inbox is empty. Save a note or a link first, then ask again."
            : "Try different wording, or save more sources on this topic."
        }
      />
    );
  }

  return (
    <div className="space-y-5 motion-safe:animate-fade-in">
      {answer ? (
        // State 1: a written answer.
        <section
          aria-labelledby="answer-heading"
          className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <Sparkles aria-hidden className="size-3.5 text-accent" />
            <h3 id="answer-heading" className="text-[13px] font-semibold text-stone-500">
              Answer
            </h3>
          </div>
          <p className="mb-3 text-sm font-medium text-stone-900">{question}</p>
          <AnswerView
            answer={answer}
            sources={sources}
            activeCitation={linked}
            onSelectCitation={jumpToSource}
            onHoverCitation={setHovered}
          />
        </section>
      ) : (
        // State 2: retrieval only (no LLM, or no answer generated).
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-stone-200 bg-stone-100/70 px-3.5 py-3 text-sm text-stone-700"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-stone-500" />
          <p>
            {llm_configured
              ? "No answer was generated for this question. Showing the most relevant snippets."
              : "No LLM configured (set OPENAI_API_KEY on the server). Showing the most relevant snippets."}
          </p>
        </div>
      )}

      {sources.length > 0 && (
        <SourceList sources={sources} linkedCitation={linked} registerCard={registerCard} />
      )}
    </div>
  );
}
