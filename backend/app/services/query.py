import logging
import time

from starlette.concurrency import run_in_threadpool

from app.schemas import QueryResponse, Source
from app.services.embeddings import Embedder
from app.services.llm import AnswerGenerator
from app.vector_index import VectorIndex

logger = logging.getLogger(__name__)


class QueryService:
    def __init__(
        self,
        index: VectorIndex,
        embedder: Embedder,
        generator: AnswerGenerator | None,
        min_score: float,
    ) -> None:
        self._index = index
        self._embedder = embedder
        self._generator = generator
        self._min_score = min_score

    @property
    def llm_configured(self) -> bool:
        return self._generator is not None

    async def answer(self, question: str, top_k: int) -> QueryResponse:
        started = time.perf_counter()
        sources = await self._retrieve(question, top_k)
        answer = None
        if sources and self._generator:
            answer = await self._generator.generate(question, sources)
        logger.info(
            "query",
            extra={
                "top_k": top_k,
                "hits": len(sources),
                "llm_used": answer is not None,
                "duration_ms": round((time.perf_counter() - started) * 1000, 1),
            },
        )
        return QueryResponse(answer=answer, llm_configured=self.llm_configured, sources=sources)

    async def _retrieve(self, question: str, top_k: int) -> list[Source]:
        if len(self._index) == 0:
            return []
        query_vector = await run_in_threadpool(self._embedder.embed, [question])
        hits = [(meta, score) for meta, score in self._index.search(query_vector, top_k) if score >= self._min_score]
        return [
            Source(
                citation=number,
                item_id=meta.item_id,
                title=meta.title,
                source_type=meta.source_type,
                url=meta.url,
                snippet=meta.text,
                score=round(score, 3),
            )
            for number, (meta, score) in enumerate(hits, start=1)
        ]
