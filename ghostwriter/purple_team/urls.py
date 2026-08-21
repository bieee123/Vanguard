"""URL mappings for the Purple Team Sync application."""

# Django Imports
from django.urls import path

# Ghostwriter Libraries
from ghostwriter.purple_team import views

app_name = "purple_team"

# Core timeline + matrix views
urlpatterns = [
    path("", views.TimelineListView.as_view(), name="timeline_list"),
    path("timeline/<int:pk>", views.TimelineDetailView.as_view(), name="timeline_detail"),
    path(
        "timeline/create/",
        views.TimelineCreateView.as_view(),
        name="timeline_create",
    ),
    path(
        "timeline/create/<int:engagement_id>",
        views.TimelineCreateView.as_view(),
        name="timeline_create_for_engagement",
    ),
    path("timeline/update/<int:pk>", views.TimelineUpdateView.as_view(), name="timeline_update"),
    path("matrix/", views.MatrixView.as_view(), name="matrix"),
]

# Rule request workflow (SETUP.md 8)
urlpatterns += [
    path("rule-requests/", views.RuleRequestListView.as_view(), name="rule_request_list"),
    path("rule-requests/<int:pk>", views.RuleRequestDetailView.as_view(), name="rule_request_detail"),
    path("rule-requests/create/", views.RuleRequestCreateView.as_view(), name="rule_request_create"),
    path(
        "rule-requests/<int:pk>/submit",
        views.submit_rule_request,
        name="rule_request_submit",
    ),
]

# AJAX endpoints
urlpatterns += [
    path("ajax/confirm-verdict/<int:pk>", views.confirm_verdict, name="ajax_confirm_verdict"),
]