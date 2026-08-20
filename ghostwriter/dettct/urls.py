"""This contains all the URL mappings used by the DeTT&CT application."""

# Django Imports
from django.urls import path

# Ghostwriter Libraries
from ghostwriter.dettct import views

app_name = "dettct"

# URLs for the basic views
urlpatterns = [
    path("", views.DeTTCTCoverageView.as_view(), name="index"),
    path("runs/<int:pk>", views.run_detail, name="run_detail"),
]