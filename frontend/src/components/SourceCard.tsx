import { forwardRef, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import type { Source } from "../api/types";
import { hostOf } from "../lib/format";

const LONG_SNIPPET = 220;

function RelevanceMeter({ score }: { score: number }) {
  const value = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0));
  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      title={`Relevance ${value.toFixed(2)} (0 to 1)`}
    >
      <div
        role="meter"
        aria-label="Relevance"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(value.toFixed(2))}
        className="h-1 w-10 overflow-hidden rounded-full bg-stone-200"
      >
        <div className="h-full rounded-full bg-accent/70" style={{ width: `${value * 100}%` }} />
      </div>
      <span className="font-mono text-[11px] text-stone-500 tabular-nums">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

interface Props {
  source: Source;
  /** True while the matching citation chip is hovered or focused. */
  linked: boolean;
}

export const SourceCard = forwardRef<HTMLElement, Props>(function SourceCard(
  { source, linked },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const isLong = source.snippet.length > LONG_SNIPPET;
  const snippetId = `source-${source.citation}-snippet`;

  return (
    <article
      ref={ref}
      id={`source-${source.citation}`}
      tabIndex={-1}
      aria-label={`Source ${source.citation}: ${source.title}`}
      className={`scroll-mt-20 rounded-xl border bg-white px-3.5 py-3 transition-colors focus:outline-none ${
        linked ? "border-accent" : "border-stone-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-px grid size-5 shrink-0 place-items-center rounded font-mono text-[11px] font-medium transition-colors ${
            linked ? "bg-accent text-white" : "bg-stone-100 text-stone-600"
          }`}
        >
          {source.citation}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-medium text-stone-900" title={source.title}>
                {source.title || "Untitled"}
              </h4>
              {source.source_type === "url" && source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex max-w-full items-center gap-1 text-xs text-stone-500 hover:text-accent hover:underline"
                  title={source.url}
                >
                  <span className="truncate">{hostOf(source.url)}</span>
                  <ExternalLink aria-hidden className="size-3 shrink-0" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                  <FileText aria-hidden className="size-3" />
                  Note
                </span>
              )}
            </div>
            <RelevanceMeter score={source.score} />
          </div>

          <p
            id={snippetId}
            className={`mt-2 text-[13px] leading-relaxed whitespace-pre-line text-stone-600 ${
              expanded ? "" : "line-clamp-3"
            }`}
          >
            {source.snippet.replace(/\n\s*\n/g, "\n")}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={snippetId}
              className="mt-1 rounded text-xs font-medium text-stone-500 hover:text-stone-900"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
});
