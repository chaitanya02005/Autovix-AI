import json

from extraction.entity_recognition import (
    load_recognized_entities,
    recognize_entities,
    recognition_source_digest,
    save_recognized_entities,
)


def test_recognizes_supported_names_and_preserves_provenance(tmp_path):
    pages = [
        {"page_number": 22, "extraction_method": "text", "text": "2. Interfaces\nWatchdogInterface connects to PPort and RPort."},
        {"page_number": 23, "extraction_method": "ocr", "text": "VehicleStateManager uses WatchdogInterface."},
    ]
    entities = recognize_entities(pages, project_id=7, document_id="doc-a", document_version=2)
    by_name = {entity["name"]: entity for entity in entities}

    assert {"WatchdogInterface", "PPort", "RPort", "VehicleStateManager"} <= set(by_name)
    assert by_name["PPort"]["entity_type"] == "Port"
    assert by_name["RPort"]["entity_type"] == "Port"
    assert by_name["PPort"]["entity_id"] != by_name["RPort"]["entity_id"]
    assert by_name["WatchdogInterface"]["source_pages"] == [22, 23]
    assert by_name["WatchdogInterface"]["source_evidence"][0]["page"] == 22
    assert "WatchdogInterface" in by_name["WatchdogInterface"]["source_evidence"][0]["excerpt"]
    assert by_name["VehicleStateManager"]["project_id"] == 7
    assert by_name["VehicleStateManager"]["document_id"] == "doc-a"
    assert by_name["VehicleStateManager"]["document_version"] == 2
    assert by_name["VehicleStateManager"]["extraction_method"] == "ocr"


def test_deduplicates_mentions_without_inventing_for_generic_text():
    pages = [
        {"page_number": 1, "text": "WatchdogInterface WatchdogInterface PPort"},
        {"page_number": 2, "text": "No named architecture elements on this page."},
    ]
    entities = recognize_entities(pages, project_id=1, document_id="doc", document_version=1)
    by_name = {entity["name"]: entity for entity in entities}
    assert set(by_name) == {"WatchdogInterface", "PPort"}
    assert by_name["WatchdogInterface"]["source_pages"] == [1]
    assert len(by_name["WatchdogInterface"]["source_evidence"]) == 1


def test_recognizes_named_data_and_behavior_entities_only_when_explicit():
    pages = [{
        "page_number": 8,
        "text": "WheelSpeedSignal has type WheelSpeedDataType. ReadSpeedOperation emits SpeedChangedEvent for VehicleServiceInstance. CabinAdaptiveApplication follows functional flow design.",
    }]
    entities = recognize_entities(pages, project_id=1, document_id="doc", document_version=1)
    by_name = {entity["name"]: entity["entity_type"] for entity in entities}
    assert by_name == {
        "WheelSpeedSignal": "Data Element",
        "WheelSpeedDataType": "Data Type",
        "ReadSpeedOperation": "Operation",
        "SpeedChangedEvent": "Event",
        "VehicleServiceInstance": "Service",
        "CabinAdaptiveApplication": "Software Component",
        "functional flow": "Architecture Concept",
    }


def test_cache_round_trip_and_invalid_version(tmp_path):
    records = [{"entity_id": "one", "name": "PPort"}]
    save_recognized_entities(tmp_path, records)
    assert load_recognized_entities(tmp_path) == records
    path = tmp_path / "entities.json"
    path.write_text(json.dumps({"recognition_version": -1, "entities": records}), encoding="utf-8")
    assert load_recognized_entities(tmp_path) is None


def test_cache_is_scoped_to_document_version_and_source(tmp_path):
    pages = [{"page_number": 1, "text": "PPort", "extraction_method": "text"}]
    digest = recognition_source_digest(pages)
    records = recognize_entities(pages, project_id=1, document_id="doc-v1", document_version=1)
    save_recognized_entities(
        tmp_path, records, project_id=1, document_id="doc-v1", document_version=1, source_digest=digest
    )
    assert load_recognized_entities(
        tmp_path, project_id=1, document_id="doc-v1", document_version=1, source_digest=digest
    ) == records
    assert load_recognized_entities(
        tmp_path, project_id=1, document_id="doc-v2", document_version=2, source_digest=digest
    ) is None
    assert load_recognized_entities(
        tmp_path, project_id=1, document_id="doc-v1", document_version=1,
        source_digest=recognition_source_digest([{**pages[0], "text": "RPort"}]),
    ) is None


def test_empty_completed_result_is_a_valid_cache_entry(tmp_path):
    pages = [{"page_number": 1, "text": "Ordinary prose without supported names."}]
    cache_key = {
        "project_id": 3,
        "document_id": "textbook-v1",
        "document_version": 1,
        "source_digest": recognition_source_digest(pages),
    }
    save_recognized_entities(tmp_path, [], **cache_key)
    assert load_recognized_entities(tmp_path, **cache_key) == []


def test_empty_source_does_not_create_entities():
    assert recognize_entities(
        [{"page_number": 1, "text": "   "}], project_id=1, document_id="doc", document_version=1
    ) == []
