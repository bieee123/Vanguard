"""This contains all the URL mappings used by the Knowledge Base application."""

# Django Imports
from django.urls import path

# Ghostwriter Libraries
from ghostwriter.knowledge_base import views

app_name = "knowledge_base"

# URLs for the basic views
urlpatterns = [
    path("", views.NoteListView.as_view(), name="index"),
    path("notes/<int:pk>", views.NoteDetailView.as_view(), name="note_detail"),
    path("notes/create/", views.NoteCreateView.as_view(), name="note_create"),
    path("notes/update/<int:pk>", views.NoteUpdateView.as_view(), name="note_update"),
    path("notes/delete/<int:pk>", views.NoteDeleteView.as_view(), name="note_delete"),
]

# URLs for AJAX requests
urlpatterns += [
    path("ajax/autocomplete/", views.ajax_note_autocomplete, name="ajax_autocomplete"),
    path("ajax/links/<int:pk>", views.ajax_note_links, name="ajax_note_links"),
    path("graph/json/", views.graph_json, name="graph_json"),
    path("ajax/rag/", views.ajax_rag_query, name="ajax_rag"),
]