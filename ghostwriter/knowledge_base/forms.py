"""This contains all the forms used by the Knowledge Base application."""

# Django Imports
from django import forms

# Ghostwriter Libraries
from ghostwriter.knowledge_base.models import Note


class NoteForm(forms.ModelForm):
    """Form for creating and updating :model:`knowledge_base.Note`."""

    class Meta:
        model = Note
        fields = ["title", "body_markdown", "engagement", "exclude_from_rag", "tags"]
        widgets = {
            "title": forms.TextInput(attrs={"placeholder": "Note title"}),
            "body_markdown": forms.Textarea(
                attrs={
                    "class": "kb-markdown-editor",
                    "data-link-autocomplete": "true",
                    "placeholder": "Write in Markdown. Type [[ to link another note.",
                }
            ),
        }