interface Props {
  n: number;
  sourceTitle?: string;
  active: boolean;
  onSelect: (n: number) => void;
  onHover: (n: number | null) => void;
}

/** Inline [n] marker in an answer. Clicking it jumps to the matching source card. */
export function CitationChip({ n, sourceTitle, active, onSelect, onHover }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(n)}
      onMouseEnter={() => onHover(n)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(n)}
      onBlur={() => onHover(null)}
      aria-label={sourceTitle ? `Source ${n}: ${sourceTitle}` : `Source ${n}`}
      title={sourceTitle}
      className={`relative -top-px mx-px inline-flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded px-1 align-middle font-mono text-[11px] leading-none font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "bg-accent-soft text-accent ring-1 ring-accent-line ring-inset hover:bg-accent hover:text-white"
      }`}
    >
      {n}
    </button>
  );
}
