import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.routes import (
    audit,
    auth,
    comparison,
    documents,
    entities,
    exports,
    projects,
    query,
    review,
    traceability,
)
from database.access_control import AuthorizationError
from rag.llm_client import check_local_llm


logger = logging.getLogger(__name__)

app = FastAPI(
    title="Autovix API",
    description="Project-scoped architecture document processing and analysis services.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error(status_code, code, message, headers=None):
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message}},
        headers=headers,
    )


@app.exception_handler(HTTPException)
async def http_error_handler(_request: Request, exception: HTTPException):
    detail = exception.detail
    if isinstance(detail, dict):
        code = str(detail.get("code", "request_error"))
        message = str(detail.get("message", "The request could not be completed."))
    else:
        code = "request_error"
        message = str(detail)
    return _error(exception.status_code, code, message, exception.headers)


@app.exception_handler(AuthorizationError)
async def authorization_error_handler(_request: Request, exception: AuthorizationError):
    return _error(403, "forbidden", str(exception))


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exception: RequestValidationError):
    # Report only field locations and validator codes. Never echo submitted values,
    # since validation errors can originate from credentials or document metadata.
    fields = []
    for error in exception.errors():
        location = ".".join(str(part) for part in error.get("loc", ()) if part != "body") or "request"
        validator = str(error.get("type", "invalid"))
        fields.append(f"{location} ({validator})")
    message = "Request validation failed" + (f" for {', '.join(fields)}." if fields else ".")
    logger.info("Request validation rejected %s %s: %s", _request.method, _request.url.path, message)
    return _error(400, "invalid_request", message)


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exception: ValueError):
    return _error(400, "invalid_request", str(exception))


@app.exception_handler(Exception)
async def unexpected_error_handler(_request: Request, exception: Exception):
    logger.exception("Unhandled API exception", exc_info=exception)
    return _error(500, "internal_error", "An unexpected server error occurred.")


@app.get("/health", tags=["health"], summary="Check API health")
@app.get("/api/health", tags=["health"], summary="Check API health")
def health():
    llm = check_local_llm()
    if not llm["ready"]:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "service": "Autovix", "llm": llm},
        )
    return {"status": "ok", "service": "Autovix", "llm": llm}


# Include routes at root
_routers = [
    auth.router,
    projects.router,
    documents.router,
    entities.router,
    query.router,
    traceability.router,
    comparison.router,
    review.router,
    review.document_router,
    audit.router,
    exports.router,
]

for r in _routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")
