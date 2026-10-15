import json

import pytest
from fastapi.testclient import TestClient

from backend.api import app
from backend.dependencies import create_access_token, decode_access_token
from database import access_control
from backend.routes import entities as entity_routes


@pytest.fixture
def authorized_document(tmp_path, monkeypatch):
    monkeypatch.setattr(access_control, "DATABASE_PATH", tmp_path / "access.sqlite3")
    access_control.init_db()
    created = access_control.bootstrap_admin("entity-admin", "a-long-test-password-123", "Entity Test")
    user_id, project_id = created["user_id"], created["project_id"]
    artifact_dir = tmp_path / "artifacts" / "doc-v1"
    artifact_dir.mkdir(parents=True)
    (artifact_dir / "pages.json").write_text(json.dumps([
        {"page_number": 1, "text": "WatchdogInterface is used by VehicleStateManager and PPort.", "extraction_method": "text"}
    ]), encoding="utf-8")
    # An empty legacy traceability artifact must not override the actual page text.
    (artifact_dir / "traceability.json").write_text("[]", encoding="utf-8")
    access_control.create_document_record(
        user_id, project_id, document_id="doc-v1", filename="hld.pdf", version=1,
        page_count=1, chunk_count=1, artifact_dir=artifact_dir,
    )
    return create_access_token(user_id), project_id


def test_entity_recognition_endpoint_requires_authentication(authorized_document):
    _token, project_id = authorized_document
    with TestClient(app) as client:
        response = client.post(f"/api/projects/{project_id}/documents/doc-v1/entities/recognize")
    assert response.status_code == 401


def test_entity_recognition_endpoint_returns_cached_scoped_entities(authorized_document):
    token, project_id = authorized_document
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    with TestClient(app) as client:
        response = client.post(f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=1&force=false", headers=headers)
        listed = client.get(f"/api/projects/{project_id}/documents/doc-v1/entities", headers=headers)
        entity = next(item for item in response.json()["entities"] if item["name"] == "PPort")
        detail = client.get(f"/api/projects/{project_id}/documents/doc-v1/entities/{entity['entity_id']}", headers=headers)
        exported = client.get(f"/api/projects/{project_id}/documents/doc-v1/entities/export/csv", headers=headers)
        wrong_project = client.get("/api/projects/99999/documents/doc-v1/entities", headers=headers)

    assert response.status_code == 200
    records = response.json()["entities"]
    assert {record["name"] for record in records} >= {"WatchdogInterface", "VehicleStateManager", "PPort"}
    assert all(record["project_id"] == project_id for record in records)
    assert listed.json()["cached"] is True
    assert detail.json()["name"] == "PPort"
    assert detail.json()["source_evidence"][0]["page"] == 1
    assert exported.status_code == 409
    assert exported.json()["error"]["message"] == "Export blocked: no findings have been approved by an authorized engineer."
    assert wrong_project.status_code == 403


def test_recognition_rejects_mismatched_document_version(authorized_document):
    token, project_id = authorized_document
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        response = client.post(
            f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=2", headers=headers
        )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "document_version_mismatch"


def test_recognition_validation_error_identifies_field_without_echoing_value(authorized_document):
    token, project_id = authorized_document
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        response = client.post(
            f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=not-a-version", headers=headers
        )
    assert response.status_code == 400
    assert "query.version" in response.json()["error"]["message"]
    assert "not-a-version" not in response.text


def test_force_rebuild_bypasses_valid_cache(authorized_document):
    token, project_id = authorized_document
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        first = client.post(
            f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=1", headers=headers
        )
        cached = client.post(
            f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=1", headers=headers
        )
        rebuilt = client.post(
            f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=1&force=true", headers=headers
        )
    assert first.status_code == cached.status_code == rebuilt.status_code == 200
    assert first.json()["cached"] is False
    assert cached.json()["cached"] is True
    assert rebuilt.json()["cached"] is False


def test_changed_page_source_invalidates_cache(authorized_document, tmp_path, monkeypatch):
    token, project_id = authorized_document
    headers = {"Authorization": f"Bearer {token}"}
    # Resolve this test's artifact directory from the fixture database row.
    monkeypatch.setattr(access_control, "DATABASE_PATH", tmp_path / "access.sqlite3")
    document = access_control.get_project_document(decode_access_token(token), project_id, "doc-v1")
    page_path = document["artifact_dir"] + "/pages.json"
    with TestClient(app) as client:
        first = client.post(
            f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=1", headers=headers
        )
        with open(page_path, "w", encoding="utf-8") as file:
            json.dump([{"page_number": 2, "text": "RPort is required here.", "extraction_method": "text"}], file)
        stale = client.get(f"/api/projects/{project_id}/documents/doc-v1/entities", headers=headers)
        refreshed = client.post(
            f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=1", headers=headers
        )
    assert first.status_code == refreshed.status_code == 200
    assert stale.json()["status"] == "not_processed"
    assert {entity["name"] for entity in refreshed.json()["entities"]} == {"RPort"}


def test_ocr_warning_does_not_discard_entities_from_readable_pages(authorized_document, tmp_path, monkeypatch):
    token, project_id = authorized_document
    headers = {"Authorization": f"Bearer {token}"}
    monkeypatch.setattr(access_control, "DATABASE_PATH", tmp_path / "access.sqlite3")
    document = access_control.get_project_document(decode_access_token(token), project_id, "doc-v1")
    page_path = document["artifact_dir"] + "/pages.json"
    with open(page_path, "w", encoding="utf-8") as file:
        json.dump([
            {"page_number": 22, "text": "WatchdogInterface provides service through PPort and RPort.", "extraction_method": "text"},
            {"page_number": 23, "text": "", "extraction_method": "ocr"},
        ], file)
    monkeypatch.setattr(entity_routes, "_ocr_runtime_unavailable", lambda: True)
    with TestClient(app) as client:
        response = client.post(
            f"/api/projects/{project_id}/documents/doc-v1/entities/recognize?version=1", headers=headers
        )
    payload = response.json()
    assert response.status_code == 200
    assert payload["status"] == "completed_with_warnings"
    assert {item["name"] for item in payload["entities"]} >= {"WatchdogInterface", "PPort", "RPort"}
    assert payload["warnings"][0]["pages"] == [23]
    assert "Tesseract" in payload["warnings"][0]["message"]
