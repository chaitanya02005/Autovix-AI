from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from analysis.document_comparison import compare_entities
from backend.dependencies import get_authorized_project, get_current_user, require_project_roles
from backend.schemas import CompareRequest, CompareResponse
from backend.services import get_document_traceability
from database.audit_log import log_event


router = APIRouter(prefix="/projects/{project_id}/compare", tags=["comparison"])


@router.post("", response_model=CompareResponse, summary="Compare two documents within one project")
def compare_project_documents(
    project_id: int,
    request: CompareRequest,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    require_project_roles(project, "admin", "architect")
    try:
        baseline, old_records = get_document_traceability(
            current_user["id"], project["id"], request.baseline_document_id
        )
        current, new_records = get_document_traceability(
            current_user["id"], project["id"], request.current_document_id
        )
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "document_forbidden", "message": "Both documents must belong to this project."},
        ) from None
    comparison = compare_entities(old_records, new_records)
    log_event(
        "COMPARISON",
        document_name=f"{baseline['filename']} vs {current['filename']}",
        user_id=current_user["id"],
        username=current_user["username"],
        project_id=project["id"],
        document_id=current["document_id"],
        details={"client": "api"},
    )
    return comparison


@router.post("/files", response_model=CompareResponse, summary="Compare two uploaded PDF files")
async def compare_uploaded_files(
    project_id: int,
    baseline_file: UploadFile = File(..., description="Baseline PDF"),
    current_file: UploadFile = File(..., description="Current PDF"),
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    require_project_roles(project, "admin", "architect")
    import os
    import tempfile
    from extraction.traceability import extract_traceable_entities
    from ingestion.pdf_parser import extract_text_from_pdf

    old_path = None
    new_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_old:
            content_old = await baseline_file.read()
            temp_old.write(content_old)
            old_path = temp_old.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_new:
            content_new = await current_file.read()
            temp_new.write(content_new)
            new_path = temp_new.name

        old_pages = extract_text_from_pdf(old_path)
        new_pages = extract_text_from_pdf(new_path)
        old_records = extract_traceable_entities(old_pages)
        new_records = extract_traceable_entities(new_pages)

        comparison = compare_entities(old_records, new_records)

        log_event(
            "COMPARISON_RUN",
            document_name=f"{baseline_file.filename} vs {current_file.filename}",
            status="success",
            details={
                "added": len(comparison["added"]),
                "removed": len(comparison["removed"]),
                "unchanged": len(comparison["unchanged"]),
                "client": "api",
            },
            user_id=current_user["id"],
            username=current_user["username"],
            project_id=project["id"],
        )
        return comparison
    finally:
        if old_path and os.path.exists(old_path):
            os.remove(old_path)
        if new_path and os.path.exists(new_path):
            os.remove(new_path)