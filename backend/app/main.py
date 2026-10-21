from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import Settings, get_settings
from app.db import connect
from app.errors import register_error_handlers
from app.logging_config import configure_logging
from app.middleware import request_logging_middleware
from app.repository import Repository
from app.services.embeddings import Embedder, FastEmbedEmbedder
from app.services.fetcher import HttpUrlFetcher, UrlFetcher
from app.services.ingest import IngestService
from app.services.llm import AnswerGenerator, build_answer_generator
from app.services.query import QueryService
from app.vector_index import VectorIndex


def create_app(
    settings: Settings | None = None,
    *,
    embedder: Embedder | None = None,
    generator: AnswerGenerator | None = None,
    fetcher: UrlFetcher | None = None,
) -> FastAPI:
    """Build the app; collaborators can be injected (tests) or default from settings."""
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        conn = connect(settings.database_path)
        repository = Repository(conn)
        index = VectorIndex()
        stored = repository.load_chunks()
        if stored:
            index.add([meta for meta, _ in stored], np.stack([vec for _, vec in stored]))
        embedder_ = embedder or FastEmbedEmbedder(settings.embedding_model)
        app.state.repository = repository
        app.state.ingest_service = IngestService(
            repository, index, embedder_, fetcher or HttpUrlFetcher(settings.fetch_contact)
        )
        app.state.query_service = QueryService(
            index, embedder_, generator or build_answer_generator(settings), settings.min_score
        )
        yield
        conn.close()

    app = FastAPI(title="AI Knowledge Inbox", lifespan=lifespan)
    app.middleware("http")(request_logging_middleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    register_error_handlers(app)
    app.include_router(router)
    return app


def app_factory() -> FastAPI:
    """Entry point for `uvicorn app.main:app_factory --factory`."""
    return create_app()
