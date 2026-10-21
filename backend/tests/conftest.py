import hashlib
import re
from collections.abc import Iterator

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas import Source
from app.services.fetcher import FetchedPage


class FakeEmbedder:
    """Deterministic hashed bag-of-words embeddings (no model download)."""

    dim = 128

    def embed(self, texts: list[str]) -> np.ndarray:
        matrix = np.zeros((len(texts), self.dim), dtype=np.float32)
        for row, text in enumerate(texts):
            for word in re.findall(r"[a-z0-9]+", text.lower()):
                matrix[row, int(hashlib.md5(word.encode()).hexdigest(), 16) % self.dim] += 1
        return matrix


class FakeGenerator:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[Source]]] = []

    async def generate(self, question: str, sources: list[Source]) -> str:
        self.calls.append((question, sources))
        return "The answer is in " + " ".join(f"[{s.citation}]" for s in sources)


class FakeFetcher:
    async def fetch(self, url: str) -> FetchedPage:
        return FetchedPage(title="Fetched page", text="Rust ownership rules prevent data races at compile time.")


def make_settings(tmp_path) -> Settings:
    return Settings(
        _env_file=None,
        openai_api_key=None,
        database_path=tmp_path / "inbox.db",
        min_score=0.2,
    )


@pytest.fixture
def generator() -> FakeGenerator:
    return FakeGenerator()


@pytest.fixture
def client(tmp_path, generator) -> Iterator[TestClient]:
    app = create_app(
        make_settings(tmp_path), embedder=FakeEmbedder(), generator=generator, fetcher=FakeFetcher()
    )
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client_without_llm(tmp_path) -> Iterator[TestClient]:
    app = create_app(make_settings(tmp_path), embedder=FakeEmbedder(), fetcher=FakeFetcher())
    with TestClient(app) as test_client:
        yield test_client
