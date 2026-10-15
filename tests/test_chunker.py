from ingestion.chunker import build_section_tree, create_chunks
from ingestion.table_extractor import create_table_chunks
from rag.citation import format_sources


def test_numbered_sections_are_separate_and_chunks_have_section_metadata():
    pages = [{
        "page_number": 1,
        "text": (
            "1 Introduction\n\nThis section explains the system. It has two sentences.\n\n"
            "1.1 Scope\n\nThe scope covers components and interfaces.\n\n"
            "2 Architecture\n\nThe architecture connects all components."
        ),
        "extraction_method": "text",
    }]
    sections = build_section_tree(pages)
    chunks = create_chunks(pages, chunk_size=300, overlap=20)

    assert [section["section_number"] for section in sections] == ["1", "1.1", "2"]
    assert all(chunk["page_start"] == chunk["page_end"] == 1 for chunk in chunks)
    assert {chunk["section_number"] for chunk in chunks} == {"1", "2"}
    assert all(chunk["section_path"] in chunk["text"] for chunk in chunks)
    assert all("1.1 Scope" not in chunk["text"] or chunk["section_number"] == "1" for chunk in chunks)


def test_paragraph_fallback_keeps_sentence_boundaries_and_old_citations_work():
    pages = [{
        "page_number": 9,
        "text": " ".join(
            f"Sentence {index} describes an interface and its dependency in the architecture."
            for index in range(1, 16)
        ),
        "extraction_method": "ocr",
    }]
    chunks = create_chunks(pages, chunk_size=300, overlap=10)

    assert len(chunks) > 1
    assert all(chunk["section_path"] == "" for chunk in chunks)
    assert all(chunk["page_number"] == 9 for chunk in chunks)
    assert all(chunk["text"].rstrip().endswith(".") for chunk in chunks)
    sources = format_sources({"metadatas": [[{"page_number": 9, "chunk_id": 0}]]})
    assert sources == [{"source_number": 1, "page": 9, "chunk_id": 0}]


def test_outline_takes_priority_over_numbered_text_heading():
    pages = [{
        "page_number": 3,
        "text": "7 Body\n\nThis is the actual section text.",
        "outline_headings": [{"title": "Outline Name", "level": 1}],
    }]
    sections = build_section_tree(pages)
    chunks = create_chunks(pages)

    assert sections[0]["title"] == "Outline Name"
    assert chunks[0]["section_title"] == "Outline Name"


def test_citations_include_section_when_available():
    sources = format_sources({"metadatas": [[{
        "page_number": 51, "chunk_id": 8, "section_number": "4.3.1",
        "section_title": "Execution Management",
    }]]})
    assert sources[0]["section"] == "4.3.1, Execution Management"
    assert sources[0]["page"] == 51


def test_markdown_table_remains_one_complete_table_chunk():
    markdown = "| Name | Value |\n| --- | --- |\n| API | WatchdogInterface |\n| Port | PPort |"
    chunks = create_table_chunks([{
        "table_id": "table_4_1", "page_number": 4, "source_file": "design.pdf", "content": markdown,
    }])
    assert len(chunks) == 1
    assert chunks[0]["chunk_type"] == "table"
    assert chunks[0]["text"] == markdown
