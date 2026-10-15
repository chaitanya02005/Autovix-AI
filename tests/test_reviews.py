import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend.api import app
from backend.dependencies import create_access_token, decode_access_token
from database import access_control, review_store


@pytest.fixture
def review_project(tmp_path, monkeypatch):
    monkeypatch.setattr(access_control, "DATABASE_PATH", tmp_path / "access.sqlite3")
    access_control.init_db()
    created = access_control.bootstrap_admin("review-admin", "long-test-password-admin", "Review Test")
    admin_id, project_id = created["user_id"], created["project_id"]
    architect = access_control.create_user(admin_id, "review-architect", "long-test-password-architect", "architect")
    viewer = access_control.create_user(admin_id, "review-viewer", "long-test-password-viewer", "viewer")
    access_control.add_project_member(admin_id, project_id, architect["username"], "architect")
    access_control.add_project_member(admin_id, project_id, viewer["username"], "viewer")
    artifact_dir = tmp_path / "artifacts" / "doc-review"
    artifact_dir.mkdir(parents=True)
    (artifact_dir / "pages.json").write_text(json.dumps([
        {"page_number": 4, "text": "WatchdogInterface connects to PPort.", "extraction_method": "text"}
    ]), encoding="utf-8")
    access_control.create_document_record(
        admin_id, project_id, document_id="doc-review", filename="hld.pdf", version=1,
        page_count=1, chunk_count=1, artifact_dir=artifact_dir,
    )
    return {
        "project_id": project_id,
        "admin": create_access_token(admin_id),
        "architect": create_access_token(architect["id"]),
        "viewer": create_access_token(viewer["id"]),
    }


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_entity_review_status_is_created_and_persists(review_project):
    project_id = review_project["project_id"]
    with TestClient(app) as client:
        recognized = client.post(
            f"/api/projects/{project_id}/documents/doc-review/entities/recognize",
            headers=_headers(review_project["admin"]),
        )
        entity = next(row for row in recognized.json()["entities"] if row["name"] == "PPort")
        queue = client.get(
            f"/api/projects/{project_id}/documents/doc-review/reviews",
            headers=_headers(review_project["viewer"]),
        )
        denied = client.post(
            f"/api/projects/{project_id}/documents/doc-review/reviews/entity/{entity['entity_id']}/approve",
            headers=_headers(review_project["viewer"]),
        )
        approved = client.post(
            f"/api/projects/{project_id}/documents/doc-review/reviews/entity/{entity['entity_id']}/approve",
            headers=_headers(review_project["architect"]),
        )
        entity_list = client.get(
            f"/api/projects/{project_id}/documents/doc-review/entities",
            headers=_headers(review_project["viewer"]),
        )

    assert recognized.status_code == 200
    assert entity["review_status"] == "pending"
    assert queue.status_code == 200
    assert any(row["item_id"] == entity["entity_id"] for row in queue.json())
    assert denied.status_code == 403
    assert approved.status_code == 200
    assert next(row for row in entity_list.json()["entities"] if row["entity_id"] == entity["entity_id"])["review_status"] == "approved"


def test_reject_and_correct_require_comment_and_are_logged(review_project, tmp_path, monkeypatch):
    from database import audit_log

    monkeypatch.setattr(audit_log, "AUDIT_DB_PATH", tmp_path / "audit.sqlite3")
    project_id = review_project["project_id"]
    headers = _headers(review_project["architect"])
    with TestClient(app) as client:
        client.post(f"/api/projects/{project_id}/documents/doc-review/entities/recognize", headers=headers)
        item_id = client.get(f"/api/projects/{project_id}/documents/doc-review/reviews", headers=headers).json()[0]["item_id"]
        rejected = client.post(
            f"/api/projects/{project_id}/documents/doc-review/reviews/entity/{item_id}/reject",
            json={}, headers=headers,
        )
        corrected = client.post(
            f"/api/projects/{project_id}/documents/doc-review/reviews/entity/{item_id}/correct",
            json={"corrected_value": "PPort2", "comment": "Verified against the interface table."},
            headers=headers,
        )
        summary = client.get(f"/api/projects/{project_id}/documents/doc-review/reviews/summary", headers=headers)
    assert rejected.status_code == 400
    assert corrected.status_code == 200
    assert corrected.json()["status"] == "corrected"
    assert summary.json()["corrected"] == 1
    connection = sqlite3.connect(tmp_path / "audit.sqlite3")
    event = connection.execute(
        "SELECT details FROM audit_log WHERE event_type = 'REVIEW_ACTION' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    connection.close()
    assert str(decode_access_token(review_project["architect"])) in event[0]


def test_saved_answer_can_be_submitted_for_review(review_project):
    project_id = review_project["project_id"]
    with TestClient(app) as client:
        submitted = client.post(
            f"/api/projects/{project_id}/documents/doc-review/reviews",
            json={"item_type": "answer", "original_value": "The interface uses a client port.",
                  "item_metadata": {"question": "How is it connected?"}},
            headers=_headers(review_project["viewer"]),
        )
        queue = client.get(
            f"/api/projects/{project_id}/documents/doc-review/reviews?item_type=answer",
            headers=_headers(review_project["viewer"]),
        )
    assert submitted.status_code == 201
    assert submitted.json()["status"] == "pending"
    assert queue.json()[0]["item_metadata"]["question"] == "How is it connected?"


def test_legacy_json_migration_preserves_backup(review_project, tmp_path, monkeypatch):
    project_id = review_project["project_id"]
    migration_root = tmp_path / "migration"
    legacy_path = migration_root / "data" / "processed" / "review_log.json"
    legacy_path.parent.mkdir(parents=True)
    content = json.dumps([{
        "review_id": "legacy-1", "project_id": project_id, "document_id": "doc-review",
        "question": "What is the interface?", "answer": "It is a client/server interface.",
        "review_status": "approved", "user_id": decode_access_token(review_project["admin"]),
        "timestamp": "2026-01-01T00:00:00Z",
    }], indent=2)
    legacy_path.write_text(content, encoding="utf-8")
    monkeypatch.setattr(review_store, "PROJECT_ROOT", migration_root)
    monkeypatch.setattr(review_store, "REVIEW_FILE", legacy_path)

    review_store._migrate_legacy_reviews()
    review_store._migrate_legacy_reviews()
    rows = review_store.list_document_reviews(
        project_id, "doc-review", user_id=decode_access_token(review_project["admin"]), item_type="answer"
    )
    assert legacy_path.read_text(encoding="utf-8") == content
    assert len(rows) == 1
    assert rows[0]["status"] == "approved"
    assert rows[0]["item_metadata"]["question"] == "What is the interface?"
