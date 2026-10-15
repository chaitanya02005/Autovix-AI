from fastapi import APIRouter, Depends, HTTPException, status

from backend.dependencies import get_authorized_project, get_current_user
from backend.schemas import QueryRequest, QueryResponse
from database.audit_log import log_event
from rag.citation import format_sources
from rag.llm_client import LLMUnavailableError, generate_answer, model_name
from rag.grounding_guard import check_grounding
from rag.rag_answer import build_context
from rag.rag_pipeline import retrieve_context


router = APIRouter(prefix="/projects/{project_id}/query", tags=["query"])
FALLBACK_ANSWER = "I could not find enough information in the document."


@router.post("", response_model=QueryResponse, summary="Run grounded RAG against an authorized project")
def query_project(
    project_id: int,
    request: QueryRequest,
    current_user: dict = Depends(get_current_user),
    project: dict = Depends(get_authorized_project),
):
    try:
        results = retrieve_context(
            request.question,
            top_k=5,
            user_id=current_user["id"],
            project_id=project["id"],
        )
    except Exception as error:
        if error.__class__.__name__ in {"NotFoundError", "InvalidCollectionException"}:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "project_index_not_found", "message": "No indexed documents are available for this project."},
            ) from None
        raise

    context = build_context(results)

    if not results["documents"][0]:
        answer = FALLBACK_ANSWER
    else:
        system_prompt = (
            "Answer the question using only the supplied project document context. "
            f"If it is not answered there, respond exactly: '{FALLBACK_ANSWER}'"
        )
        user_prompt = f"DOCUMENT CONTEXT:\n{context}\n\nQUESTION:\n{request.question}"
        try:
            answer = generate_answer(system_prompt, user_prompt) or FALLBACK_ANSWER
        except LLMUnavailableError as error:
            query_metadata = results["metadatas"][0]
            log_event(
                "DOCUMENT_QUERY",
                question=request.question,
                status="error",
                user_id=current_user["id"],
                username=current_user["username"],
                project_id=project["id"],
                document_id=(query_metadata[0].get("document_id") if query_metadata else None),
                details={
                    "client": "api",
                    "reason": "local_llm_unavailable",
                },
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "local_llm_unavailable", "message": str(error)},
            ) from None

    grounding = check_grounding(answer, context)
    sources = format_sources(results)
    primary_source = dict(sources[0]) if sources else None
    metadatas = results["metadatas"][0]
    document_id = metadatas[0].get("document_id") if metadatas else None
    if primary_source and document_id:
        primary_source["document_id"] = document_id

    context_chunks = [
        {"document": doc, "metadata": meta}
        for doc, meta in zip(
            results["documents"][0],
            results["metadatas"][0],
        )
    ]

    log_event(
        "DOCUMENT_QUERY",
        question=request.question,
        status="success",
        user_id=current_user["id"],
        username=current_user["username"],
        project_id=project["id"],
        document_id=document_id,
        details={"client": "api", "grounded": grounding["supported"], "model": model_name()},
    )
    return QueryResponse(
        answer=answer,
        retrieval_confidence=results["confidence"],
        grounding=grounding,
        sources=sources,
        primary_source=primary_source,
        project_id=project["id"],
        document_id=document_id,
        context=context_chunks,
        model=model_name() if results["documents"][0] else None,
    )
