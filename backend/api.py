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
    exports,
    projects,
    query,
    relationships,
    review,
    traceability,
)
from database.access_control import AuthorizationError


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
async def validation_error_handler(_request: Request, _exception: RequestValidationError):
    return _error(400, "invalid_request", "Request data did not match the expected schema.")


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
    return {"status": "ok", "service": "Autovix"}


# Include routes at root
_routers = [
    auth.router,
    projects.router,
    documents.router,
    query.router,
    traceability.router,
    relationships.router,
    comparison.router,
    review.router,
    audit.router,
    exports.router,
]

for r in _routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")