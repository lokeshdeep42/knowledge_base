from typing import Annotated, Literal

from pydantic import AnyHttpUrl, BaseModel, Field, StringConstraints, TypeAdapter, field_validator

SourceType = Literal["note", "url"]

_http_url = TypeAdapter(AnyHttpUrl)


class NoteIngest(BaseModel):
    type: Literal["note"]
    content: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20000)]
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None


class UrlIngest(BaseModel):
    type: Literal["url"]
    url: Annotated[str, Field(max_length=2048)]

    @field_validator("url")
    @classmethod
    def _must_be_http_url(cls, value: str) -> str:
        _http_url.validate_python(value)
        return value


IngestRequest = Annotated[NoteIngest | UrlIngest, Field(discriminator="type")]


class Item(BaseModel):
    id: str
    source_type: SourceType
    title: str
    url: str | None
    preview: str
    chunk_count: int
    created_at: str


class ItemList(BaseModel):
    items: list[Item]


class QueryRequest(BaseModel):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    top_k: Annotated[int, Field(ge=1, le=10)] = 5


class Source(BaseModel):
    citation: int
    item_id: str
    title: str
    source_type: SourceType
    url: str | None
    snippet: str
    score: float


class QueryResponse(BaseModel):
    answer: str | None
    llm_configured: bool
    sources: list[Source]


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    llm_configured: bool
    items: int
