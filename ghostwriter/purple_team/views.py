"""This contains all the views used by the Purple Team Sync application.

Implements the Timeline tab (design.md 5.4), the ATT&CK Matrix page with
heatmap + Detection Gap Report (design.md 5.6), and the Rule request drawer
(design.md 5.6 / SETUP.md 8). Sentinel is mocked at this stage (SETUP.md 7.4).
"""

# Standard Libraries
import logging

# Django Imports
from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST
from django.views.generic import CreateView, DetailView, ListView, UpdateView

# Ghostwriter Libraries
from ghostwriter.api.utils import RoleBasedAccessControlMixin, verify_user_is_privileged
from ghostwriter.dettct.models import DeTTCTRun
from ghostwriter.purple_team import services
from ghostwriter.purple_team.forms import (
    DetectionVerdictForm,
    RuleRequestForm,
    TimelineEntryForm,
)
from ghostwriter.purple_team.models import DetectionVerdict, RuleRequest, TimelineEntry

# Using __name__ resolves to ghostwriter.purple_team.views
logger = logging.getLogger(__name__)


def _deny(request):
    messages.error(request, "You do not have permission to access that.")
    return redirect("home:dashboard")


class TimelineListView(RoleBasedAccessControlMixin, ListView):
    """List all timeline entries, filterable by engagement and technique."""

    model = TimelineEntry
    template_name = "purple_team/timeline_list.html"
    paginate_by = 50

    def get_queryset(self):
        queryset = TimelineEntry.objects.select_related("engagement", "asset", "operator")
        engagement_id = self.request.GET.get("engagement", "").strip()
        technique = self.request.GET.get("technique", "").strip()
        if engagement_id:
            queryset = queryset.filter(engagement_id=engagement_id)
        if technique:
            queryset = queryset.filter(technique_id__icontains=technique)
        return queryset

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["engagement_id"] = self.request.GET.get("engagement", "")
        ctx["technique"] = self.request.GET.get("technique", "")
        ctx["stats"] = services.verdict_stats(self.get_queryset())
        return ctx


class TimelineDetailView(RoleBasedAccessControlMixin, DetailView):
    """Display a single timeline entry with its verdict and suggested match."""

    model = TimelineEntry
    template_name = "purple_team/timeline_detail.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        entry = self.get_object()
        ctx["verdict"] = getattr(entry, "verdict", None)
        ctx["suggested_match"] = services.suggest_alert_match(entry, services.mock_sentinel_alerts(entry))
        return ctx


class TimelineCreateView(RoleBasedAccessControlMixin, CreateView):
    """Create a new timeline entry for an engagement (PRD 5.5)."""

    model = TimelineEntry
    form_class = TimelineEntryForm
    template_name = "purple_team/timeline_form.html"

    def test_func(self):
        return verify_user_is_privileged(self.request.user)

    def handle_no_permission(self):
        return _deny(self.request)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["request"] = self.request
        return kwargs

    def get_initial(self):
        initial = super().get_initial()
        engagement_id = self.kwargs.get("engagement_id")
        if engagement_id:
            initial["engagement"] = engagement_id
        return initial

    def form_valid(self, form):
        self.object = form.save(commit=False)
        self.object.operator = self.request.user
        self.object.save()
        form.save_m2m()
        # A verdict row is created automatically so the entry is immediately
        # ready for correlation (SETUP.md 7.2).
        DetectionVerdict.objects.get_or_create(timeline_entry=self.object)
        messages.success(self.request, "Timeline entry created.", extra_tags="alert-success")
        return redirect(self.object.get_absolute_url())


class TimelineUpdateView(RoleBasedAccessControlMixin, UpdateView):
    """Update an existing timeline entry."""

    model = TimelineEntry
    form_class = TimelineEntryForm
    template_name = "purple_team/timeline_form.html"

    def test_func(self):
        return verify_user_is_privileged(self.request.user)

    def handle_no_permission(self):
        return _deny(self.request)

    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        kwargs["request"] = self.request
        return kwargs

    def form_valid(self, form):
        self.object = form.save()
        messages.success(self.request, "Timeline entry updated.", extra_tags="alert-success")
        return redirect(self.object.get_absolute_url())


class MatrixView(RoleBasedAccessControlMixin, ListView):
    """Display the ATT&CK Matrix heatmap + Detection Gap Report (design.md 5.6)."""

    model = TimelineEntry
    template_name = "purple_team/matrix.html"

    def get_queryset(self):
        return TimelineEntry.objects.select_related("verdict", "engagement")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        queryset = self.get_queryset()
        engagement_id = self.request.GET.get("engagement", "").strip()
        if engagement_id:
            queryset = queryset.filter(engagement_id=engagement_id)
        ctx["engagement_id"] = engagement_id
        ctx["heatmap"] = services.heatmap_data(queryset)
        ctx["gap_report"] = services.detection_gap_report(queryset)
        ctx["stats"] = services.verdict_stats(queryset)
        ctx["rule_requests"] = RuleRequest.objects.select_related("requested_by").all()[:50]
        latest_run = DeTTCTRun.objects.first()
        ctx["latest_run"] = latest_run
        if latest_run:
            ctx["coverage_stats"] = latest_run.coverage_stats
            ctx["data_sources"] = latest_run.data_sources
            ctx["techniques"] = latest_run.techniques
            ctx["techniques_by_id"] = {t["technique_id"]: t for t in latest_run.techniques}
            ctx["groups"] = latest_run.groups
        return ctx


class RuleRequestListView(RoleBasedAccessControlMixin, ListView):
    """List rule requests with their status trackers (SETUP.md 8)."""

    model = RuleRequest
    template_name = "purple_team/rule_request_list.html"
    paginate_by = 25

    def get_queryset(self):
        return RuleRequest.objects.select_related("requested_by")


class RuleRequestDetailView(RoleBasedAccessControlMixin, DetailView):
    """Display a single rule request."""

    model = RuleRequest
    template_name = "purple_team/rule_request_detail.html"


class RuleRequestCreateView(RoleBasedAccessControlMixin, CreateView):
    """Create a draft rule request from a detection gap (design.md 5.6 drawer)."""

    model = RuleRequest
    form_class = RuleRequestForm
    template_name = "purple_team/rule_request_form.html"

    def test_func(self):
        return verify_user_is_privileged(self.request.user)

    def handle_no_permission(self):
        return _deny(self.request)

    def get_initial(self):
        initial = super().get_initial()
        technique_id = self.request.GET.get("technique", "").strip()
        if technique_id:
            initial["technique_id"] = technique_id
        timeline_entry = self.request.GET.get("timeline", "").strip()
        if timeline_entry:
            initial["timeline_entry"] = timeline_entry
        return initial

    def form_valid(self, form):
        self.object = form.save(commit=False)
        self.object.requested_by = self.request.user
        self.object.requested_at = timezone.now()
        self.object.save()
        messages.success(
            self.request,
            "Rule request draft created. Submit it to start the review workflow.",
            extra_tags="alert-success",
        )
        return redirect(self.object.get_absolute_url())


@require_POST
def submit_rule_request(request, pk):
    """Move a draft rule request to ``pending_review`` (SETUP.md 8.3).

    This is the only transition Vanguard's UI can trigger directly. Everything
    after it (approved/deployed/rejected) is driven by Sentinel's response.
    """
    rule_request = get_object_or_404(RuleRequest, pk=pk)
    if not verify_user_is_privileged(request.user):
        return JsonResponse({"error": "Permission denied."}, status=403)
    if rule_request.status != RuleRequest.Status.DRAFT:
        return JsonResponse({"error": "Only draft requests can be submitted."}, status=400)
    rule_request.status = RuleRequest.Status.PENDING_REVIEW
    rule_request.requested_at = timezone.now()
    rule_request.save()
    return JsonResponse({"status": rule_request.status, "label": rule_request.get_status_display()})


@require_POST
def verify_rule_request(request, pk):
    """Record the operator's retest result (SETUP.md 8.4 / PRD 6.5 step 6).

    Only ``deployed`` requests can be verified from Vanguard's side. A failed
    retest goes back to ``draft`` so the operator can revise the rule and
    resubmit; the gap therefore stays visible in the Detection Gap Report until
    it is resolved. ``verified`` is the only status Vanguard sets other than
    ``draft``/``pending_review``; approvals and deployments remain Sentinel's.
    """
    rule_request = get_object_or_404(RuleRequest, pk=pk)
    if not verify_user_is_privileged(request.user):
        return JsonResponse({"error": "Permission denied."}, status=403)
    if rule_request.status != RuleRequest.Status.DEPLOYED:
        return JsonResponse(
            {"error": "Only deployed requests can be verified or reopened."}, status=400
        )
    retest_passed = request.POST.get("retest") == "passed"
    if retest_passed:
        rule_request.status = RuleRequest.Status.VERIFIED
        rule_request.verified_at = timezone.now()
        rule_request.save()
    else:
        rule_request.status = RuleRequest.Status.DRAFT
        rule_request.verified_at = None
        rule_request.save()
    return JsonResponse({"status": rule_request.status, "label": rule_request.get_status_display()})


@require_POST
def confirm_verdict(request, pk):
    """Confirm the suggested SOC match (or override) for a timeline entry's verdict."""
    if not verify_user_is_privileged(request.user):
        return JsonResponse({"error": "Permission denied."}, status=403)
    entry = get_object_or_404(TimelineEntry, pk=pk)
    verdict, _created = DetectionVerdict.objects.get_or_create(timeline_entry=entry)
    form = DetectionVerdictForm(request.POST, instance=verdict)
    if not form.is_valid():
        return JsonResponse({"error": "Invalid verdict data.", "errors": form.errors}, status=400)
    verdict = form.save(commit=False)
    verdict.confirmed_by = request.user
    verdict.confirmed_at = timezone.now()
    verdict.confirmed_by_operator = True
    verdict.save()
    return JsonResponse(
        {"status": "ok", "verdict": verdict.verdict, "label": verdict.get_verdict_display()}
    )