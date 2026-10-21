"""Paragraph-aware text chunking.

Splitting on paragraph, then sentence, boundaries keeps semantic units intact.
Small chunks (~800 chars) make retrieval precise and citations easy to verify.
A short overlap between neighbouring chunks preserves context across boundaries.
"""

import re

MAX_CHARS = 800
OVERLAP_CHARS = 100

_PARAGRAPH_BREAK = re.compile(r"\n\s*\n")
_SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+")


def _hard_split(text: str, max_chars: int) -> list[str]:
    return [text[i : i + max_chars] for i in range(0, len(text), max_chars)]


def _split_oversized(paragraph: str, max_chars: int) -> list[str]:
    """Break a long paragraph on sentence boundaries, hard-splitting giant sentences."""
    pieces: list[str] = []
    for sentence in _SENTENCE_BREAK.split(paragraph):
        pieces.extend([sentence] if len(sentence) <= max_chars else _hard_split(sentence, max_chars))
    return _pack(pieces, max_chars, " ")


def _pack(pieces: list[str], max_chars: int, separator: str) -> list[str]:
    """Greedily join consecutive pieces while the result stays within max_chars."""
    packed: list[str] = []
    current = ""
    for piece in pieces:
        if current and len(current) + len(separator) + len(piece) <= max_chars:
            current += separator + piece
        else:
            if current:
                packed.append(current)
            current = piece
    if current:
        packed.append(current)
    return packed


def _overlap_tail(chunk: str, overlap: int) -> str:
    """Last `overlap` characters of a chunk, trimmed to start on a word boundary."""
    tail = chunk[-overlap:]
    if len(chunk) > overlap and not chunk[-overlap - 1].isspace():
        _, _, tail = tail.partition(" ")
    return tail.strip()


def chunk_text(text: str, max_chars: int = MAX_CHARS, overlap: int = OVERLAP_CHARS) -> list[str]:
    """Split text into chunks of about max_chars, each prefixed with the previous chunk's tail."""
    paragraphs = [p.strip() for p in _PARAGRAPH_BREAK.split(text) if p.strip()]
    pieces: list[str] = []
    for paragraph in paragraphs:
        pieces.extend([paragraph] if len(paragraph) <= max_chars else _split_oversized(paragraph, max_chars))
    chunks = _pack(pieces, max_chars, "\n\n")
    if overlap <= 0 or not chunks:
        return chunks
    overlapped = (f"{_overlap_tail(prev, overlap)}\n{cur}" for prev, cur in zip(chunks, chunks[1:]))
    return [chunks[0], *overlapped]
