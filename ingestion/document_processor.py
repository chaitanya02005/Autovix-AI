from pathlib import Path
import tempfile
import json
import uuid

PROJECT_ROOT = Path(__file__).resolve().parent.parent

from ingestion.pdf_parser import extract_text_from_pdf
from ingestion.chunker import build_section_tree, create_chunks, _section_path
from ingestion.table_extractor import create_table_chunks, extract_tables_from_pdf
from extraction.traceability import extract_traceable_entities
from rag.uploaded_document_db import build_uploaded_database
from database.versioning import get_document_version
from database.access_control import (
    can_upload,
    create_document_record,
    project_collection_name,
    require_project_access,
)

EMPTY_UPLOAD_MESSAGE = "Uploaded file is empty (0 bytes). Please select a valid PDF."


def extract_document_metadata(pages):
    """Extract explicit title and author text from the opening pages."""
    opening_lines = []
    for page in pages[:3]:
        opening_lines.extend(
            line.strip() for line in page.get("text", "").splitlines() if line.strip()
        )

    title_lines = []
    for line in opening_lines:
        if line.isdigit() or line.lower() in {"contents", "introduction"}:
            continue
        title_lines.append(line)
        if len(title_lines) == 2:
            break

    author = None
    for line in opening_lines:
        if line.isupper() and len(line.split()) >= 2 and len(line) <= 80:
            author = line.title()
            break

    return {
        "document_title": " ".join(title_lines) if title_lines else None,
        "author": author,
        "page_count": len(pages),
    }


def process_uploaded_pdf(uploaded_file, *, user_id=None, project_id=None):
    """Process a Streamlit UploadedFile and keep the data isolated per document version."""
    if uploaded_file is None:
        raise ValueError("No file was provided.")

    if not hasattr(uploaded_file, "getbuffer"):
        raise TypeError("Uploaded file does not contain a valid PDF stream.")

    if user_id is None or project_id is None or not can_upload(user_id, project_id):
        raise PermissionError("An authorized project architect or admin is required to upload documents.")
    project = require_project_access(user_id, project_id)
    filename = Path(uploaded_file.name).name
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF documents can be processed.")

    temp_dir = Path(tempfile.gettempdir()) / "autovix"
    temp_dir.mkdir(parents=True, exist_ok=True)

    pdf_path = temp_dir / f"project_{project['id']}_{uuid.uuid4().hex}_{filename}"
    try:
        payload = uploaded_file.getbuffer()
        payload_size = len(payload)
    except (TypeError, ValueError) as error:
        raise ValueError("Could not read the uploaded file. Please select a valid PDF.") from error
    if payload_size == 0:
        raise ValueError(EMPTY_UPLOAD_MESSAGE)

    with open(pdf_path, "wb") as file:
        file.write(payload)

    if pdf_path.stat().st_size == 0:
        raise ValueError(EMPTY_UPLOAD_MESSAGE)

    pages = extract_text_from_pdf(pdf_path)
    if not pages or not any(page.get("text", "").strip() for page in pages):
        raise ValueError("The uploaded PDF is empty or contains no extractable text.")

    sections = build_section_tree(pages)
    text_chunks = create_chunks(pages, source_file=filename)
    tables = extract_tables_from_pdf(pdf_path)
    table_chunks = create_table_chunks(tables, start_chunk_id=len(text_chunks))
    for table, chunk in zip(tables, table_chunks):
        page_number = table["page_number"]
        section = next((item for item in reversed(sections) if item["start_page"] <= page_number), None)
        path = _section_path(section, sections) if section else ""
        chunk.update({
            "page_start": page_number,
            "page_end": page_number,
            "section_number": section.get("section_number", "") if section else "",
            "section_title": section.get("title", "") if section else "",
            "section_path": path,
        })
        if path:
            chunk["text"] = f"{path}\n\n{chunk['text']}"
    chunks = text_chunks + table_chunks
    traceability = extract_traceable_entities(pages)
    document_metadata = extract_document_metadata(pages)

    processed_dir = PROJECT_ROOT / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    version_info = get_document_version(
        filename,
        len(pages),
        len(chunks),
        user_id=user_id,
        project_id=project["id"],
    )


    artifact_dir = processed_dir / "projects" / str(project["id"]) / version_info["document_id"]
    artifact_dir.mkdir(parents=True, exist_ok=True)
    output_path = artifact_dir / "chunks.json"
    sections_path = artifact_dir / "sections.json"
    collection_name = project_collection_name(user_id, project["id"])
    scoped_chunks = [
        {
            **chunk,
            "user_id": int(user_id),
            "project_id": project["id"],
            "document_id": version_info["document_id"],
        }
        for chunk in chunks
    ]
    scoped_tables = [
        {
            **table,
            "user_id": int(user_id),
            "project_id": project["id"],
            "document_id": version_info["document_id"],
        }
        for table in tables
    ]
    data = {
        "source_file": filename,
        "filename": filename,
        "user_id": int(user_id),
        "project_id": project["id"],
        "project_name": project["name"],
        "version": version_info["version"],
        "document_id": version_info["document_id"],
        "collection_name": collection_name,
        "total_pages": len(pages),
        "total_chunks": len(scoped_chunks),
        "total_text_chunks": len(text_chunks),
        "total_table_chunks": len(table_chunks),
        "total_tables": len(tables),
        "sections": sections,
        **document_metadata,
        "tables": scoped_tables,
        "chunks": scoped_chunks,
    }
    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4, ensure_ascii=False)

    with open(sections_path, "w", encoding="utf-8") as file:
        json.dump(sections, file, indent=4, ensure_ascii=False)

    traceability_path = artifact_dir / "traceability.json"
    traceability = [
        {
            **record,
            "user_id": int(user_id),
            "project_id": project["id"],
            "document_id": version_info["document_id"],
        }
        for record in traceability
    ]
    with open(traceability_path, "w", encoding="utf-8") as file:
        json.dump(traceability, file, indent=4, ensure_ascii=False)

    pages_path = artifact_dir / "pages.json"
    scoped_pages = [
        {
            **page,
            "user_id": int(user_id),
            "project_id": project["id"],
            "document_id": version_info["document_id"],
        }
        for page in pages
    ]
    with open(pages_path, "w", encoding="utf-8") as file:
        json.dump(scoped_pages, file, indent=4, ensure_ascii=False)

    build_uploaded_database(
        str(output_path), user_id=user_id, project_id=project["id"]
    )
    create_document_record(
        user_id,
        project["id"],
        document_id=version_info["document_id"],
        filename=filename,
        version=version_info["version"],
        page_count=len(pages),
        chunk_count=len(scoped_chunks),
        traceability_count=len(traceability),
        collection_name=collection_name,
        artifact_dir=artifact_dir,
    )

    return {
        "filename": filename,
        "document_id": version_info["document_id"],
        "user_id": int(user_id),
        "project_id": project["id"],
        "project_name": project["name"],
        "pages": len(pages),
        "chunks": len(chunks),
        "collection": collection_name,
        "collection_name": collection_name,
        "version": version_info["version"],
        "version_info": version_info,
        "traceability_records": len(traceability),
        "traceability_path": str(traceability_path),
        "pages_path": str(pages_path),
        "sections": sections,
        "sections_path": str(sections_path),
        **document_metadata,
        "artifact_dir": str(artifact_dir),
    }
