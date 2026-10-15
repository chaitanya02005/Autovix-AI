import csv
from datetime import datetime, timezone
import io
import json

from database.access_control import list_project_documents
from database.review_store import current_signoff, list_document_reviews


EXPORT_BLOCKED_MESSAGE = "Export blocked: no findings have been approved by an authorized engineer."


class ExportBlockedError(RuntimeError):
    pass


class ExportForbiddenError(PermissionError):
    pass


def _timestamp():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _approved(status):
    return status in {"approved", "corrected"}


def _names(row):
    return {
        str(row.get(key) or "").strip().casefold()
        for key in ("name", "entity", "original_value")
        if str(row.get(key) or "").strip()
    }


def _review_index(project_id, document_id, user_id):
    reviews = list_document_reviews(project_id, document_id, user_id=user_id)
    by_id = {}
    by_name = {}
    for review in reviews:
        if review["item_type"] != "entity":
            continue
        by_id[review["item_id"]] = review
        names = {review["original_value"].strip().casefold()}
        entity = review["item_metadata"].get("entity") or {}
        names.update(_names(entity))
        for name in names:
            if name:
                by_name[name] = review
    return by_id, by_name


def _annotate_row(row, review, *, include_unapproved):
    if review is None:
        status = "pending"
        reviewer = None
        reviewed_at = None
    else:
        status = review["status"]
        reviewer = review.get("reviewer")
        reviewed_at = review.get("updated_at") if _approved(status) else None
    if not _approved(status) and not include_unapproved:
        return None
    result = dict(row)
    if status == "corrected" and review and review.get("corrected_value"):
        if "name" in result:
            result["name"] = review["corrected_value"]
        elif "entity" in result:
            result["entity"] = review["corrected_value"]
        else:
            result["corrected_value"] = review["corrected_value"]
    for key in ("review_status", "reviewed_by", "reviewed_at"):
        result.pop(key, None)
    result["review_status"] = status
    result["reviewed_by"] = reviewer
    result["reviewed_at"] = reviewed_at
    return result


def _check_signoff(project_id, document, user_id):
    signoff = current_signoff(
        project_id, document["document_id"], document["version"], user_id=user_id
    )
    if not signoff or not signoff["valid"]:
        raise ExportBlockedError(
            "Export blocked: this document version has no current engineer sign-off. Review the findings and sign off again."
        )
    return signoff


def _check_draft_role(include_unapproved, role):
    if include_unapproved and role != "admin":
        raise ExportForbiddenError("Only an admin may export unapproved draft findings.")


def prepare_document_export(
    rows, project_id, document, *, user_id, role, include_unapproved=False
):
    """Apply sign-off and review filtering consistently to one document export."""
    _check_draft_role(include_unapproved, role)
    by_id, by_name = _review_index(project_id, document["document_id"], user_id)
    prepared = []
    for row in rows:
        review = by_id.get(str(row.get("entity_id"))) if row.get("entity_id") is not None else None
        if review is None:
            review = next((by_name.get(name) for name in _names(row) if by_name.get(name)), None)
        annotated = _annotate_row(row, review, include_unapproved=include_unapproved)
        if annotated is not None:
            prepared.append(annotated)
    approved_count = sum(_approved(row["review_status"]) for row in prepared)
    excluded_count = max(0, len(rows) - len(prepared))
    if approved_count == 0:
        raise ExportBlockedError(EXPORT_BLOCKED_MESSAGE)
    signoff = _check_signoff(project_id, document, user_id)
    metadata = {
        "document_id": document["document_id"],
        "version": document["version"],
        "export_time": _timestamp(),
        "approved_count": approved_count,
        "excluded_count": excluded_count,
        "signed_off_by": signoff.get("signer"),
        "signed_off_at": signoff.get("signed_at"),
    }
    if include_unapproved:
        metadata["marker"] = "UNAPPROVED - DRAFT"
    return prepared, metadata


def prepare_project_traceability_export(
    rows, project_id, *, user_id, role, include_unapproved=False
):
    documents = {str(doc["document_id"]): doc for doc in list_project_documents(user_id, project_id)}
    prepared = []
    document_metadata = []
    total_approved = 0
    total_excluded = 0
    for document_id in dict.fromkeys(str(row.get("document_id")) for row in rows):
        document = documents.get(document_id)
        if document is None:
            continue
        scoped = [row for row in rows if str(row.get("document_id")) == document_id]
        scoped_prepared, metadata = prepare_document_export(
            scoped, project_id, document, user_id=user_id, role=role,
            include_unapproved=include_unapproved,
        )
        prepared.extend(scoped_prepared)
        document_metadata.append(metadata)
        total_approved += metadata["approved_count"]
        total_excluded += metadata["excluded_count"]
    if total_approved == 0:
        raise ExportBlockedError(EXPORT_BLOCKED_MESSAGE)
    metadata = {
        "documents": document_metadata,
        "export_time": _timestamp(),
        "approved_count": total_approved,
        "excluded_count": total_excluded,
    }
    if include_unapproved:
        metadata["marker"] = "UNAPPROVED - DRAFT"
    return prepared, metadata


def prepare_comparison_export(
    rows, project_id, baseline, current, *, user_id, role, include_unapproved=False
):
    _check_draft_role(include_unapproved, role)
    base_signoff = None
    current_signoff_record = None
    _base_ids, base_names = _review_index(project_id, baseline["document_id"], user_id)
    _current_ids, current_names = _review_index(project_id, current["document_id"], user_id)
    prepared = []
    excluded = 0
    for row in rows:
        change_type = row.get("change_type")
        base_review = next((base_names.get(name) for name in _names(row) if base_names.get(name)), None)
        current_review = next((current_names.get(name) for name in _names(row) if current_names.get(name)), None)
        if change_type == "added":
            review = current_review
        elif change_type == "removed":
            review = base_review
        elif base_review and current_review and _approved(base_review["status"]) and _approved(current_review["status"]):
            review = current_review
        else:
            review = base_review if base_review and not _approved(base_review["status"]) else current_review
        annotated = _annotate_row(row, review, include_unapproved=include_unapproved)
        if annotated is None:
            excluded += 1
            continue
        prepared.append(annotated)
    approved_count = sum(_approved(row["review_status"]) for row in prepared)
    if approved_count == 0:
        raise ExportBlockedError(EXPORT_BLOCKED_MESSAGE)
    base_signoff = _check_signoff(project_id, baseline, user_id)
    current_signoff_record = _check_signoff(project_id, current, user_id)
    metadata = {
        "documents": [
            {"document_id": baseline["document_id"], "version": baseline["version"],
             "signed_off_by": base_signoff.get("signer"), "signed_off_at": base_signoff.get("signed_at")},
            {"document_id": current["document_id"], "version": current["version"],
             "signed_off_by": current_signoff_record.get("signer"), "signed_off_at": current_signoff_record.get("signed_at")},
        ],
        "export_time": _timestamp(),
        "approved_count": approved_count,
        "excluded_count": excluded,
    }
    if include_unapproved:
        metadata["marker"] = "UNAPPROVED - DRAFT"
    return prepared, metadata


def export_json_bytes(payload, filename=None, metadata=None):
    if metadata is not None:
        return json.dumps({"metadata": metadata, "records": payload}, ensure_ascii=False, indent=2).encode("utf-8")
    return json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")


def export_csv_bytes(rows, filename=None, metadata=None):
    if not rows:
        rows = [{"message": "No records available"}]
    output = io.StringIO()
    fieldnames = []
    for row in rows:
        for key in row:
            if key not in fieldnames:
                fieldnames.append(key)
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({key: row.get(key, "") for key in fieldnames})
    content = output.getvalue()
    if metadata is not None:
        marker = "# UNAPPROVED - DRAFT\n" if metadata.get("marker") else ""
        content = marker + "# export_metadata: " + json.dumps(metadata, ensure_ascii=False, sort_keys=True) + "\n" + content
    return content.encode("utf-8")
