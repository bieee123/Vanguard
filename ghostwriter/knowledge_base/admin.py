"""Knowledge Base application admin configuration."""

# Django Imports
from django.contrib import admin

# Ghostwriter Libraries
from ghostwriter.knowledge_base.models import Note, NoteEmbedding, NoteLink


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`knowledge_base.Note`."""

    list_display = ("title", "engagement", "created_by", "exclude_from_rag", "updated_at")
    list_filter = ("exclude_from_rag", "engagement", "tags")
    search_fields = ("title", "body_markdown")
    ordering = ("-updated_at",)


@admin.register(NoteLink)
class NoteLinkAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`knowledge_base.NoteLink`."""

    list_display = ("source_note", "target_title_raw", "target_note", "created_at")
    list_filter = ("source_note",)
    search_fields = ("source_note__title", "target_title_raw", "target_note__title")
    ordering = ("-created_at",)


@admin.register(NoteEmbedding)
class NoteEmbeddingAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`knowledge_base.NoteEmbedding`."""

    list_display = ("note", "chunk_index", "excluded_from_rag", "created_at")
    list_filter = ("excluded_from_rag", "note")
    search_fields = ("note__title", "chunk_text")
    ordering = ("-created_at",)