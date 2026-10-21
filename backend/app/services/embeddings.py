import threading
from typing import Protocol

import numpy as np


class Embedder(Protocol):
    """Turns texts into one embedding row each. Synchronous and CPU-bound."""

    def embed(self, texts: list[str]) -> np.ndarray: ...


class FastEmbedEmbedder:
    """Local ONNX embedding model, loaded lazily on first use."""

    def __init__(self, model_name: str) -> None:
        self._model_name = model_name
        self._model = None
        self._load_lock = threading.Lock()

    def _get_model(self):
        with self._load_lock:
            if self._model is None:
                from fastembed import TextEmbedding

                self._model = TextEmbedding(model_name=self._model_name)
            return self._model

    def embed(self, texts: list[str]) -> np.ndarray:
        return np.array(list(self._get_model().embed(texts)), dtype=np.float32)
