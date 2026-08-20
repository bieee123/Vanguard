"""This contains all the views used by the Knowledge Base application."""

# Standard Libraries
import logging

# Django Imports
from django.contrib import messages
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.decorators.http import require_GET
from django.views.generic import DetailView, ListView
from django.views.generic.edit import CreateView, DeleteView, UpdateView

# Third-Party Libraries
from django_q.tasks import async_task

# Ghostwriter Libraries
from ghostwriter.api.utils import RoleBasedAccessControlMixin, verify_user_is_privileged
from ghostwriter.knowledge_base.models import Note, NoteEmbedding, NoteLink
from ghostwriter.knowledge_base.forms import NoteForm

# Using __name__ resolves to ghostwriter.knowledge_base.views
logger = logging.getLogger(__name__)


class NoteListView(RoleBasedAccessControlMixin, ListView):
    """Display the Knowledge Base landing page with a searchable note library."""

    model = Note
    template_name = "knowledge_base/note_list.html"
    paginate_by = 25

    def get_queryset(self):
        queryset = Note.objects.select_related("engagement", "created_by")
        search_term = self.request.GET.get("q", "").strip()
        tag_filter = self.request.GET.get("tag", "").strip()
        if search_term:
            queryset = queryset.filter(
                Q(title__icontains=search_term) | Q(body_markdown__icontains=search_term)
            )
        if tag_filter:
            queryset = queryset.filter(tags__name__iexact=tag_filter)
        return queryset.distinct().order_by("-updated_at")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["q"] = self.request.GET.get("q", "")
        ctx["active_tag"] = self.request.GET.get("tag", "")
        ctx["all_tags"] = (
            Note.tags.most_common()[:20] if Note.objects.exists() else []
        )
        return ctx


class NoteDetailView(RoleBasedAccessControlMixin, DetailView):
    """Display a single :model:`knowledge_base.Note` with backlinks."""

    model = Note
    template_name = "knowledge_base/note_detail.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        note = self.get_object()
        ctx["backlinks"] = note.backlinks()
        ctx["linked_notes"] = Note.objects.filter(
            outgoing_links__source_note=note, outgoing_links__target_note__isnull=False
        ).distinct().order_by("title")
        ctx["broken_links"] = note.outgoing_links.filter(target_note__isnull=True)
        return ctx


class NoteCreateView(RoleBasedAccessControlMixin, CreateView):
    """Create a new :model:`knowledge_base.Note`."""

    model = Note
    form_class = NoteForm
    template_name = "knowledge_base/note_form.html"
    success_url = reverse_lazy("knowledge_base:index")

    def test_func(self):
        return verify_user_is_privileged(self.request.user)

    def handle_no_permission(self):
        messages.error(self.request, "You do not have permission to access that.")
        return redirect("home:dashboard")

    def form_valid(self, form):
        self.object = form.save(commit=False)
        self.object.created_by = self.request.user
        self.object.save()
        form.save_m2m()
        self.object.resolve_links()
        async_task("ghostwriter.knowledge_base.tasks.embed_note", self.object.id)
        messages.success(
            self.request,
            "Note created successfully.",
            extra_tags="alert-success",
        )
        return redirect(self.object.get_absolute_url())


class NoteUpdateView(RoleBasedAccessControlMixin, UpdateView):
    """Update an existing :model:`knowledge_base.Note`."""

    model = Note
    form_class = NoteForm
    template_name = "knowledge_base/note_form.html"

    def test_func(self):
        return verify_user_is_privileged(self.request.user)

    def handle_no_permission(self):
        messages.error(self.request, "You do not have permission to access that.")
        return redirect("home:dashboard")

    def form_valid(self, form):
        self.object = form.save()
        self.object.resolve_links()
        async_task("ghostwriter.knowledge_base.tasks.embed_note", self.object.id)
        messages.success(
            self.request,
            "Note updated successfully.",
            extra_tags="alert-success",
        )
        return redirect(self.object.get_absolute_url())


class NoteDeleteView(RoleBasedAccessControlMixin, DeleteView):
    """Delete a :model:`knowledge_base.Note`."""

    model = Note
    template_name = "knowledge_base/note_delete.html"
    success_url = reverse_lazy("knowledge_base:index")

    def test_func(self):
        return verify_user_is_privileged(self.request.user)

    def handle_no_permission(self):
        messages.error(self.request, "You do not have permission to access that.")
        return redirect("home:dashboard")

    def get_success_url(self):
        messages.success(
            self.request,
            "Note deleted successfully.",
            extra_tags="alert-success",
        )
        return super().get_success_url()


@require_GET
def ajax_note_autocomplete(request):
    """Return note titles matching a ``[[link]]`` autocomplete query."""
    query = request.GET.get("q", "").strip()
    titles = (
        Note.objects.filter(title__icontains=query)
        .values_list("title", flat=True)
        .order_by("title")[:10]
    )
    return JsonResponse({"titles": list(titles)})


@require_GET
def ajax_note_links(request, pk):
    """Return the outgoing links and backlinks for a note as JSON."""
    note = get_object_or_404(Note, pk=pk)
    outgoing = [
        {
            "title": link.target_title_raw,
            "target_id": link.target_note_id,
            "resolved": link.target_note_id is not None,
        }
        for link in note.outgoing_links.all()
    ]
    backlinks = [
        {"title": link.source_note.title, "source_id": link.source_note_id}
        for link in NoteLink.objects.filter(target_note=note).select_related("source_note")
    ]
    return JsonResponse({"outgoing": outgoing, "backlinks": backlinks})


@require_GET
def graph_json(request):
    """Return the Knowledge Base graph as JSON.

    Nodes are notes (violet), findings (severity color), and assets (teal).
    Edges are note↔note wikilinks plus note↔finding and note↔asset links.
    """
    # pylint: disable=import-outside-toplevel
    from ghostwriter.assets.models import Asset
    from ghostwriter.reporting.models import Finding

    nodes = []
    edges = []
    node_ids = set()

    def add_node(node_id, node_type, label, color, meta=None):
        key = f"{node_type}:{node_id}"
        if key in node_ids:
            return key
        node_ids.add(key)
        nodes.append(
            {
                "id": key,
                "type": node_type,
                "label": label,
                "color": color,
                "meta": meta or {},
            }
        )
        return key

    def add_edge(source_key, target_key, edge_type="link"):
        edges.append({"source": source_key, "target": target_key, "type": edge_type})

    for note in Note.objects.all().order_by("title"):
        source_key = add_node(note.id, "note", note.title, "#7e57c2", {"url": note.get_absolute_url()})
        for link in note.outgoing_links.all():
            if link.target_note_id:
                target_key = add_node(
                    link.target_note_id, "note", link.target_note.title, "#7e57c2",
                    {"url": link.target_note.get_absolute_url()},
                )
                add_edge(source_key, target_key)

    # Notes that reference a finding or asset (PRD 5.14 structured links) are
    # detected via an explicit tagged link in the markdown body. When present
    # the note already carries the reference in its body, so we additionally
    # connect notes to findings and assets by title match.
    for finding in Finding.objects.all().order_by("title")[:200]:
        finding_key = add_node(
            finding.id, "finding", finding.title[:60],
            f"#{finding.severity.color}" if finding.severity else "#6c757d",
            {"url": reverse_lazy("reporting:finding_detail", args=[finding.id])},
        )
        for note in Note.objects.filter(
            Q(body_markdown__icontains=finding.title) | Q(title__icontains=finding.title)
        ):
            add_edge(add_node(note.id, "note", note.title, "#7e57c2", {"url": note.get_absolute_url()}), finding_key, "finding")

    for asset in Asset.objects.all().order_by("hostname")[:200]:
        asset_key = add_node(asset.id, "asset", asset.hostname or asset.ip_address, "#26a69a")
        for note in Note.objects.filter(
            Q(body_markdown__icontains=asset.hostname) | Q(body_markdown__icontains=asset.ip_address)
        ):
            add_edge(add_node(note.id, "note", note.title, "#7e57c2", {"url": note.get_absolute_url()}), asset_key, "asset")

    return JsonResponse({"nodes": nodes, "edges": edges})