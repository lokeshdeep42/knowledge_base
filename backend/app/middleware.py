import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

from app.errors import error_response

logger = logging.getLogger("app.request")


async def request_logging_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Log each request, tag it with X-Request-ID and turn unhandled errors into a 500."""
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("unhandled_error", extra={"request_id": request_id, "path": request.url.path})
        response = error_response(500, "internal_error", "Something went wrong on our side.")
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round((time.perf_counter() - started) * 1000, 1),
        },
    )
    return response
