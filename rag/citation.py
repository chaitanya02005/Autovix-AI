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

        sources.append(source)

    return sources

