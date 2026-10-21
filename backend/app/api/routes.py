from fastapi import APIRouter, Depends, Request

from app.repository import Repository
from app.schemas import Health, IngestRequest, Item, ItemList, QueryRequest, QueryResponse
from app.services.ingest import IngestService
from app.services.query import QueryService

router = APIRouter()


def get_repository(request: Request) -> Repository:
    return request.app.state.repository


def get_ingest_service(request: Request) -> IngestService:
    return request.app.state.ingest_service


def get_query_service(request: Request) -> QueryService:
    return request.app.state.query_service


@router.get("/health", response_model=Health)
async def health(
    repository: Repository = Depends(get_repository),
    query_service: QueryService = Depends(get_query_service),
) -> Health:
    return Health(llm_configured=query_service.llm_configured, items=repository.count_items())


@router.post("/ingest", response_model=Item, status_code=201)
async def ingest(body: IngestRequest, service: IngestService = Depends(get_ingest_service)) -> Item:
    return await service.ingest(body)


@router.get("/items", response_model=ItemList)
async def list_items(repository: Repository = Depends(get_repository)) -> ItemList:
    return ItemList(items=repository.list_items())


@router.post("/query", response_model=QueryResponse)
async def query(body: QueryRequest, service: QueryService = Depends(get_query_service)) -> QueryResponse:
    return await service.answer(body.question, body.top_k)
