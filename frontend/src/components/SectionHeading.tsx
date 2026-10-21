import type { ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  meta?: ReactNode;
}

export function SectionHeading({ id, title, meta }: Props) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[13px] font-semibold tracking-wide text-stone-500 uppercase">
        {title}
      </h2>
      {meta && <span className="font-mono text-xs text-stone-500">{meta}</span>}
    </div>
  );
}
