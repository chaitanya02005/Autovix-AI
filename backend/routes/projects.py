from fastapi import APIRouter, Depends, HTTPException, status

from backend.dependencies import get_authorized_project, get_current_user
from backend.schemas import ProjectCreate, ProjectResponse, ProjectStatsResponse
from database.access_control import (
    AuthorizationError,
    create_project,
    get_project_document,
    list_project_documents,
    list_user_projects,
)
from database.audit_log import log_event, read_logs


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse], summary="List projects accessible to the user")
def list_projects(current_user: dict = Depends(get_current_user)):
    return list_user_projects(current_user["id"])


@router.post("", response_model=ProjectResponse, status_code=201, summary="Create a project (admin only)")
def create_project_endpoint(
    request: ProjectCreate,
    current_user: dict = Depends(get_current_user),
):
    try:
        project = create_project(current_user["id"], request.name)
    except AuthorizationError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "role_forbidden", "message": "Only admins can create projects."},
        ) from None
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_project", "message": str(error)},
        ) from None
    log_event(
        "PROJECT_CREATED",
        user_id=current_user["id"],
        username=current_user["username"],
        project_id=project["id"],
        details={"client": "api"},
    )
    return project


@router.get("/{project_id}", response_model=ProjectResponse, summary="Get an authorized project")
def get_project(project: dict = Depends(get_authorized_project)):
    return {"id": project["id"], "name": project["name"], "role": project["role"]}


@router.get(
    "/{project_id}/stats",
    response_model=ProjectStatsResponse,
    summary="Get summary statistics for the project",
)
def get_project_stats(
    project_id: int,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    docs = list_project_documents(current_user["id"], project["id"])
    docs_count = len(docs)
    active_doc = None
    entities_count = 0

    if docs:
        latest = get_project_document(current_user["id"], project["id"], docs[0]["document_id"])
        entities_count = latest.get("traceability_count", 0)
        active_doc = {
            "document_id": latest["document_id"],
            "filename": latest["filename"],
            "version": latest["version"],
            "pages": latest["page_count"],
            "chunks": latest["chunk_count"],
            "traceability_records": entities_count,
            "status": "Processed" if latest["page_count"] > 0 else "Processing",
        }

    logs = read_logs(user_id=current_user["id"], project_id=project["id"], limit=100)
    questions_count = len([lg for lg in logs if lg.get("event_type") == "QUESTION_ASKED"])

    return ProjectStatsResponse(
        documents_count=docs_count,
        entities_count=entities_count,
        questions_count=questions_count,
        active_document=active_doc,
    )