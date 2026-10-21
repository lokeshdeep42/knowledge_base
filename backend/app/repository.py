import sqlite3
import threading
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

import numpy as np

from app.schemas import Item, SourceType

PREVIEW_CHARS = 240

_ITEM_SELECT = """
SELECT i.id, i.source_type, i.title, i.url, i.created_at,
       substr(i.content, 1, 1000) AS head,
       (SELECT COUNT(*) FROM chunks c WHERE c.item_id = i.id) AS chunk_count
FROM items i
"""


@dataclass(frozen=True)
class ChunkMeta:
    """Everything the query path needs to cite a chunk."""

    item_id: str
    title: str
    source_type: SourceType
    url: str | None
    text: str


def _to_item(row: sqlite3.Row) -> Item:
    return Item(
        id=row["id"],
        source_type=row["source_type"],
        title=row["title"],
        url=row["url"],
        preview=" ".join(row["head"].split())[:PREVIEW_CHARS],
        chunk_count=row["chunk_count"],
        created_at=row["created_at"],
    )


class Repository:
    """SQLite persistence for items and their embedded chunks."""

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._lock = threading.Lock()

    def add_item(
        self,
        *,
        source_type: SourceType,
        title: str,
        url: str | None,
        content: str,
        chunks: list[str],
        embeddings: np.ndarray,
    ) -> Item:
        item_id = str(uuid.uuid4())
        created_at = datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        vectors = embeddings.astype(np.float32)
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO items (id, source_type, title, url, content, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (item_id, source_type, title, url, content, created_at),
            )
            self._conn.executemany(
                "INSERT INTO chunks (item_id, idx, text, embedding) VALUES (?, ?, ?, ?)",
                [(item_id, i, text, vec.tobytes()) for i, (text, vec) in enumerate(zip(chunks, vectors))],
            )
        return self.get_item(item_id)

    def get_item(self, item_id: str) -> Item:
        with self._lock:
            row = self._conn.execute(_ITEM_SELECT + " WHERE i.id = ?", (item_id,)).fetchone()
        return _to_item(row)

    def list_items(self) -> list[Item]:
        with self._lock:
            rows = self._conn.execute(
                _ITEM_SELECT + " ORDER BY i.created_at DESC, i.rowid DESC"
            ).fetchall()
        return [_to_item(row) for row in rows]

    def count_items(self) -> int:
        with self._lock:
            return self._conn.execute("SELECT COUNT(*) FROM items").fetchone()[0]

    def load_chunks(self) -> list[tuple[ChunkMeta, np.ndarray]]:
        """All stored chunks with their embeddings, used to rebuild the vector index."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT i.id, i.title, i.source_type, i.url, c.text, c.embedding "
                "FROM chunks c JOIN items i ON i.id = c.item_id ORDER BY i.rowid, c.idx"
            ).fetchall()
        return [
            (
                ChunkMeta(r["id"], r["title"], r["source_type"], r["url"], r["text"]),
                np.frombuffer(r["embedding"], dtype=np.float32),
            )
            for r in rows
        ]
