"""This contains all the database models used by the Knowledge Base application."""

# Standard Libraries
import re

# Django Imports
from django.conf import settings
from django.db import models
from django.urls import reverse

# Third-Party Libraries
from pgvector.django import VectorField
from taggit.managers import TaggableManager

# Ghostwriter Libraries
from ghostwriter.rolodex.models import Project

# Regex matching Obsidian-style [[wikilinks]] inside note bodies
WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


class Note(models.Model):
    """Stores a markdown note in the Vanguard Knowledge Base (PRD 5.14)."""

    title = models.CharField(
        "Title",
        max_length=255,
        unique=True,
        help_text="Title of the note. Wikilinks resolve against this value.",
    )
    body_markdown = models.TextField(
        "Body",
        default="",
        blank=True,
        help_text="Markdown body. Use [[Title]] to link to another note.",
    )
    engagement = models.ForeignKey(
        Project,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kb_notes",
        help_text="Optional engagement this note belongs to. Leave blank for standalone notes.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kb_notes_created",
    )
    exclude_from_rag = models.BooleanField(
        "Exclude from RAG",
        default=False,
        help_text="Exclude this note from embedding and AI retrieval if it contains sensitive content.",
    )
    tags = TaggableManager(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
        verbose_name = "Note"
        verbose_name_plural = "Notes"

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse("knowledge_base:note_detail", args=[str(self.id)])

    def wikilink_titles(self):
        """Return the list of raw ``[[...]]`` titles referenced in the body."""
        return [m.group(1).strip() for m in WIKILINK_RE.finditer(self.body_markdown)]

    def linked_notes(self):
        """Return the :model:`knowledge_base.NoteLink` rows created from this note."""
        return self.outgoing_links.all()

    def backlinks(self):
        """Return notes that link to this note (reverse of :meth:`linked_notes`)."""
        return Note.objects.filter(
            outgoing_links__target_note=self
        ).distinct().order_by("title")

    def resolve_links(self):
        """Resolve every ``[[wikilink]]`` in the body against existing notes.

        Creates or updates :model:`knowledge_base.NoteLink` rows. Links to notes
        that do not exist yet are stored with a null ``target_note`` so broken
        links are displayed gracefully rather than erroring.
        """
        titles = self.wikilink_titles()
        for title in titles:
            try:
                target = Note.objects.get(title__iexact=title)
            except Note.DoesNotExist:
                target = None
            NoteLink.objects.update_or_create(
                source_note=self,
                target_title_raw=title,
                defaults={"target_note": target},
            )
        # Drop links that no longer appear in the body
        self.outgoing_links.exclude(target_title_raw__in=titles).delete()


class NoteLink(models.Model):
    """Records a resolved ``[[wikilink]]`` from one note to another."""

    source_note = models.ForeignKey(
        Note,
        on_delete=models.CASCADE,
        related_name="outgoing_links",
    )
    target_note = models.ForeignKey(
        Note,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="incoming_links",
        help_text="Resolved target note. Null when the target does not exist yet.",
    )
    target_title_raw = models.CharField(
        "Target title",
        max_length=255,
        help_text="Raw [[title]] text before resolution, used for broken-link display.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["source_note", "target_title_raw"]
        constraints = [
            models.UniqueConstraint(
                fields=["source_note", "target_title_raw"],
                name="unique_kb_link_source_title",
            )
        ]
        verbose_name = "Note link"
        verbose_name_plural = "Note links"

    def __str__(self):
        return f"{self.source_note} -> {self.target_title_raw}"


class NoteEmbedding(models.Model):
    """Stores a vector embedding for a chunk of a note's markdown body."""

    note = models.ForeignKey(
        Note,
        on_delete=models.CASCADE,
        related_name="embeddings",
    )
    chunk_index = models.IntegerField(
        "Chunk index",
        help_text="Order of this chunk within the note body.",
    )
    chunk_text = models.TextField(
        "Chunk text",
        help_text="The raw text of the chunk that was embedded.",
    )
    embedding = VectorField(
        dimensions=settings.VANGUARD_EMBEDDING_DIMENSIONS,
        null=True,
        blank=True,
        help_text="Vector representation of the chunk text.",
    )
    excluded_from_rag = models.BooleanField(
        "Excluded from RAG",
        default=False,
        help_text="True when this chunk was excluded for sensitive-content reasons.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["note", "chunk_index"]
        indexes = [
            models.Index(fields=["note"], name="kb_embedding_note_idx"),
            models.Index(fields=["excluded_from_rag"], name="kb_embedding_excl_idx"),
        ]
        verbose_name = "Note embedding"
        verbose_name_plural = "Note embeddings"

    def __str__(self):
        return f"{self.note} chunk {self.chunk_index}"