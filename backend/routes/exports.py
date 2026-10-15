from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response

from analysis.document_comparison import compare_entities
from backend.dependencies import get_authorized_project, get_current_user
from backend.export_utils import (
    ExportBlockedError,
    ExportForbiddenError,
    export_csv_bytes,
    export_json_bytes,
    prepare_comparison_export,
    prepare_project_traceability_export,
)
from backend.services import get_document_traceability, get_project_traceability
from database.audit_log import log_event


router = APIRouter(prefix="/projects/{project_id}/exports", tags=["exports"])


def _log_export(project, current_user, artifact, format, *, status_value="blocked", document_id=None, details=None):
    log_event(
        "EXPORT", user_id=current_user["id"], username=current_user["username"],
        project_id=project["id"], document_id=document_id, status=status_value,
        details={"client": "api", "artifact": artifact, "format": format, **(details or {})},
    )


@router.get("/{artifact}", summary="Export project analysis as JSON or CSV")
def export_project_data(
    project_id: int,
    artifact: Literal["traceability", "comparison"],
    format: Literal["json", "csv"] = Query(default="json"),
    baseline_document_id: str | None = None,
    current_document_id: str | None = None,
    include_unapproved: bool = Query(default=False),
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    try:
        if artifact == "traceability":
            records = get_project_traceability(current_user["id"], project["id"])
            records, metadata = prepare_project_traceability_export(
                records, project["id"], user_id=current_user["id"], role=project["role"],
                include_unapproved=include_unapproved,
            )
        else:
            if not baseline_document_id or not current_document_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "comparison_documents_required",
                            "message": "baseline_document_id and current_document_id are required for comparison exports."},
                )
            try:
                baseline, old_records = get_document_traceability(
                    current_user["id"], project["id"], baseline_document_id
                )
                current, new_records = get_document_traceability(
                    current_user["id"], project["id"], current_document_id
                )
            except PermissionError:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"code": "document_forbidden", "message": "Both documents must belong to this project."},
                ) from None
            comparison = compare_entities(old_records, new_records)
            records = [
                {"change_type": change_type, **record}
                for change_type in ("added", "removed", "unchanged")
                for record in comparison[change_type]
            ]
            records, metadata = prepare_comparison_export(
                records, project["id"], baseline, current, user_id=current_user["id"],
                role=project["role"], include_unapproved=include_unapproved,
            )
    except ExportForbiddenError as error:
        _log_export(project, current_user, artifact, format,
                    details={"reason": str(error), "include_unapproved": include_unapproved})
        raise HTTPException(status_code=403, detail={"code": "export_forbidden", "message": str(error)}) from None
    except ExportBlockedError as error:
        _log_export(project, current_user, artifact, format,
                    details={"reason": str(error), "include_unapproved": include_unapproved})
        raise HTTPException(status_code=409, detail={"code": "export_blocked", "message": str(error)}) from None
    except HTTPException as error:
        detail = error.detail if isinstance(error.detail, dict) else {"message": str(error.detail)}
        _log_export(project, current_user, artifact, format,
                    details={"reason": detail.get("code", "request_error"), "include_unapproved": include_unapproved})
        raise

    _log_export(
        project, current_user, artifact, format, status_value="success",
        document_id=current_document_id,
        details={"approved_count": metadata["approved_count"],
                 "excluded_count": metadata["excluded_count"],
                 "include_unapproved": include_unapproved},
    )
    draft_suffix = "_UNAPPROVED - DRAFT" if include_unapproved else ""
    filename = f"{artifact}_{project['id']}{draft_suffix}.{format}"
    if format == "csv":
        return Response(
            content=export_csv_bytes(records, metadata=metadata).decode("utf-8"),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return Response(
        content=export_json_bytes(records, filename, metadata=metadata),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
