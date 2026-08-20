"""Embedding pipeline helpers for the Vanguard Knowledge Base (PRD 5.14).

The embedding provider is intentionally behind a small interface rather than a
hardcoded model SDK. The model is not finalized (DeepSeek V4 proposed), so the
endpoint/model/key are all configuration values (see ``base.py``). Providers
are expected to expose an OpenAI-compatible ``/embeddings`` API — e.g. the
LiteLLM proxy Sentinel already uses.
"""

# Standard Libraries
import logging
import re

# Third-Party Libraries
import requests
from django.conf import settings

# Using __name__ resolves to ghostwriter.knowledge_base.embeddings
logger = logging.getLogger(__name__)


def chunk_markdown(body_markdown, chunk_size=None):
    """Split a markdown body into overlapping-safe text chunks.

    Simple paragraph/heading-based chunking is fine for the initial pipeline
    (SETUP.md 6.5). Chunks never span paragraphs, so each chunk stays coherent.
    """
    if chunk_size is None:
        chunk_size = settings.VANGUARD_EMBEDDING_CHUNK_SIZE

    # Normalize line endings and split into paragraphs
    paragraphs = re.split(r"\n\s*\n", body_markdown.replace("\r\n", "\n").strip())
    chunks = []
    current = ""
    for paragraph in paragraphs:
        if not paragraph.strip():
            continue
        if len(current) + len(paragraph) + 2 > chunk_size and current:
            chunks.append(current.strip())
            current = paragraph
        else:
            current = f"{current}\n\n{paragraph}" if current else paragraph
    if current.strip():
        chunks.append(current.strip())
    return chunks


def is_configured():
    """Return True when an embedding provider has been configured."""
    return bool(settings.VANGUARD_EMBEDDING_ENDPOINT and settings.VANGUARD_EMBEDDING_MODEL)


def get_embedding(text):
    """Return the embedding vector for ``text`` using the configured provider.

    Uses the OpenAI-compatible ``/embeddings`` endpoint shape so any provider
    (LiteLLM proxy, DeepSeek, etc.) can be plugged in via configuration.
    """
    if not is_configured():
        logger.warning(
            "Embedding provider is not configured; skipping embedding generation"
        )
        return None

    headers = {"Content-Type": "application/json"}
    if settings.VANGUARD_EMBEDDING_API_KEY:
        headers["Authorization"] = f"Bearer {settings.VANGUARD_EMBEDDING_API_KEY}"

    endpoint = settings.VANGUARD_EMBEDDING_ENDPOINT.rstrip("/")
    response = requests.post(
        f"{endpoint}/embeddings",
        json={"model": settings.VANGUARD_EMBEDDING_MODEL, "input": text},
        headers=headers,
        timeout=60,
    )
    response.raise_for_status()
    data = response.json()
    return data["data"][0]["embedding"]