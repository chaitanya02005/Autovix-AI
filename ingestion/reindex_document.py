"""Rebuild vectors for one stored PDF without touching other project documents.

Run: python -m ingestion.reindex_document --user-id USER --project-id PROJECT --document-id DOCUMENT
"""
import argparse
import json

from database.access_control import AuthorizationError, list_project_documents, require_project_access
from ingestion.chunker import build_section_tree, create_chunks, _section_path
from rag.uploaded_document_db import PROJECT_ROOT, build_uploaded_database


def reindex_document(user_id, project_id, document_id):
    require_project_access(user_id, project_id)
    documents = list_project_documents(user_id, project_id)
    record = next((item for item in documents if str(item["document_id"]) == str(document_id)), None)
    if not record:
        raise AuthorizationError("The document does not belong to the authorized project.")
    artifact_dir = PROJECT_ROOT / "data" / "processed" / "projects" / str(project_id) / str(document_id)
    pages_path = artifact_dir / "pages.json"
    chunks_path = artifact_dir / "chunks.json"
    if not pages_path.exists() or not chunks_path.exists():
        raise FileNotFoundError(f"Stored extraction artifacts are missing for document {document_id}.")
    pages = json.loads(pages_path.read_text(encoding="utf-8"))
    original = json.loads(chunks_path.read_text(encoding="utf-8"))
    sections = build_section_tree(pages)
    text_chunks = create_chunks(pages, source_file=original.get("source_file"))
    tables = [item for item in original.get("chunks", []) if item.get("chunk_type") == "table"]
    for index, table in enumerate(tables):
        page_number = int(table.get("page_number", 1))
        section = next((item for item in reversed(sections) if item["start_page"] <= page_number), None)
        path = _section_path(section, sections) if section else ""
        old_path = table.get("section_path", "")
        content = table.get("text", "")
        if old_path and content.startswith(old_path + "\n\n"):
            content = content[len(old_path) + 2:]
        table.update({
            "chunk_id": len(text_chunks) + index,
            "page_start": page_number,
            "page_end": page_number,
            "section_number": section.get("section_number", "") if section else "",
            "section_title": section.get("title", "") if section else "",
            "section_path": path,
        })
        table["text"] = f"{path}\n\n{content}" if path else content
    updated = {**original, "chunks": text_chunks + tables, "sections": sections,
               "total_chunks": len(text_chunks) + len(tables), "total_text_chunks": len(text_chunks)}
    chunks_path.write_text(json.dumps(updated, indent=4, ensure_ascii=False), encoding="utf-8")
    (artifact_dir / "sections.json").write_text(json.dumps(sections, indent=4, ensure_ascii=False), encoding="utf-8")
    build_uploaded_database(str(chunks_path), user_id=user_id, project_id=project_id, replace_document=True)
    return {"document_id": str(document_id), "sections": len(sections), "chunks": len(updated["chunks"])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user-id", type=int, required=True)
    parser.add_argument("--project-id", type=int, required=True)
    parser.add_argument("--document-id", required=True)
    args = parser.parse_args()
    print(reindex_document(args.user_id, args.project_id, args.document_id))


if __name__ == "__main__":
    main()
