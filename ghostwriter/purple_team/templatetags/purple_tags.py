"""Custom template tags for the Purple Team Sync application."""

# Django Imports
from django import template

# Ghostwriter Libraries
from ghostwriter.purple_team.models import DetectionVerdict, RuleRequest

register = template.Library()

# Verdict -> Bootstrap badge/color mapping (design.md 4 detection verdict chip)
VERDICT_BADGE_MAP = {
    DetectionVerdict.Verdict.DETECTED: "badge-success",
    DetectionVerdict.Verdict.NOT_DETECTED: "badge-danger",
    DetectionVerdict.Verdict.DETECTED_NOT_ESCALATED: "badge-warning",
    DetectionVerdict.Verdict.DETECTED_LATE: "badge-info",
    DetectionVerdict.Verdict.UNTESTED: "badge-secondary",
}


@register.filter(name="verdict_badge")
def verdict_badge(value):
    """Return the Bootstrap badge class for a verdict value."""
    return VERDICT_BADGE_MAP.get(value, "badge-secondary")


@register.filter(name="verdict_icon")
def verdict_icon(value):
    """Return a short icon glyph for a verdict value (design.md 4)."""
    return {
        DetectionVerdict.Verdict.DETECTED: "\u2713",  # check
        DetectionVerdict.Verdict.NOT_DETECTED: "\u2717",  # x
        DetectionVerdict.Verdict.DETECTED_NOT_ESCALATED: "\u26a0",  # warning
        DetectionVerdict.Verdict.DETECTED_LATE: "\u23f1",  # clock
        DetectionVerdict.Verdict.UNTESTED: "\u2014",  # dash
    }.get(value, "\u2014")


@register.filter(name="rule_request_status_class")
def rule_request_status_class(value):
    """Return the pill class for a rule request status (design.md 4)."""
    return {
        RuleRequest.Status.DRAFT: "badge-secondary",
        RuleRequest.Status.PENDING_REVIEW: "badge-warning",
        RuleRequest.Status.APPROVED: "badge-success",
        RuleRequest.Status.DEPLOYED: "badge-info",
        RuleRequest.Status.REJECTED: "badge-danger",
        RuleRequest.Status.VERIFIED: "badge-success",
    }.get(value, "badge-secondary")


# The 5-step visible sequence + the rejected terminal state (design.md 4).
RULE_REQUEST_STEPS = [
    ("draft", "Draft"),
    ("pending_review", "Pending Review"),
    ("approved", "Approved"),
    ("deployed", "Deployed"),
    ("verified", "Verified"),
]


@register.simple_tag
def rule_request_steps(status):
    """Return the list of step tuples for the status tracker template."""
    return RULE_REQUEST_STEPS


@register.simple_tag
def rule_request_step_state(status, step):
    """Classify a tracker step for a given status.

    Returns one of: ``current``, ``complete``, ``rejected``, or ``pending``.
    """
    if status == RuleRequest.Status.REJECTED:
        return "rejected"
    ordered = [step_key for step_key, _label in RULE_REQUEST_STEPS]
    if step not in ordered or status not in ordered:
        return "pending"
    if status == step:
        return "current"
    if ordered.index(step) < ordered.index(status):
        return "complete"
    return "pending"