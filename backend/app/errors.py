from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Domain error rendered as {"error": {"code", "message"}}."""

    status_code = 400
    code = "app_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class UnsupportedContentError(AppError):
    status_code = 422
    code = "unsupported_content"


class EmptyContentError(AppError):
    status_code = 422
    code = "empty_content"


class BlockedUrlError(AppError):
    status_code = 422
    code = "blocked_url"


class FetchFailedError(AppError):
    status_code = 502
    code = "fetch_failed"


class LLMError(AppError):
    status_code = 502
    code = "llm_error"


def error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code, content={"error": {"code": code, "message": message}}
    )


def _describe_validation_error(exc: RequestValidationError) -> str:
    first = exc.errors()[0]
    fields = [part for part in first["loc"] if isinstance(part, str) and part != "body"]
    prefix = f"{fields[-1]}: " if fields else ""
    return f"{prefix}{first['msg']}"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return error_response(exc.status_code, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(422, "validation_error", _describe_validation_error(exc))
