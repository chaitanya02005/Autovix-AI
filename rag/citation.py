def format_sources(results):
    """
    Generate source references directly from
    ChromaDB metadata.
    """

    sources = []

    metadatas = results["metadatas"][0]

    for i, metadata in enumerate(metadatas):

        source = {
            "source_number": i + 1,
            "page": metadata["page_number"],
            "chunk_id": metadata["chunk_id"]
        }
        section_number = metadata.get("section_number")
        section_title = metadata.get("section_title")
        if section_number or section_title:
            source["section"] = ", ".join(
                value for value in (section_number, section_title) if value
            )

        sources.append(source)

    return sources

