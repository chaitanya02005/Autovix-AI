import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response

from backend.dependencies import get_authorized_project, get_current_user, require_project_roles
from backend.schemas import DocumentDetailResponse, DocumentResponse
from database.access_control import (
    AuthorizationError,
    delete_document as db_delete_document,
    get_project_document,
    list_project_documents,
)
from database.audit_log import log_event
from ingestion.document_processor import process_uploaded_pdf


router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])


class _UploadedDocument:
    def __init__(self, name, content):
        self.name = name
        self._content = content

    def getbuffer(self):
        return memoryview(self._content)


def _document_response(record):
    return {
        "document_id": record["document_id"],
        "project_id": record["project_id"],
        "filename": record["filename"],
        "version": record["version"],
        "pages": record["page_count"],
        "chunks": record["chunk_count"],
        "traceability_count": record["traceability_count"],
        "relationship_count": record.get("relationship_count", 0),
        "upload_timestamp": record.get("upload_timestamp"),
    }


@router.post("", response_model=DocumentResponse, status_code=201, summary="Upload and process a project PDF")
def upload_document(
    project_id: int,
    file: UploadFile = File(..., description="AUTOSAR PDF document"),
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    require_project_roles(project, "admin", "architect")
    filename = Path(file.filename or "").name
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_file", "message": "Only PDF uploads are supported."},
        )
    try:
        payload = file.file.read()
        result = process_uploaded_pdf(
            _UploadedDocument(filename, payload),
            user_id=current_user["id"],
            project_id=project_id,
        )
    except AuthorizationError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "project_forbidden", "message": "You are not authorized to upload to this project."},
        ) from None
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "upload_forbidden", "message": str(error)},
        ) from None
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_document", "message": str(error)},
        ) from None
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "document_not_found", "message": "The uploaded document could not be read."},
        ) from None

    log_event(
        "DOCUMENT_UPLOAD",
        document_name=result["filename"],
        status="success",
        user_id=current_user["id"],
        username=current_user["username"],
        project_id=project_id,
        document_id=result["document_id"],
        details={"client": "api", "version": result["version"]},
    )
    return {
        **result,
        "project_id": project_id,
        "traceability_count": result["traceability_records"],
        "relationship_count": result["relationship_records"],
        "upload_timestamp": result["version_info"].get("upload_timestamp"),
    }


@router.get("", response_model=list[DocumentResponse], summary="List documents in an authorized project")
def list_documents(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    try:
        documents = list_project_documents(current_user["id"], project["id"])
    except AuthorizationError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "project_forbidden", "message": "You are not authorized for this project."},
        ) from None
    return [_document_response(document) for document in documents]


@router.get(
    "/{document_id}",
    response_model=DocumentDetailResponse,
    summary="Get document details and extracted pages",
)
def get_document_details(
    project_id: int,
    document_id: str,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    try:
        doc = get_project_document(current_user["id"], project["id"], document_id)
    except AuthorizationError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "project_forbidden", "message": "You are not authorized for this project."},
        ) from None
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "document_not_found", "message": "Document not found."},
        ) from None

    artifact_dir = Path(doc["artifact_dir"]) if doc.get("artifact_dir") else None
    pages_file = (artifact_dir / "pages.json") if artifact_dir else None
    pages_data = []
    if pages_file and pages_file.exists():
        with pages_file.open("r", encoding="utf-8") as f:
            pages_data = json.load(f)

    return {
        **_document_response(doc),
        "extracted_pages": pages_data,
    }


@router.get("/{document_id}/download", summary="Download extracted text of a document")
def download_document_text(
    project_id: int,
    document_id: str,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    try:
        doc = get_project_document(current_user["id"], project["id"], document_id)
    except (AuthorizationError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "document_not_found", "message": "Document not found."},
        ) from None

    artifact_dir = Path(doc["artifact_dir"]) if doc.get("artifact_dir") else None
    pages_file = (artifact_dir / "pages.json") if artifact_dir else None
    if not pages_file or not pages_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "content_not_found", "message": "Extracted text is not available."},
        )

    with pages_file.open("r", encoding="utf-8") as pf:
        pages_data = json.load(pf)

    fname = doc.get("filename", "document")
    ver = doc.get("version", "1")
    pg = doc.get("page_count", 0)
    ts = str(doc.get("upload_timestamp", ""))[:10]

    txt_lines = [
        f"Document: {fname}",
        f"Version: {ver}",
        f"Pages: {pg}",
        f"Uploaded: {ts}",
        "=" * 60,
        "",
    ]
    for page in pages_data:
        txt_lines.append(f"--- Page {page.get('page_number', '?')} ---")
        txt_lines.append(page.get("text", "").strip())
        txt_lines.append("")

    dl_bytes = "\n".join(txt_lines).encode("utf-8")
    stem = Path(fname).stem
    return Response(
        content=dl_bytes,
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{stem}_extracted.txt"'
        },
    )


@router.delete("/{document_id}", status_code=200, summary="Delete a document and its artifacts")
def delete_project_document(
    project_id: int,
    document_id: str,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    require_project_roles(project, "admin", "architect")
    try:
        doc = get_project_document(current_user["id"], project["id"], document_id)
        fname = doc.get("filename", "Unknown")
        db_delete_document(current_user["id"], project["id"], document_id)
        log_event(
            "DOCUMENT_DELETED",
            document_name=fname,
            status="success",
            user_id=current_user["id"],
            username=current_user["username"],
            project_id=project["id"],
            document_id=document_id,
        )
    except AuthorizationError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "delete_forbidden", "message": str(error)},
        ) from None
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "document_not_found", "message": "Document not found."},
        ) from None
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "delete_failed", "message": str(error)},
        ) from None

    return {"status": "success", "message": f"'{fname}' deleted successfully."}