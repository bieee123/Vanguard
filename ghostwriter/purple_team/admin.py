"""Purple Team Sync admin configuration.

Rule request transitions past ``draft`` must be driven by Sentinel's response,
not self-approved from Vanguard (SETUP.md 8.3). The admin exposes a read-only
view of verdicts/timeline entries and provides a management action to simulate
Sentinel's approval/rejection response for testing.
"""

# Django Imports
from django.contrib import admin, messages

# Ghostwriter Libraries
from ghostwriter.purple_team.models import DetectionVerdict, RuleRequest, TimelineEntry


@admin.register(TimelineEntry)
class TimelineEntryAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`purple_team.TimelineEntry`."""

    list_display = ("timestamp", "engagement", "technique_id", "outcome", "asset")
    list_filter = ("outcome", "engagement")
    search_fields = ("technique_id", "action_description", "asset__hostname", "asset__ip_address")
    ordering = ("-timestamp",)


@admin.register(DetectionVerdict)
class DetectionVerdictAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`purple_team.DetectionVerdict`."""

    list_display = ("timeline_entry", "verdict", "confirmed_by_operator", "updated_at")
    list_filter = ("verdict", "confirmed_by_operator")
    readonly_fields = ("created_at", "updated_at")


@admin.register(RuleRequest)
class RuleRequestAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`purple_team.RuleRequest`.

    Includes a management action to simulate Sentinel's approval/rejection so the
    full lifecycle can be tested without a live Sentinel (SETUP.md 8.3).
    """

    list_display = ("technique_id", "status", "requested_by", "created_at")
    list_filter = ("status",)
    search_fields = ("technique_id", "justification", "draft_rule_xml")
    readonly_fields = ("created_at", "updated_at")
    actions = ("simulate_sentinel_approve", "simulate_sentinel_reject")

    @admin.action(description="Simulate Sentinel approval")
    def simulate_sentinel_approve(self, request, queryset):
        updated = 0
        for rule_request in queryset.filter(status=RuleRequest.Status.PENDING_REVIEW):
            rule_request.status = RuleRequest.Status.APPROVED
            rule_request.approved_by = "Sentinel (simulated)"
            rule_request.save()
            updated += 1
        self.message_user(
            request,
            f"Simulated Sentinel approval for {updated} request(s).",
            level=messages.SUCCESS,
        )

    @admin.action(description="Simulate Sentinel rejection")
    def simulate_sentinel_reject(self, request, queryset):
        updated = 0
        for rule_request in queryset.filter(status=RuleRequest.Status.PENDING_REVIEW):
            rule_request.status = RuleRequest.Status.REJECTED
            rule_request.rejection_reason = "Rejected by Sentinel (simulated)."
            rule_request.save()
            updated += 1
        self.message_user(
            request,
            f"Simulated Sentinel rejection for {updated} request(s).",
            level=messages.SUCCESS,
        )