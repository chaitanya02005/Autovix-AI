import json
import importlib.util
import os
import shutil
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from backend.dependencies import get_authorized_project, get_current_user
from backend.export_utils import (
    ExportBlockedError,
    ExportForbiddenError,
    export_csv_bytes,
    export_json_bytes,
    prepare_document_export,
)
from database.access_control import AuthorizationError, get_project_document
from database.audit_log import log_event
from database.review_store import ensure_item_review, review_status_map
from extraction.entity_recognition import (
    load_recognized_entities,
    recognition_source_digest,
    recognize_entities,
    save_recognized_entities,
)


router = APIRouter(prefix="/projects/{project_id}/documents/{document_id}/entities", tags=["entity recognition"])


def _with_review_status(entities, project_id, document_id, user_id):
    for entity in entities:
        ensure_item_review(
            project_id, document_id, "entity", entity["entity_id"], entity.get("name", ""),
            {"entity": entity},
        )
    statuses = review_status_map(project_id, document_id, user_id=user_id)
    for entity in entities:
        review = statuses.get(("entity", str(entity["entity_id"])))
        entity["review_status"] = review["status"] if review else "pending"
        entity["reviewer"] = review.get("reviewer") if review else None
        entity["review_updated_at"] = review.get("updated_at") if review else None
    return entities


def _get_document(user_id, project_id, document_id):
    try:
        return get_project_document(user_id, project_id, document_id)
    except AuthorizationError:
        raise HTTPException(status_code=403, detail={"code": "document_forbidden", "message": "Document is not accessible in this project."}) from None
    except KeyError:
        raise HTTPException(status_code=404, detail={"code": "document_not_found", "message": "Document not found."}) from None


def _result(entities, pages, *, cached):
    empty_text_pages = [
        page.get("page_number") for page in pages
        if not str(page.get("text") or "").strip()
    ]
    status_value = "completed_with_warnings" if empty_text_pages else (
        "no_entities_found" if not entities else "completed"
    )
    warning_message = "Some pages have no extracted text; recognition may be incomplete."
    ocr_empty_pages = [
        page for page in pages
        if page.get("extraction_method") == "ocr" and page.get("page_number") in empty_text_pages
    ]
    if ocr_empty_pages:
        if _ocr_runtime_unavailable():
            warning_message += " OCR could not run because Tesseract or its Python dependencies are unavailable."
        else:
            warning_message += " OCR was attempted but produced no text; those pages may be unreadable."
    return {
        "status": status_value,
        "cached": cached,
        "count": len(entities),
        "entities": entities,
        "warnings": ([{"code": "empty_page_text", "pages": empty_text_pages, "message": warning_message}] if empty_text_pages else []),
    }


def _ocr_runtime_unavailable():
    """Check OCR prerequisites without importing or invoking the OCR engine."""
    if importlib.util.find_spec("pytesseract") is None or importlib.util.find_spec("PIL") is None:
        return True
    configured = os.environ.get("TESSERACT_CMD")
    if configured:
        return shutil.which(configured) is None and not Path(configured).is_file()
    return shutil.which("tesseract") is None


def _recognition_pages(artifact_dir, pages):
    """Include stored table extraction as page-scoped source text."""
    chunks_path = Path(artifact_dir) / "chunks.json"
    if not chunks_path.exists():
        return pages
    try:
        chunks_data = json.loads(chunks_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return pages
    table_pages = []
    for chunk in chunks_data.get("chunks", []) if isinstance(chunks_data, dict) else []:
        if not isinstance(chunk, dict):
            continue
        if chunk.get("chunk_type") != "table" or not str(chunk.get("text") or "").strip():
            continue
        table_pages.append({
            "page_number": chunk.get("page_number"),
            "text": chunk["text"],
            "extraction_method": "table",
        })
    return pages + table_pages


def _load_document_entities(document):
    artifact_dir = document.get("artifact_dir")
    if not artifact_dir:
        return None
    pages_path = Path(artifact_dir) / "pages.json"
    if not pages_path.exists():
        return None
    try:
        pages = json.loads(pages_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(pages, list):
        return None
    source_pages = _recognition_pages(artifact_dir, pages)
    return load_recognized_entities(
        artifact_dir,
        project_id=document["project_id"],
        document_id=document["document_id"],
        document_version=document["version"],
        source_digest=recognition_source_digest(source_pages),
    )


@router.get("", summary="List recognized entities for an authorized document")
def list_document_entities(
    project_id: int,
    document_id: str,
    entity_type: str | None = None,
    search: str | None = None,
    page: int | None = Query(default=None, ge=1),
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    document = _get_document(current_user["id"], project["id"], document_id)
    artifact_dir = document.get("artifact_dir")
    entities = _load_document_entities(document)
    if entities is None:
        return {"status": "not_processed", "cached": False, "count": 0, "entities": [], "warnings": []}
    pages_path = Path(artifact_dir) / "pages.json"
    pages = json.loads(pages_path.read_text(encoding="utf-8")) if pages_path.exists() else []
    entities = _with_review_status(entities, project["id"], document_id, current_user["id"])
    result = _result(entities, pages, cached=True)
    filtered = entities
    if entity_type:
        filtered = [item for item in filtered if item["entity_type"].casefold() == entity_type.casefold()]
    if search:
        filtered = [item for item in filtered if search.casefold() in item["name"].casefold()]
    if page is not None:
        filtered = [item for item in filtered if page in item.get("source_pages", [])]
    result["entities"] = filtered
    result["count"] = len(filtered)
    return result


@router.post("/recognize", summary="Recognize entities from stored extracted document pages")
def run_entity_recognition(
    project_id: int,
    document_id: str,
    force: bool = Query(default=False, description="Rebuild results from stored extracted source text"),
    version: int | None = Query(default=None, ge=1),
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    document = _get_document(current_user["id"], project["id"], document_id)
    if version is not None and version != document["version"]:
        raise HTTPException(status_code=409, detail={"code": "document_version_mismatch", "message": "The selected document version changed. Reload the document list and retry."})
    artifact_dir = document.get("artifact_dir")
    if not artifact_dir:
        raise HTTPException(status_code=404, detail={"code": "document_unprocessed", "message": "Processed document pages are not available."})
    pages_path = Path(artifact_dir) / "pages.json"
    if not pages_path.exists():
        raise HTTPException(status_code=404, detail={"code": "document_unprocessed", "message": "Processed document pages are not available."})
    pages = json.loads(pages_path.read_text(encoding="utf-8"))
    if not isinstance(pages, list) or not pages:
        raise HTTPException(status_code=422, detail={"code": "empty_document", "message": "The selected document version has no extracted pages."})

    recognition_pages = _recognition_pages(artifact_dir, pages)
    source_digest = recognition_source_digest(recognition_pages)
    cache_args = {
        "project_id": project["id"],
        "document_id": document["document_id"],
        "document_version": document["version"],
        "source_digest": source_digest,
    }
    entities = None if force else load_recognized_entities(artifact_dir, **cache_args)
    cached = entities is not None
    if not cached:
        entities = recognize_entities(
            recognition_pages,
            project_id=project["id"],
            document_id=document["document_id"],
            document_version=document["version"],
        )
        save_recognized_entities(artifact_dir, entities, **cache_args)
        log_event(
            "ENTITY_RECOGNITION",
            user_id=current_user["id"],
            username=current_user["username"],
            project_id=project["id"],
            document_id=document_id,
            details={"status": "completed" if entities else "no_entities_found", "count": len(entities)},
        )
    entities = _with_review_status(entities, project["id"], document_id, current_user["id"])
    return _result(entities, pages, cached=cached)


@router.get("/{entity_id}", summary="Get one recognized entity and its source evidence")
def get_document_entity(
    project_id: int,
    document_id: str,
    entity_id: str,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    document = _get_document(current_user["id"], project["id"], document_id)
    entities = _with_review_status(
        _load_document_entities(document) or [], project["id"], document_id, current_user["id"]
    )
    entity = next((item for item in entities if item.get("entity_id") == entity_id), None)
    if entity is None:
        raise HTTPException(status_code=404, detail={"code": "entity_not_found", "message": "Entity not found in this document."})
    return entity


@router.get("/export/{format}", summary="Export recognized entities as JSON or CSV")
def export_document_entities(
    project_id: int,
    document_id: str,
    format: Literal["json", "csv"],
    include_unapproved: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    document = _get_document(current_user["id"], project["id"], document_id)
    entities = _load_document_entities(document)
    if entities is None:
        log_event("EXPORT", user_id=current_user["id"], username=current_user["username"],
                  project_id=project["id"], document_id=document_id, status="blocked",
                  details={"client": "api", "format": format, "reason": "entities_not_processed"})
        raise HTTPException(status_code=404, detail={"code": "entities_not_processed", "message": "Run entity recognition before exporting."})
    entities = _with_review_status(entities, project["id"], document_id, current_user["id"])
    try:
        records, metadata = prepare_document_export(
            entities, project["id"], document, user_id=current_user["id"],
            role=project["role"], include_unapproved=include_unapproved,
        )
    except ExportForbiddenError as error:
        log_event("EXPORT", user_id=current_user["id"], username=current_user["username"],
                  project_id=project["id"], document_id=document_id, status="blocked",
                  details={"client": "api", "format": format, "reason": str(error),
                           "include_unapproved": include_unapproved})
        raise HTTPException(status_code=403, detail={"code": "export_forbidden", "message": str(error)}) from None
    except ExportBlockedError as error:
        log_event("EXPORT", user_id=current_user["id"], username=current_user["username"],
                  project_id=project["id"], document_id=document_id, status="blocked",
                  details={"client": "api", "format": format, "reason": str(error),
                           "include_unapproved": include_unapproved})
        raise HTTPException(status_code=409, detail={"code": "export_blocked", "message": str(error)}) from None
    log_event("EXPORT", user_id=current_user["id"], username=current_user["username"],
              project_id=project["id"], document_id=document_id,
              details={"client": "api", "format": format, "approved_count": metadata["approved_count"],
                       "excluded_count": metadata["excluded_count"], "include_unapproved": include_unapproved})
    draft_suffix = "_UNAPPROVED - DRAFT" if include_unapproved else ""
    filename = f"entities_{document_id}{draft_suffix}.{format}"
    if format == "csv":
        return Response(export_csv_bytes(records, metadata=metadata), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
    return Response(export_json_bytes(records, filename, metadata=metadata), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{filename}"'})
