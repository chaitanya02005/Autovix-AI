"""Evidence-preserving entity records derived from the existing page extractor."""

import hashlib
import json
import re
from pathlib import Path

from extraction.architecture_extractor import extract_architecture_entities


ENTITY_TYPES = {
    "components": "Software Component",
    "interfaces": "Interface",
    "ports": "Port",
    "services": "Service",
    "architecture_views": "Architecture Concept",
    "architecture_concepts": "Architecture Concept",
    "data_elements": "Data Element",
    "data_types": "Data Type",
    "operations": "Operation",
    "events": "Event",
}
RECOGNITION_VERSION = 3


def _section_for_line(lines, line_index):
    """Return the nearest explicit heading, without guessing from prose."""
    for candidate in reversed(lines[:line_index]):
        line = candidate.strip()
        if not line:
            continue
        if line.startswith("#"):
            return line.lstrip("# ").strip() or None
        if len(line) <= 100 and (line.isupper() or re.match(r"^\d+(?:\.\d+)*\s+\S", line)):
            return line.strip(" .:-")
        # A non-heading prose line means earlier headings are still valid.
        # Continue scanning as a heading can be separated by body content.
    return None


def recognize_entities(pages, *, project_id, document_id, document_version, traceability_records=None):
    """Group explicitly extracted names while retaining per-page evidence."""
    grouped = {}
    for page in pages:
        text = str(page.get("text") or "")
        if not text.strip():
            continue
        page_number = page.get("page_number")
        lines = text.splitlines()
        if traceability_records is None:
            extracted = extract_architecture_entities(text)
        else:
            extracted = {}
            for record in traceability_records:
                if record.get("page") != page_number:
                    continue
                category = record.get("type")
                name = record.get("entity")
                if category in ENTITY_TYPES and isinstance(name, str):
                    extracted.setdefault(category, []).append(name)
        for category, names in extracted.items():
            entity_type = ENTITY_TYPES.get(category)
            if not entity_type:
                continue
            for name in names:
                canonical = " ".join(str(name).split())
                if not canonical:
                    continue
                key = (entity_type.casefold(), canonical.casefold())
                record = grouped.setdefault(key, {
                    "name": canonical,
                    "entity_type": entity_type,
                    "original_names": [],
                    "source_pages": [],
                    "source_evidence": [],
                    "source_sections": [],
                    "extraction_methods": [],
                })
                if canonical not in record["original_names"]:
                    record["original_names"].append(canonical)
                if page_number not in record["source_pages"]:
                    record["source_pages"].append(page_number)

                pattern = re.compile(r"(?<![A-Za-z0-9_])" + re.escape(canonical) + r"(?![A-Za-z0-9_])", re.IGNORECASE)
                for line_index, line in enumerate(lines):
                    if not pattern.search(line):
                        continue
                    excerpt = " ".join(line.split())[:500]
                    section = _section_for_line(lines, line_index)
                    evidence = {"page": page_number, "excerpt": excerpt}
                    if section:
                        evidence["section"] = section
                    if evidence not in record["source_evidence"]:
                        record["source_evidence"].append(evidence)
                    if section and section not in record["source_sections"]:
                        record["source_sections"].append(section)
                    break

                method = page.get("extraction_method", "text")
                if method not in record["extraction_methods"]:
                    record["extraction_methods"].append(method)

    entities = []
    for record in grouped.values():
        record["source_pages"].sort(key=lambda page: (isinstance(page, str), page))
        identity = f"{project_id}:{document_id}:{document_version}:{record['entity_type'].casefold()}:{record['name'].casefold()}"
        record.update({
            "entity_id": hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24],
            "project_id": int(project_id),
            "document_id": str(document_id),
            "document_version": document_version,
            "source_section": record["source_sections"][0] if record["source_sections"] else None,
            "extraction_method": ", ".join(record["extraction_methods"]),
            "extraction_status": "extracted",
            "review_status": "Pending Review",
            "confidence": None,
        })
        entities.append(record)
    return entities


def recognition_source_digest(pages):
    """Fingerprint the exact extracted page source used by recognition."""
    source = [
        {
            "page_number": page.get("page_number"),
            "text": str(page.get("text") or ""),
            "extraction_method": page.get("extraction_method", "text"),
        }
        for page in pages
    ]
    encoded = json.dumps(source, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def load_recognized_entities(
    artifact_dir, *, project_id=None, document_id=None, document_version=None, source_digest=None
):
    path = Path(artifact_dir) / "entities.json"
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or payload.get("recognition_version") != RECOGNITION_VERSION:
        return None
    expected = {
        "project_id": int(project_id) if project_id is not None else None,
        "document_id": str(document_id) if document_id is not None else None,
        "document_version": document_version,
        "source_digest": source_digest,
    }
    metadata = payload.get("cache_key", {})
    if any(value is not None and metadata.get(key) != value for key, value in expected.items()):
        return None
    entities = payload.get("entities")
    return entities if isinstance(entities, list) else None


def save_recognized_entities(
    artifact_dir, entities, *, project_id=None, document_id=None, document_version=None, source_digest=None
):
    path = Path(artifact_dir) / "entities.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".json.tmp")
    with temporary.open("w", encoding="utf-8") as file:
        json.dump({
            "recognition_version": RECOGNITION_VERSION,
            "cache_key": {
                "project_id": int(project_id) if project_id is not None else None,
                "document_id": str(document_id) if document_id is not None else None,
                "document_version": document_version,
                "source_digest": source_digest,
            },
            "entities": entities,
        }, file, indent=2, ensure_ascii=False)
    temporary.replace(path)
    return path
