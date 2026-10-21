import type { Source } from "../api/types";
import { SourceCard } from "./SourceCard";

interface Props {
  sources: Source[];
  linkedCitation: number | null;
  registerCard: (citation: number, el: HTMLElement | null) => void;
}

export function SourceList({ sources, linkedCitation, registerCard }: Props) {
  return (
    <section aria-labelledby="sources-heading">
      <h3
        id="sources-heading"
        className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold tracking-wide text-stone-500 uppercase"
      >
        Sources
        <span className="font-mono text-xs font-normal tracking-normal normal-case">
          {sources.length}
        </span>
      </h3>
      <ol className="space-y-2">
        {sources.map((s) => (
          <li key={`${s.citation}-${s.item_id}`}>
            <SourceCard
              ref={(el) => registerCard(s.citation, el)}
              source={s}
              linked={linkedCitation === s.citation}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
