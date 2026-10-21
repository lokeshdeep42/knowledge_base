import { Fragment, useMemo } from "react";
import type { Source } from "../api/types";
import { parseCitations, splitParagraphs } from "../lib/citations";
import { CitationChip } from "./CitationChip";

interface Props {
  answer: string;
  sources: Source[];
  activeCitation: number | null;
  onSelectCitation: (n: number) => void;
  onHoverCitation: (n: number | null) => void;
}

export function AnswerView({
  answer,
  sources,
  activeCitation,
  onSelectCitation,
  onHoverCitation,
}: Props) {
  const titles = useMemo(() => new Map(sources.map((s) => [s.citation, s.title])), [sources]);
  const paragraphs = useMemo(() => {
    const known = new Set(titles.keys());
    return splitParagraphs(answer).map((p) => parseCitations(p, known));
  }, [answer, titles]);

  return (
    <div className="space-y-3 text-[15px] leading-7 text-stone-800">
      {paragraphs.map((segments, pi) => (
        <p key={pi} className="whitespace-pre-line">
          {segments.map((seg, si) =>
            seg.kind === "text" ? (
              <Fragment key={si}>{seg.text}</Fragment>
            ) : (
              <span key={si} className="whitespace-nowrap">
                {seg.numbers.map((n, ni) => (
                  <CitationChip
                    key={`${n}-${ni}`}
                    n={n}
                    sourceTitle={titles.get(n)}
                    active={activeCitation === n}
                    onSelect={onSelectCitation}
                    onHover={onHoverCitation}
                  />
                ))}
              </span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
