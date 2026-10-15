from typing import Any, Literal

from pydantic import BaseModel, Field


class TokenRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: "UserResponse | None" = None


class UserResponse(BaseModel):
    id: int
    username: str
    role: str


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class ProjectResponse(BaseModel):
    id: int
    name: str
    role: str


class DocumentResponse(BaseModel):
    document_id: str
    project_id: int
    filename: str
    version: int
    pages: int
    chunks: int
    traceability_count: int
    upload_timestamp: str | None = None


class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=10000)


class QueryResponse(BaseModel):
    answer: str
    retrieval_confidence: dict[str, Any]
    grounding: dict[str, Any]
    sources: list[dict[str, Any]]
    primary_source: dict[str, Any] | None
    project_id: int
    document_id: str | None
    context: list[dict[str, Any]] = Field(default_factory=list)
    model: str | None = None


class ReviewCreate(BaseModel):
    question: str = Field(min_length=1, max_length=10000)
    answer: str = Field(min_length=1, max_length=30000)
    confidence: dict[str, Any] = Field(default_factory=dict)
    review_status: Literal["approved", "needs_review"]


class ReviewStatusUpdate(BaseModel):
    review_status: Literal["approved", "needs_review"]


class ReviewItemCreate(BaseModel):
    item_type: Literal["answer"]
    item_id: str | None = Field(default=None, min_length=1, max_length=200)
    original_value: str = Field(min_length=1, max_length=30000)
    item_metadata: dict[str, Any] = Field(default_factory=dict)


class ReviewActionRequest(BaseModel):
    comment: str | None = Field(default=None, max_length=5000)


class ReviewCorrectionRequest(BaseModel):
    corrected_value: str = Field(min_length=1, max_length=30000)
    comment: str = Field(min_length=1, max_length=5000)


class BulkReviewRequest(BaseModel):
    item_ids: list[str] = Field(min_length=1, max_length=200)
    item_type: Literal["entity", "answer"] = "entity"


class CompareRequest(BaseModel):
    baseline_document_id: str = Field(min_length=1, max_length=200)
    current_document_id: str = Field(min_length=1, max_length=200)


class CompareResponse(BaseModel):
    added: list[dict[str, Any]]
    removed: list[dict[str, Any]]
    unchanged: list[dict[str, Any]]


class AuditLogRequest(BaseModel):
    event_type: str = Field(min_length=1, max_length=64)
    question: str | None = None
    document_name: str | None = None
    document_id: str | None = None
    status: str = "success"
    details: dict[str, Any] = Field(default_factory=dict)


class DocumentDetailResponse(DocumentResponse):
    extracted_pages: list[dict[str, Any]] = Field(default_factory=list)


class ProjectStatsResponse(BaseModel):
    documents_count: int
    entities_count: int
    questions_count: int
    active_document: dict[str, Any] | None = None


