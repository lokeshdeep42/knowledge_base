import logging
import time

from starlette.concurrency import run_in_threadpool

from app.errors import EmptyContentError
from app.repository import ChunkMeta, Repository
from app.schemas import IngestRequest, Item, NoteIngest
from app.services.chunking import chunk_text
from app.services.embeddings import Embedder
from app.services.fetcher import UrlFetcher
from app.vector_index import VectorIndex, normalize

logger = logging.getLogger(__name__)

NOTE_TITLE_CHARS = 80


def _note_title(note: NoteIngest) -> str:
    if note.title:
        return note.title
    first_line = note.content.splitlines()[0].strip()
    return first_line[:NOTE_TITLE_CHARS]


class IngestService:
    def __init__(
        self, repository: Repository, index: VectorIndex, embedder: Embedder, fetcher: UrlFetcher
    ) -> None:
        self._repository = repository
        self._index = index
        self._embedder = embedder
        self._fetcher = fetcher

    async def ingest(self, request: IngestRequest) -> Item:
        started = time.perf_counter()
        if isinstance(request, NoteIngest):
            title, url, content = _note_title(request), None, request.content
        else:
            page = await self._fetcher.fetch(request.url)
            title, url, content = page.title, request.url, page.text

        chunks = chunk_text(content)
        if not chunks:
            raise EmptyContentError("There is no text to index.")
        embeddings = normalize(await run_in_threadpool(self._embedder.embed, chunks))

        item = self._repository.add_item(
            source_type=request.type,
            title=title,
            url=url,
            content=content,
            chunks=chunks,
            embeddings=embeddings,
        )
        metas = [ChunkMeta(item.id, title, item.source_type, url, text) for text in chunks]
        self._index.add(metas, embeddings)
        logger.info(
            "item_ingested",
            extra={
                "item_id": item.id,
                "source_type": item.source_type,
                "chunks": len(chunks),
                "duration_ms": round((time.perf_counter() - started) * 1000, 1),
            },
        )
        return item
