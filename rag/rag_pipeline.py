import json
from pathlib import Path

from rag.retriever import search_document_metadata, search_documents
from rag.reranker import rerank_results
from rag.confidence import calculate_confidence
from database.access_control import list_project_documents, require_project_access


METADATA_QUERY_TERMS = {
    "title": "title",
    "book": "title",
    "document name": "title",
    "called": "title",
    "author": "author",
    "writer": "author",
    "publication": "publication",
    "published": "publication",
    "isbn": "publication",
}


def metadata_query_type(query):
    normalized = query.lower()
    for term, query_type in METADATA_QUERY_TERMS.items():
        if term in normalized:
            return query_type
    return None


def build_prompt(query, context_chunks):
    """Build a prompt string from the query and retrieved context chunks."""
    context_text = "\n\n".join(
        f"[Page {chunk['metadata'].get('page_number', '?')}]\n{chunk['document']}"
        for chunk in context_chunks
    )
    return (
        "You are an expert AUTOSAR architecture analyst. "
        "Answer the question using only the context provided below. "
        "If the answer is not in the context, say so.\n\n"
        f"CONTEXT:\n{context_text}\n\n"
        f"QUESTION: {query}\n\n"
        "ANSWER:"
    )


def retrieve_context(
    query,
    top_k=5,
    collection_name="autosar_documents",
    *,
    user_id=None,
    project_id=None,
):
    if user_id is None or project_id is None:
        from database.access_control import AuthorizationError
        raise AuthorizationError("Retrieval requires both a user and an authorized project.")

    require_project_access(user_id, project_id)

    query_type = metadata_query_type(query)
    if query_type:
        results = search_document_metadata(
            query,
            top_k=8,
            user_id=user_id,
            project_id=project_id,
        )
        results["metadata_query_type"] = query_type
    else:
        results = search_documents(
            query,
            top_k=8,
            max_distance=None,
            collection_name=collection_name,
            user_id=user_id,
            project_id=project_id,
        )

    ranked_results = rerank_results(results)
    confidence = calculate_confidence(ranked_results)

    selected = ranked_results[:top_k]

    documents = [result["document"] for result in selected]
    metadatas = [result["metadata"] for result in selected]
    distances = [result["distance"] for result in selected]

    return {
        "documents": [documents],
        "metadatas": [metadatas],
        "distances": [distances],
        "ranked_results": selected,
        "confidence": confidence,
        "collection_name": collection_name,
        "metadata_query_type": query_type,
        "query": query,
    }
