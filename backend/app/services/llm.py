from typing import Protocol

from openai import AsyncOpenAI, OpenAIError

from app.config import Settings
from app.errors import LLMError
from app.schemas import Source

SYSTEM_PROMPT = (
    "You answer questions using ONLY the numbered context passages provided. "
    "Cite the passages you rely on inline as [1], [2], matching their numbers. "
    "If the context does not contain enough information, say you don't know "
    "instead of guessing."
)


class AnswerGenerator(Protocol):
    async def generate(self, question: str, sources: list[Source]) -> str: ...


def build_messages(question: str, sources: list[Source]) -> list[dict[str, str]]:
    context = "\n\n".join(f"[{s.citation}] ({s.title})\n{s.snippet}" for s in sources)
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {question}"},
    ]


class OpenAIAnswerGenerator:
    """Chat-completions client; works with any OpenAI-compatible endpoint."""

    def __init__(self, api_key: str, model: str, base_url: str | None = None) -> None:
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        self._model = model

    async def generate(self, question: str, sources: list[Source]) -> str:
        try:
            completion = await self._client.chat.completions.create(
                model=self._model, messages=build_messages(question, sources), temperature=0.2
            )
        except OpenAIError as exc:
            raise LLMError(f"The language model request failed: {exc}") from exc
        return (completion.choices[0].message.content or "").strip()


def build_answer_generator(settings: Settings) -> AnswerGenerator | None:
    if not settings.openai_api_key:
        return None
    return OpenAIAnswerGenerator(settings.openai_api_key, settings.llm_model, settings.openai_base_url)
