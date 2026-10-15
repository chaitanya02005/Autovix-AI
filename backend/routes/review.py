import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status

from backend.dependencies import get_authorized_project, get_current_user, require_project_roles
from backend.schemas import (
    BulkReviewRequest,
    ReviewActionRequest,
    ReviewCorrectionRequest,
    ReviewCreate,
    ReviewItemCreate,
    ReviewStatusUpdate,
)
from database.audit_log import log_event
from database.access_control import AuthorizationError, get_project_document
from database.review_store import (
    create_item_review,
    ensure_item_review,
    list_document_reviews,
    list_project_item_reviews,
    list_reviews,
    review_summary,
    save_review,
    update_item_review,
    update_review_status,
)


router = APIRouter(prefix="/projects/{project_id}/reviews", tags=["review"])
document_router = APIRouter(
    prefix="/projects/{project_id}/documents/{document_id}/reviews", tags=["review"]
)


@router.get("", summary="List reviews for an authorized project")
def get_reviews(
    project_id: int,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    return list_reviews(
        limit=max(1, min(limit, 200)),
        user_id=current_user["id"],
        project_id=project["id"],
    )


@router.post("", status_code=201, summary="Create a project review (admin or architect)")
def create_review(
    project_id: int,
    request: ReviewCreate,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    require_project_roles(project, "admin", "architect")
    try:
        review = save_review(
            request.question,
            request.answer,
            request.confidence,
            request.review_status,
            user_id=current_user["id"],
            project_id=project["id"],
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "review_forbidden", "message": "Your role cannot submit reviews."},
        ) from None
    log_event(
        "REVIEW",
        user_id=current_user["id"],
        username=current_user["username"],
        project_id=project["id"],
        details={"client": "api", "review_status": request.review_status},
    )
    return review


@router.patch("/{review_id}", summary="Update a review status (admin or architect)")
def update_review(
    project_id: int,
    review_id: str,
    request: ReviewStatusUpdate,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    require_project_roles(project, "admin", "architect")
    try:
        review = update_review_status(
            review_id,
            request.review_status,
            user_id=current_user["id"],
            project_id=project["id"],
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "review_forbidden", "message": "Your role cannot update reviews."},
        ) from None
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "review_not_found", "message": "Review not found in this project."},
        ) from None
    log_event(
        "REVIEW",
        user_id=current_user["id"],
        username=current_user["username"],
        project_id=project["id"],
        details={"client": "api", "review_id": review_id, "review_status": request.review_status},
    )
    return review


def _require_document_access(user_id, project_id, document_id):
    try:
        return get_project_document(user_id, project_id, document_id)
    except AuthorizationError:
        raise HTTPException(
            status_code=403,
            detail={"code": "document_forbidden", "message": "Document is not accessible in this project."},
        ) from None
    except KeyError:
        raise HTTPException(
            status_code=404,
            detail={"code": "document_not_found", "message": "Document not found."},
        ) from None


def _ensure_entity_review_rows(document, user_id):
    from backend.routes.entities import _load_document_entities

    entities = _load_document_entities(document) or []
    for entity in entities:
        ensure_item_review(
            document["project_id"], document["document_id"], "entity", entity["entity_id"],
            entity.get("name", ""), {"entity": entity},
        )


@document_router.get("", summary="List review items for a document")
def get_document_reviews(
    project_id: int,
    document_id: str,
    review_status: str | None = Query(default=None, alias="status"),
    item_type: str | None = None,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    document = _require_document_access(current_user["id"], project["id"], document_id)
    _ensure_entity_review_rows(document, current_user["id"])
    try:
        return list_document_reviews(
            project["id"], document_id, status=review_status, item_type=item_type,
            user_id=current_user["id"],
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail={"code": "invalid_review_filter", "message": str(error)}) from None


@document_router.get("/summary", summary="Count review items by status")
def get_document_review_summary(
    project_id: int,
    document_id: str,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    document = _require_document_access(current_user["id"], project["id"], document_id)
    _ensure_entity_review_rows(document, current_user["id"])
    return review_summary(project["id"], document_id, user_id=current_user["id"])


@document_router.post("", status_code=201, summary="Send an answer for review")
def submit_answer_for_review(
    project_id: int,
    document_id: str,
    request: ReviewItemCreate,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    _require_document_access(current_user["id"], project["id"], document_id)
    item_id = request.item_id or uuid.uuid4().hex
    record = create_item_review(
        project["id"], document_id, request.item_type, item_id, request.original_value,
        request.item_metadata, user_id=current_user["id"],
    )
    log_event(
        "REVIEW_SUBMITTED", user_id=current_user["id"], username=current_user["username"],
        project_id=project["id"], document_id=document_id,
        details={"action": "submit", "actor_user_id": current_user["id"],
                 "item_type": "answer", "item_id": item_id},
    )
    return record


def _review_action(
    project_id, document_id, item_type, item_id, action, current_user, project,
    *, comment=None, corrected_value=None,
):
    require_project_roles(project, "admin", "architect")
    document = _require_document_access(current_user["id"], project["id"], document_id)
    try:
        record = update_item_review(
            project["id"], document_id, item_type, item_id, action,
            user_id=current_user["id"], comment=comment, corrected_value=corrected_value,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail={"code": "review_item_not_found", "message": "Review item not found."}) from None
    except ValueError as error:
        raise HTTPException(status_code=400, detail={"code": "invalid_review_action", "message": str(error)}) from None
    log_event(
        "REVIEW_ACTION", user_id=current_user["id"], username=current_user["username"],
        project_id=project["id"], document_id=document_id,
        details={"action": action, "actor_user_id": current_user["id"],
                 "item_type": item_type, "item_id": item_id,
                 "comment": comment, "document_version": document.get("version")},
    )
    return record


@document_router.post("/{item_type}/{item_id}/approve", summary="Approve a review item")
def approve_review_item(
    project_id: int, document_id: str, item_type: str, item_id: str,
    request: ReviewActionRequest = ReviewActionRequest(),
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    if item_type not in {"entity", "answer"}:
        raise HTTPException(status_code=404, detail={"code": "review_item_not_found", "message": "Review item not found."})
    return _review_action(project_id, document_id, item_type, item_id, "approved", current_user, project, comment=request.comment)


@document_router.post("/{item_type}/{item_id}/reject", summary="Reject a review item")
def reject_review_item(
    project_id: int, document_id: str, item_type: str, item_id: str,
    request: ReviewActionRequest,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    if item_type not in {"entity", "answer"}:
        raise HTTPException(status_code=404, detail={"code": "review_item_not_found", "message": "Review item not found."})
    return _review_action(project_id, document_id, item_type, item_id, "rejected", current_user, project, comment=request.comment)


@document_router.post("/{item_type}/{item_id}/correct", summary="Correct a review item")
def correct_review_item(
    project_id: int, document_id: str, item_type: str, item_id: str,
    request: ReviewCorrectionRequest,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    if item_type not in {"entity", "answer"}:
        raise HTTPException(status_code=404, detail={"code": "review_item_not_found", "message": "Review item not found."})
    return _review_action(
        project_id, document_id, item_type, item_id, "corrected", current_user, project,
        comment=request.comment, corrected_value=request.corrected_value,
    )


@document_router.post("/bulk-approve", summary="Approve multiple entity review items")
def bulk_approve_review_items(
    project_id: int, document_id: str, request: BulkReviewRequest,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    require_project_roles(project, "admin", "architect")
    document = _require_document_access(current_user["id"], project["id"], document_id)
    records = []
    for item_id in request.item_ids:
        records.append(_review_action(
            project_id, document_id, request.item_type, item_id, "approved", current_user, project
        ))
    log_event(
        "REVIEW_BULK_ACTION", user_id=current_user["id"], username=current_user["username"],
        project_id=project["id"], document_id=document_id,
        details={"action": "bulk_approve", "actor_user_id": current_user["id"],
                 "item_type": request.item_type, "item_ids": request.item_ids,
                 "document_version": document.get("version")},
    )
    return {"approved": len(records), "items": records}
