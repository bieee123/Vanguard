"""RAG query pipeline for the Vanguard Knowledge Base (PRD 5.14, SETUP.md 6.6).

A question is embedded with the configured embedding provider, the top-K most
similar chunks are fetched from :model:`knowledge_base.NoteEmbedding` via a
pgvector cosine-similarity query, and those chunks are fed as context to an
OpenAI-compatible ``/chat/completions`` endpoint to produce a grounded answer
plus the source note IDs so the UI can render citation chips.
"""

# Standard Libraries
import logging

# Django Imports
from django.conf import settings

# 3rd Party Libraries
import requests
from pgvector.django import CosineDistance

# Ghostwriter Libraries
from ghostwriter.knowledge_base import embeddings
from ghostwriter.knowledge_base.models import NoteEmbedding

# Using __name__ resolves to ghostwriter.knowledge_base.rag
logger = logging.getLogger(__name__)


def retrieve_chunks(question, top_k=None):
    """Return the top-K most similar note chunks for ``question``.

    Chunks excluded from RAG (sensitive content, per SETUP.md 6.8) are never
    returned. Returns a list of dicts with ``note_id``, ``note_title``,
    ``chunk_index``, ``chunk_text``, and ``distance``.
    """
    if top_k is None:
        top_k = settings.VANGUARD_RAG_TOP_K
    if not embeddings.is_configured():
        logger.warning("Embedding provider is not configured; RAG retrieval skipped")
        return []

    query_vector = embeddings.get_embedding(question)
    if query_vector is None:
        return []

    results = (
        NoteEmbedding.objects.filter(excluded_from_rag=False, embedding__isnull=False)
        .annotate(distance=CosineDistance("embedding", query_vector))
        .order_by("distance")[:top_k]
    )
    return [
        {
            "note_id": row.note_id,
            "note_title": row.note.title,
            "chunk_index": row.chunk_index,
            "chunk_text": row.chunk_text,
            "distance": row.distance,
        }
        for row in results.select_related("note")
    ]


def build_prompt(question, chunks):
    """Build the system + user prompt for answer generation from retrieved chunks."""
    context = "\n\n---\n\n".join(f"[{i+1}] {chunk['chunk_text']}" for i, chunk in enumerate(chunks))
    system = (
        "You are an assistant for the Vanguard red team dashboard. Answer the "
        "operator's question using only the provided context from the Knowledge "
        "Base. If the context does not contain the answer, say so plainly. Cite "
        "the numbered context source of every claim you make."
    )
    user = f"Context:\n{context}\n\nQuestion:\n{question}"
    return system, user


def generate_answer(question, chunks):
    """Call the configured chat-completions endpoint and return the answer text."""
    endpoint = getattr(settings, "VANGUARD_LLM_ENDPOINT", "")
    model = getattr(settings, "VANGUARD_LLM_MODEL", "")
    api_key = getattr(settings, "VANGUARD_LLM_API_KEY", "")
    if not endpoint or not model:
        logger.warning("LLM endpoint/model is not configured; skipping answer generation")
        return None

    system, user = build_prompt(question, chunks)
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
    }
    response = requests.post(
        f"{endpoint.rstrip('/')}/chat/completions",
        json=payload,
        headers=headers,
        timeout=90,
    )
    response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def rag_answer(question, top_k=None):
    """Run the full RAG pipeline and return an answer plus its sources.

    Returns a dict with ``question``, ``answer`` (None when the LLM is not
    configured), and ``sources`` (list of note dicts). Sources are always
    returned so the UI can show citation chips even without an LLM.
    """
    chunks = retrieve_chunks(question, top_k=top_k)
    sources = [
        {
            "note_id": chunk["note_id"],
            "note_title": chunk["note_title"],
            "chunk_index": chunk["chunk_index"],
            "distance": round(chunk["distance"], 4),
        }
        for chunk in chunks
    ]
    answer = None
    if chunks:
        answer = generate_answer(question, chunks)
    return {
        "question": question,
        "answer": answer,
        "sources": sources,
    }