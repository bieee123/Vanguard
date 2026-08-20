"""This contains all the views used by the DeTT&CT application.

The Long-term Coverage panel (design.md 5.6) is a read-only snapshot imported
from the latest scheduled DeTT&CT run. The panel shows data-source visibility,
technique coverage, and threat-group TTP coverage, plus a "Last updated" label
so it stays visually distinct from the live Purple Team data built in Step 7.
"""

# Django Imports
from django.shortcuts import get_object_or_404, render
from django.views.decorators.http import require_GET
from django.views.generic import ListView

# Ghostwriter Libraries
from ghostwriter.api.utils import RoleBasedAccessControlMixin
from ghostwriter.dettct.models import DeTTCTRun


class DeTTCTCoverageView(RoleBasedAccessControlMixin, ListView):
    """Display the latest DeTT&CT run in the read-only Long-term Coverage panel."""

    model = DeTTCTRun
    template_name = "dettct/coverage.html"
    paginate_by = 25

    def get_queryset(self):
        return DeTTCTRun.objects.all()

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        latest_run = DeTTCTRun.objects.first()
        ctx["latest_run"] = latest_run
        if latest_run:
            ctx["coverage_stats"] = latest_run.coverage_stats
            ctx["data_sources"] = latest_run.data_sources
            ctx["techniques"] = latest_run.techniques
            ctx["groups"] = latest_run.groups
            ctx["techniques_by_id"] = {t["technique_id"]: t for t in latest_run.techniques}
        return ctx


@require_GET
def run_detail(request, pk):
    """Display a single historical DeTT&CT run for reference."""
    run = get_object_or_404(DeTTCTRun, pk=pk)
    return render(
        request,
        "dettct/run_detail.html",
        {
            "run": run,
            "coverage_stats": run.coverage_stats,
            "data_sources": run.data_sources,
            "techniques": run.techniques,
            "groups": run.groups,
            "techniques_by_id": {t["technique_id"]: t for t in run.techniques},
        },
    )