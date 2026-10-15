from rag.rag_pipeline import retrieve_context
from rag.llm_client import generate_answer
from rag.citation import format_sources


def build_context(results):

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]

    context_parts = []

    for i, (document, metadata) in enumerate(
        zip(documents, metadatas),
        start=1
    ):

        context_parts.append(
            f"""
SOURCE {i}

Page: {metadata['page_number']}
Chunk ID: {metadata['chunk_id']}

CONTENT:
{document}
"""
        )

    return "\n".join(context_parts)


def answer_question(query, top_k=5, *, user_id, project_id):

    # Retrieve context and confidence
    results = retrieve_context(
        query,
        top_k=top_k,
        user_id=user_id,
        project_id=project_id,
    )

    confidence = results["confidence"]

    # Build document context
    context = build_context(results)

    # Grounded generation prompt
    system_prompt = (
        "You are an engineering document analysis assistant. Answer only using the provided "
        "AUTOSAR document context. Use only information explicitly supported by the context; "
        "do not use outside knowledge, invent information, or interpret beyond the document. "
        "If the context does not contain enough information, say: "
        '"I could not find enough information in the document." Keep the answer concise and '
        "technically accurate. Do not create citations; the application adds them separately."
    )
    user_prompt = f"DOCUMENT CONTEXT:\n\n{context}\n\nUSER QUESTION:\n\n{query}"
    answer = generate_answer(system_prompt, user_prompt)

    sources = format_sources(results)

    return answer, sources, confidence


