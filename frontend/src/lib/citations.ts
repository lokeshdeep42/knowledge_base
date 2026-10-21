export type AnswerSegment =
  | { kind: "text"; text: string }
  | { kind: "cite"; numbers: number[] };

// Matches [1], [1, 2], [1,2,3]. Adjacent markers like [1][2] match separately.
const CITATION = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

/**
 * Splits answer text into plain text and citation groups.
 * Only numbers present in `known` become citations; anything else stays literal text.
 */
export function parseCitations(text: string, known: ReadonlySet<number>): AnswerSegment[] {
  const out: AnswerSegment[] = [];
  let last = 0;

  const pushText = (t: string) => {
    if (!t) return;
    const prev = out[out.length - 1];
    if (prev?.kind === "text") prev.text += t;
    else out.push({ kind: "text", text: t });
  };

  for (const match of text.matchAll(CITATION)) {
    const start = match.index ?? 0;
    const numbers = match[1].split(",").map((n) => Number(n.trim()));
    pushText(text.slice(last, start));
    if (numbers.every((n) => known.has(n))) {
      out.push({ kind: "cite", numbers });
    } else {
      pushText(match[0]);
    }
    last = start + match[0].length;
  }
  pushText(text.slice(last));
  return out;
}

/** Paragraphs separated by blank lines; single newlines are kept inside a paragraph. */
export function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
