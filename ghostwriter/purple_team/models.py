"""This contains all the database models used by the Purple Team Sync application.

Purple Team Sync (PRD 5.7) correlates each offensive :model:`purple_team.TimelineEntry`
with SOC alert data and records a :model:`purple_team.DetectionVerdict` per action.
The verdicts roll up to the ATT&CK heatmap and Detection Gap Report (design.md 5.6).
The :model:`purple_team.RuleRequest` workflow (PRD 6.5 / SETUP.md 8) turns gaps into
Wazuh rule changes driven by Sentinel's approval, never self-approved from Vanguard.
"""

# Django Imports
from django.conf import settings
from django.db import models
from django.urls import reverse

# Ghostwriter Libraries
from ghostwriter.assets.models import Asset
from ghostwriter.rolodex.models import Project

# Verdicts match SCHEMA.md 5.7 (detection_verdict_type). ``untested`` is used for
# timeline entries that have not been correlated with SOC data yet.
DETECTION_VERDICT_CHOICES = [
    ("detected", "Detected"),
    ("not_detected", "Not Detected"),
    ("detected_not_escalated", "Detected but not escalated"),
    ("detected_late", "Detected late"),
    ("untested", "Untested"),
]

# Rule request lifecycle per SCHEMA.md 6.5. Only ``draft -> pending_review`` is
# triggerable from Vanguard's UI; everything after that is driven by Sentinel
# (approved/deployed/rejected) or the operator (verified) per SETUP.md 8.3.
RULE_REQUEST_STATUS_CHOICES = [
    ("draft", "Draft"),
    ("pending_review", "Pending Review"),
    ("approved", "Approved"),
    ("deployed", "Deployed"),
    ("rejected", "Rejected"),
    ("verified", "Verified"),
]


class TimelineEntry(models.Model):
    """Stores a single offensive action for Purple Team Sync correlation (PRD 5.5/5.7)."""

    class Outcome(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILED = "failed", "Failed"
        BLOCKED = "blocked", "Blocked"

    engagement = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="timeline_entries",
        help_text="Engagement this action belongs to.",
    )
    asset = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timeline_entries",
        help_text="Target asset of the action, when known.",
    )
    technique_id = models.CharField(
        "ATT&CK Technique ID",
        max_length=20,
        default="",
        blank=True,
        help_text="MITRE ATT&CK technique ID, e.g. T1059.001.",
    )
    tactic = models.CharField(
        "Tactic",
        max_length=50,
        default="",
        blank=True,
        help_text="ATT&CK tactic, e.g. initial-access, persistence.",
    )
    timestamp = models.DateTimeField("Timestamp", help_text="When the action occurred.")
    action_description = models.TextField(
        "Action",
        help_text="High-level description of the action taken.",
    )
    outcome = models.CharField(
        "Outcome",
        max_length=20,
        choices=Outcome.choices,
        default=Outcome.SUCCESS,
        help_text="Did the action succeed, fail, or get blocked?",
    )
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="timeline_entries",
    )
    note = models.TextField(
        "Note",
        default="",
        blank=True,
        help_text="Optional operator context (e.g. paused, blackout window).",
    )
    sequence_order = models.IntegerField(
        "Sequence order",
        default=0,
        help_text="Order of the action within the engagement's attack path.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["engagement", "timestamp", "sequence_order"]
        verbose_name = "Timeline entry"
        verbose_name_plural = "Timeline entries"
        indexes = [
            models.Index(fields=["engagement", "timestamp"], name="timeline_eng_ts_idx"),
            models.Index(fields=["technique_id"], name="timeline_technique_idx"),
        ]

    def __str__(self):
        return f"{self.timestamp:%Y-%m-%d %H:%M} {self.technique_id or 'untagged'}"

    def get_absolute_url(self):
        return reverse("purple_team:timeline_detail", args=[str(self.id)])


class DetectionVerdict(models.Model):
    """Stores the SOC correlation result for a single timeline entry (PRD 5.7)."""

    class Verdict(models.TextChoices):
        DETECTED = "detected", "Detected"
        NOT_DETECTED = "not_detected", "Not Detected"
        DETECTED_NOT_ESCALATED = "detected_not_escalated", "Detected but not escalated"
        DETECTED_LATE = "detected_late", "Detected late"
        UNTESTED = "untested", "Untested"

    timeline_entry = models.OneToOneField(
        TimelineEntry,
        on_delete=models.CASCADE,
        related_name="verdict",
        help_text="The timeline entry this verdict applies to.",
    )
    matched_sentinel_alert_id = models.CharField(
        "Matched Sentinel alert ID",
        max_length=255,
        default="",
        blank=True,
        help_text="Alert ID from Sentinel once a match is confirmed.",
    )
    verdict = models.CharField(
        "Verdict",
        max_length=30,
        choices=Verdict.choices,
        default=Verdict.UNTESTED,
        help_text="Detection outcome for this action.",
    )
    detection_delay_seconds = models.IntegerField(
        "Detection delay (seconds)",
        null=True,
        blank=True,
        help_text="Delay between action and detection for 'detected_late' verdicts.",
    )
    confirmed_by_operator = models.BooleanField(
        "Confirmed by operator",
        default=False,
        help_text="True when the operator accepted the auto-suggested match.",
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_verdicts",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["timeline_entry", "created_at"]
        verbose_name = "Detection verdict"
        verbose_name_plural = "Detection verdicts"
        indexes = [
            models.Index(fields=["verdict"], name="verdict_value_idx"),
        ]

    def __str__(self):
        return f"{self.timeline_entry} -> {self.get_verdict_display()}"


class RuleRequest(models.Model):
    """Stores a detection-gap to Wazuh rule change request (PRD 6.5 / SETUP.md 8)."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_REVIEW = "pending_review", "Pending Review"
        APPROVED = "approved", "Approved"
        DEPLOYED = "deployed", "Deployed"
        REJECTED = "rejected", "Rejected"
        VERIFIED = "verified", "Verified"

    technique_id = models.CharField(
        "ATT&CK Technique ID",
        max_length=20,
        help_text="The technique that produced the detection gap.",
    )
    timeline_entry = models.ForeignKey(
        TimelineEntry,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rule_requests",
        help_text="Optional timeline entry that produced the gap.",
    )
    draft_rule_xml = models.TextField(
        "Draft rule XML",
        help_text="Draft Wazuh/Sigma rule text for the gap.",
    )
    test_log_sample_path = models.CharField(
        "Test log sample path",
        max_length=500,
        default="",
        blank=True,
        help_text="Path to a sample log that should trigger the rule.",
    )
    justification = models.TextField(
        "Justification",
        default="",
        blank=True,
        help_text="Why this rule is needed and what it should detect.",
    )
    status = models.CharField(
        "Status",
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        help_text="Lifecycle state of this request.",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="rule_requests",
    )
    requested_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.CharField(
        "Approved by (Sentinel)",
        max_length=255,
        default="",
        blank=True,
        help_text="Sentinel-side identity that approved the request.",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    deployed_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(
        "Rejection reason",
        default="",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Rule request"
        verbose_name_plural = "Rule requests"
        indexes = [
            models.Index(fields=["status"], name="rule_request_status_idx"),
            models.Index(fields=["technique_id"], name="rule_request_technique_idx"),
        ]

    def __str__(self):
        return f"Rule request {self.pk} ({self.technique_id}, {self.get_status_display()})"

    def get_absolute_url(self):
        return reverse("purple_team:rule_request_detail", args=[str(self.id)])