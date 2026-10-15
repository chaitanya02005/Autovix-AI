"""SQLite-backed review records with a read-only migration from old JSON logs."""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from database.access_control import (
    PROJECT_ROOT,
    _connect,
    can_review,
    init_db,
    require_project_access,
)

REVIEW_FILE = PROJECT_ROOT / "data" / "processed" / "review_log.json"
VALID_ITEM_TYPES = {"entity", "answer"}
VALID_STATUSES = {"pending", "approved", "rejected", "corrected"}


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _review_file(project_id=None):
    if project_id is None:
        return REVIEW_FILE
    return PROJECT_ROOT / "data" / "processed" / "projects" / str(project_id) / "review_log.json"


def _migrate_legacy_reviews():
    """Import each existing JSON log once and leave its contents untouched."""
    init_db()
    paths = [REVIEW_FILE, *sorted((PROJECT_ROOT / "data" / "processed" / "projects").glob("*/review_log.json"))]
    with _connect() as connection:
        for path in paths:
            if not path.is_file():
                continue
            source_path = str(path.resolve())
            migrated = connection.execute(
                "SELECT 1 FROM review_migrations WHERE source_path = ?", (source_path,)
            ).fetchone()
            if migrated:
                continue
            try:
                entries = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                entries = []
            if not isinstance(entries, list):
                entries = []
            folder_project_id = None
            if path.parent.name.isdigit():
                folder_project_id = int(path.parent.name)
            for index, entry in enumerate(entries):
                if not isinstance(entry, dict):
                    continue
                project_id = entry.get("project_id") or folder_project_id
                if not project_id:
                    continue
                answer = str(entry.get("answer") or entry.get("original_value") or "")
                if not answer:
                    continue
                item_id = str(entry.get("review_id") or hashlib.sha256(
                    f"{source_path}:{index}:{answer}".encode("utf-8")
                ).hexdigest()[:32])
                status = "approved" if entry.get("review_status") == "approved" else "pending"
                timestamp = entry.get("timestamp") or _now()
                metadata = {
                    "question": entry.get("question", ""),
                    "confidence": entry.get("confidence") or {},
                    "legacy_review_id": entry.get("review_id"),
                }
                connection.execute(
                    """INSERT OR IGNORE INTO reviews
                       (project_id, document_id, item_type, item_id, status, original_value,
                        corrected_value, reviewer_user_id, comment, item_metadata, created_at, updated_at)
                       VALUES (?, ?, 'answer', ?, ?, ?, NULL, ?, NULL, ?, ?, ?)""",
                    (int(project_id), entry.get("document_id"), item_id, status, answer,
                     entry.get("user_id"), json.dumps(metadata, ensure_ascii=False), timestamp,
                     entry.get("updated_at") or timestamp),
                )
            connection.execute(
                "INSERT OR IGNORE INTO review_migrations (source_path, migrated_at) VALUES (?, ?)",
                (source_path, _now()),
            )


def _record(row):
    if row is None:
        return None
    result = dict(row)
    try:
        result["item_metadata"] = json.loads(result.get("item_metadata") or "{}")
    except json.JSONDecodeError:
        result["item_metadata"] = {}
    result["reviewer"] = result.pop("reviewer_username", None)
    return result


def _get_row(connection, project_id, document_id, item_type, item_id):
    return connection.execute(
        """SELECT r.*, u.username AS reviewer_username FROM reviews r
           LEFT JOIN users u ON u.id = r.reviewer_user_id
           WHERE r.project_id = ? AND r.document_id IS ? AND r.item_type = ? AND r.item_id = ?""",
        (int(project_id), document_id, item_type, str(item_id)),
    ).fetchone()


def ensure_item_review(project_id, document_id, item_type, item_id, original_value, item_metadata=None):
    if item_type not in VALID_ITEM_TYPES:
        raise ValueError("Review item type must be entity or answer.")
    _migrate_legacy_reviews()
    now = _now()
    with _connect() as connection:
        connection.execute(
            """INSERT INTO reviews
               (project_id, document_id, item_type, item_id, status, original_value,
                item_metadata, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
               ON CONFLICT(project_id, document_id, item_type, item_id) DO UPDATE SET
                 original_value = excluded.original_value,
                 item_metadata = excluded.item_metadata,
                 updated_at = CASE
                   WHEN reviews.original_value != excluded.original_value
                     OR reviews.item_metadata != excluded.item_metadata
                   THEN excluded.updated_at ELSE reviews.updated_at END""",
            (int(project_id), document_id, item_type, str(item_id), str(original_value),
             json.dumps(item_metadata or {}, ensure_ascii=False, sort_keys=True), now, now),
        )
        return _record(_get_row(connection, project_id, document_id, item_type, item_id))


def create_item_review(
    project_id, document_id, item_type, item_id, original_value, item_metadata=None, *, user_id=None
):
    if user_id is None:
        raise PermissionError("Review submission requires an authorized project user.")
    require_project_access(user_id, project_id)
    return ensure_item_review(
        project_id, document_id, item_type, item_id, original_value, item_metadata
    )


def list_document_reviews(project_id, document_id, *, status=None, item_type=None, user_id=None):
    if user_id is None:
        raise ValueError("Review reads require an authorized user and project.")
    require_project_access(user_id, project_id)
    if status is not None and status not in VALID_STATUSES:
        raise ValueError("Unknown review status.")
    if item_type is not None and item_type not in VALID_ITEM_TYPES:
        raise ValueError("Unknown review item type.")
    _migrate_legacy_reviews()
    clauses = ["r.project_id = ?", "r.document_id = ?"]
    values = [int(project_id), str(document_id)]
    if status:
        clauses.append("r.status = ?")
        values.append(status)
    if item_type:
        clauses.append("r.item_type = ?")
        values.append(item_type)
    with _connect() as connection:
        rows = connection.execute(
            """SELECT r.*, u.username AS reviewer_username FROM reviews r
               LEFT JOIN users u ON u.id = r.reviewer_user_id WHERE """
            + " AND ".join(clauses) + " ORDER BY r.updated_at DESC, r.id DESC",
            values,
        ).fetchall()
    return [_record(row) for row in rows]


def list_project_item_reviews(project_id, *, status=None, item_type=None, user_id=None):
    if user_id is None:
        raise ValueError("Review reads require an authorized user and project.")
    require_project_access(user_id, project_id)
    _migrate_legacy_reviews()
    clauses = ["r.project_id = ?"]
    values = [int(project_id)]
    if status:
        clauses.append("r.status = ?")
        values.append(status)
    if item_type:
        clauses.append("r.item_type = ?")
        values.append(item_type)
    with _connect() as connection:
        rows = connection.execute(
            """SELECT r.*, u.username AS reviewer_username FROM reviews r
               LEFT JOIN users u ON u.id = r.reviewer_user_id WHERE """
            + " AND ".join(clauses) + " ORDER BY r.updated_at DESC, r.id DESC",
            values,
        ).fetchall()
    return [_record(row) for row in rows]


def review_status_map(project_id, document_id, *, user_id):
    return {
        (record["item_type"], record["item_id"]): record
        for record in list_document_reviews(project_id, document_id, user_id=user_id)
    }


def update_item_review(
    project_id, document_id, item_type, item_id, status, *, user_id, comment=None, corrected_value=None
):
    if status not in VALID_STATUSES or status == "pending":
        raise ValueError("Review action must approve, reject, or correct an item.")
    if status == "rejected" and not str(comment or "").strip():
        raise ValueError("A comment is required to reject an item.")
    if status == "corrected" and (not str(comment or "").strip() or corrected_value is None):
        raise ValueError("A corrected value and comment are required.")
    if not can_review(user_id, project_id):
        raise PermissionError("Review requires an authorized project architect or admin.")
    require_project_access(user_id, project_id)
    _migrate_legacy_reviews()
    now = _now()
    with _connect() as connection:
        existing = _get_row(connection, project_id, document_id, item_type, item_id)
        if existing is None:
            raise KeyError("Review item not found.")
        connection.execute(
            """UPDATE reviews SET status = ?, corrected_value = ?, reviewer_user_id = ?,
               comment = ?, updated_at = ? WHERE id = ?""",
            (status, corrected_value if status == "corrected" else None, user_id,
             str(comment).strip() if comment is not None else None, now, existing["id"]),
        )
        return _record(_get_row(connection, project_id, document_id, item_type, item_id))


def review_summary(project_id, document_id, *, user_id):
    records = list_document_reviews(project_id, document_id, user_id=user_id)
    return {status: sum(record["status"] == status for record in records) for status in VALID_STATUSES}


def findings_digest(project_id, document_id, *, user_id):
    records = list_document_reviews(project_id, document_id, user_id=user_id)
    snapshot = [
        {
            "item_type": row["item_type"], "item_id": row["item_id"],
            "status": row["status"], "original_value": row["original_value"],
            "corrected_value": row["corrected_value"], "comment": row["comment"],
            "reviewer_user_id": row["reviewer_user_id"],
            "item_metadata": row["item_metadata"], "updated_at": row["updated_at"],
        }
        for row in sorted(records, key=lambda item: (item["item_type"], item["item_id"]))
    ]
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def create_signoff(project_id, document_id, document_version, *, user_id):
    project = require_project_access(user_id, project_id)
    digest = findings_digest(project["id"], document_id, user_id=user_id)
    now = _now()
    with _connect() as connection:
        cursor = connection.execute(
            """INSERT INTO signoffs
               (project_id, document_id, document_version, findings_digest, signed_by, signed_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (project["id"], str(document_id), int(document_version), digest, int(user_id), now),
        )
        row = connection.execute(
            """SELECT s.*, u.username AS signer FROM signoffs s
               JOIN users u ON u.id = s.signed_by WHERE s.id = ?""",
            (cursor.lastrowid,),
        ).fetchone()
    return dict(row)


def current_signoff(project_id, document_id, document_version, *, user_id):
    project = require_project_access(user_id, project_id)
    digest = findings_digest(project["id"], document_id, user_id=user_id)
    with _connect() as connection:
        row = connection.execute(
            """SELECT s.*, u.username AS signer FROM signoffs s
               JOIN users u ON u.id = s.signed_by
               WHERE s.project_id = ? AND s.document_id = ? AND s.document_version = ?
               ORDER BY s.id DESC LIMIT 1""",
            (project["id"], str(document_id), int(document_version)),
        ).fetchone()
    if row is None:
        return None
    result = dict(row)
    result["valid"] = result["findings_digest"] == digest
    return result


def save_review(question, answer, confidence, review_status, *, user_id=None, project_id=None):
    if review_status not in {"approved", "needs_review", "pending"}:
        raise ValueError("Review status must be approved or pending.")
    if user_id is None or project_id is None or not can_review(user_id, project_id):
        raise PermissionError("Review requires an authorized project architect or admin.")
    project = require_project_access(user_id, project_id)
    item_id = uuid.uuid4().hex
    record = ensure_item_review(
        project["id"], None, "answer", item_id, answer,
        {"question": question, "confidence": confidence or {}},
    )
    if review_status == "approved":
        return update_item_review(
            project["id"], None, "answer", item_id, "approved", user_id=user_id
        )
    return record


def update_review_status(review_id, review_status, *, user_id=None, project_id=None):
    if review_status not in {"approved", "needs_review", "pending"}:
        raise ValueError("Review status must be approved or needs_review.")
    if user_id is None or project_id is None or not can_review(user_id, project_id):
        raise PermissionError("Review requires an authorized project architect or admin.")
    record = next((item for item in list_project_item_reviews(
        project_id, user_id=user_id, item_type="answer"
    ) if item["item_id"] == str(review_id) or item["item_metadata"].get("legacy_review_id") == review_id), None)
    if record is None:
        raise KeyError("Review not found.")
    mapped = "approved" if review_status == "approved" else "pending"
    return update_item_review(
        project_id, record["document_id"], record["item_type"], record["item_id"], mapped,
        user_id=user_id,
    )


def _legacy_review(record):
    metadata = record["item_metadata"]
    return {
        "question": metadata.get("question", ""),
        "answer": record["corrected_value"] or record["original_value"],
        "confidence": metadata.get("confidence", {}),
        "timestamp": record["created_at"],
        "updated_at": record["updated_at"],
        "review_status": "needs_review" if record["status"] == "pending" else record["status"],
        "review_id": metadata.get("legacy_review_id") or record["item_id"],
        "user_id": record["reviewer_user_id"],
        "project_id": record["project_id"],
    }


def list_reviews(limit=20, *, user_id=None, project_id=None):
    records = list_project_item_reviews(project_id, user_id=user_id, item_type="answer")
    legacy = [_legacy_review(record) for record in records]
    return legacy[-max(1, int(limit)):]
