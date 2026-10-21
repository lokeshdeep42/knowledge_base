import threading

import numpy as np

from app.repository import ChunkMeta


def normalize(vectors: np.ndarray) -> np.ndarray:
    """L2-normalise rows so a dot product equals cosine similarity."""
    vectors = np.atleast_2d(vectors).astype(np.float32)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.where(norms == 0, 1, norms)


class VectorIndex:
    """In-memory brute-force cosine index; plenty for thousands of chunks."""

    def __init__(self) -> None:
        self._matrix: np.ndarray | None = None
        self._metas: list[ChunkMeta] = []
        self._lock = threading.Lock()

    def __len__(self) -> int:
        return len(self._metas)

    def add(self, metas: list[ChunkMeta], embeddings: np.ndarray) -> None:
        if not metas:
            return
        vectors = normalize(embeddings)
        with self._lock:
            self._matrix = vectors if self._matrix is None else np.vstack([self._matrix, vectors])
            self._metas = [*self._metas, *metas]

    def search(self, query: np.ndarray, top_k: int) -> list[tuple[ChunkMeta, float]]:
        with self._lock:
            matrix, metas = self._matrix, self._metas
        if matrix is None:
            return []
        scores = matrix @ normalize(query)[0]
        best = np.argsort(scores)[::-1][:top_k]
        return [(metas[i], float(scores[i])) for i in best]
