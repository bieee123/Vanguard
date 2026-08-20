"""This contains the custom template tags used by the Knowledge Base application."""

# Standard Libraries
import re

# Django Imports
from django import template
from django.urls import reverse

# Third-Party Libraries
import markdown as markdown_lib
from bleach.sanitizer import Cleaner

# Ghostwriter Libraries
from ghostwriter.knowledge_base.models import Note

register = template.Library()

# Tag rendering config shared with the rest of Ghostwriter's bleach usage
ALLOWED_TAGS = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "a",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "img",
    "hr",
]
ALLOWED_ATTRIBUTES = {
    "a": ["href", "title"],
    "img": ["src", "alt", "title"],
    "code": ["class"],
    "pre": ["class"],
}

_cleaner = Cleaner(tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)

_LINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def _render_wikilink(match):
    """Render a ``[[Title]]`` wikilink as an anchor to the target note."""
    title = match.group(1).strip()
    try:
        note = Note.objects.get(title__iexact=title)
        return f'<a href="{reverse("knowledge_base:note_detail", args=[note.id])}">[[{title}]]</a>'
    except Note.DoesNotExist:
        return f'<span class="kb-broken-link" title="Target note does not exist yet">[[{title}]]</span>'


@register.filter(name="render_markdown")
def render_markdown(value):
    """Render a note's markdown body with ``[[wikilinks]]`` and safe HTML."""
    if not value:
        return ""
    rendered = markdown_lib.markdown(
        value,
        extensions=["extra", "sane_lists", "codehilite", "nl2br"],
    )
    rendered = _LINK_RE.sub(_render_wikilink, rendered)
    return _cleaner.clean(rendered)