"""This contains tasks to be run using Django Q and Redis for the Knowledge Base."""

# Standard Libraries
import logging

# Ghostwriter Libraries
from ghostwriter.knowledge_base import embeddings
from ghostwriter.knowledge_base.models import Note, NoteEmbedding

# Using __name__ resolves to ghostwriter.knowledge_base.tasks
logger = logging.getLogger(__name__)


def embed_note(note_id, chunk_size=None):
    """Chunk a :model:`knowledge_base.Note` and generate vector embeddings.

    Runs as a Django Q background task so the save request is never blocked on
    an external embedding API call (SETUP.md 6.5). Sensitive notes (those
    flagged ``exclude_from_rag``) are chunked but marked as excluded so their
    content never surfaces in RAG retrieval.
    """
    try:
        note = Note.objects.get(id=note_id)
    except Note.DoesNotExist:
        logger.warning("Note %s no longer exists; skipping embedding", note_id)
        return

    # Wipe stale chunks so re-saves don't accumulate duplicates
    NoteEmbedding.objects.filter(note=note).delete()

    chunks = embeddings.chunk_markdown(note.body_markdown, chunk_size=chunk_size)
    if not chunks:
        logger.info("Note %s has an empty body; nothing to embed", note_id)
        return

    for index, chunk in enumerate(chunks):
        vector = None
        if not note.exclude_from_rag and embeddings.is_configured():
            try:
                vector = embeddings.get_embedding(chunk)
            except Exception:  # pylint: disable=broad-exception-caught
                logger.exception("Unable to generate embedding for note %s chunk %s", note_id, index)
                vector = None
        NoteEmbedding.objects.create(
            note=note,
            chunk_index=index,
            chunk_text=chunk,
            embedding=vector,
            excluded_from_rag=note.exclude_from_rag,
        )
    logger.info(
        "Embedded note %s (%s chunks, %s)",
        note_id,
        len(chunks),
        "excluded from RAG" if note.exclude_from_rag else "RAG-enabled",
    )