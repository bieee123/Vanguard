"""Service helpers for Purple Team Sync (PRD 5.7 / SETUP.md 7).

Provides the Detection Gap Report query, ATT&CK heatmap aggregation, and the
Sentinel alert lookup stub. The Sentinel client is intentionally a mock at this
stage (SETUP.md 7.4) so the whole UI can be built and tested before Step 9
replaces it with live calls.
"""

# Standard Libraries
import logging
from datetime import timedelta

# Ghostwriter Libraries
from ghostwriter.purple_team.models import DetectionVerdict, TimelineEntry

# Using __name__ resolves to ghostwriter.purple_team.services
logger = logging.getLogger(__name__)

# Threshold (seconds) used by the mock lookup to suggest a match when an alert
# falls inside the configured correlation window around an action's timestamp.
DEFAULT_CORRELATION_WINDOW_SECONDS = 300


def verdict_stats(queryset=None):
    """Return counts per verdict for a queryset of timeline entries.

    ``queryset`` defaults to all entries. The summary banner in design.md 5.4
    ("Detection Coverage: 62% (18/29 actions detected)") is built from this.
    """
    entries = TimelineEntry.objects.all() if queryset is None else queryset
    rows = list(
        entries.filter(verdict__isnull=False).select_related("verdict")
    )
    total = len(rows)
    detected = sum(
        1
        for row in rows
        if row.verdict.verdict
        in (DetectionVerdict.Verdict.DETECTED, DetectionVerdict.Verdict.DETECTED_LATE)
    )
    return {
        "total": total,
        "detected": detected,
        "not_detected": sum(
            1 for row in rows if row.verdict.verdict == DetectionVerdict.Verdict.NOT_DETECTED
        ),
        "detected_not_escalated": sum(
            1
            for row in rows
            if row.verdict.verdict == DetectionVerdict.Verdict.DETECTED_NOT_ESCALATED
        ),
        "detected_late": sum(
            1 for row in rows if row.verdict.verdict == DetectionVerdict.Verdict.DETECTED_LATE
        ),
        "untested": sum(
            1 for row in rows if row.verdict.verdict == DetectionVerdict.Verdict.UNTESTED
        ),
        "coverage_percent": round((detected / total) * 100) if total else 0,
    }


def detection_gap_report(queryset=None):
    """Return techniques that succeeded but were not detected, sorted by count.

    Each row: technique_id, name (best-effort, from the entry), count, verdict.
    The most frequent gaps are the direct input for Wazuh rule-tuning work.
    """
    entries = (queryset or TimelineEntry.objects.all()).select_related("verdict").order_by("technique_id")
    gaps = {}
    for entry in entries:
        if not entry.technique_id:
            continue
        verdict = getattr(entry, "verdict", None)
        if verdict is None or verdict.verdict != DetectionVerdict.Verdict.NOT_DETECTED:
            continue
        row = gaps.setdefault(
            entry.technique_id,
            {"technique_id": entry.technique_id, "name": "", "count": 0, "entries": []},
        )
        row["count"] += 1
        row["entries"].append(
            {
                "id": entry.id,
                "timestamp": entry.timestamp,
                "description": entry.action_description,
            }
        )
    report = sorted(gaps.values(), key=lambda row: row["count"], reverse=True)
    return report


def heatmap_data(queryset=None, tactic=None):
    """Return per-technique verdict aggregation for the ATT&CK heatmap.

    Returns a dict keyed by technique_id with the most severe/latest verdict
    plus the entry count, ready for template rendering.
    """
    entries = (queryset or TimelineEntry.objects.all()).filter(technique_id__gt="").select_related("verdict")
    if tactic:
        entries = entries.filter(tactic__iexact=tactic)

    _VERDICT_WEIGHT = {
        DetectionVerdict.Verdict.UNTESTED: 0,
        DetectionVerdict.Verdict.NOT_DETECTED: 1,
        DetectionVerdict.Verdict.DETECTED_NOT_ESCALATED: 2,
        DetectionVerdict.Verdict.DETECTED_LATE: 3,
        DetectionVerdict.Verdict.DETECTED: 4,
    }
    data = {}
    for entry in entries:
        verdict = getattr(entry, "verdict", None)
        verdict_value = getattr(verdict, "verdict", DetectionVerdict.Verdict.UNTESTED)
        row = data.setdefault(
            entry.technique_id,
            {"technique_id": entry.technique_id, "verdict": verdict_value, "count": 0, "weight": -1},
        )
        row["count"] += 1
        weight = _VERDICT_WEIGHT.get(verdict_value, 0)
        if weight > row["weight"]:
            row["weight"] = weight
            row["verdict"] = verdict_value
    return data


def suggest_alert_match(entry, alerts):
    """Suggest a matching Sentinel alert for a timeline entry, or None.

    A match is suggested when an alert is within the correlation window around
    the entry's timestamp (PRD 5.7). The operator confirms or rejects the match
    to avoid false correlation.
    """
    if not entry.timestamp:
        return None
    window = timedelta(seconds=DEFAULT_CORRELATION_WINDOW_SECONDS)
    for alert in alerts:
        alert_time = alert.get("timestamp")
        if not alert_time:
            continue
        delta = abs(alert_time - entry.timestamp)
        if delta <= window:
            return alert
    return None


def mock_sentinel_alerts(entry):
    """Mock Sentinel alert lookup (SETUP.md 7.4).

    Returns a fixed, deterministic fake alert so the correlation UI can be built
    and tested before Step 9 replaces this with a real ``/api/v1/soc/alerts`` call.
    """
    asset = getattr(entry, "asset", None)
    asset_name = (asset.hostname if asset and asset.hostname else asset.ip_address) if asset else "target"
    return [
        {
            "id": f"ALERT-{entry.id:04d}",
            "asset": asset_name,
            "timestamp": entry.timestamp + timedelta(seconds=90),
            "rule": f"Mock rule for {entry.technique_id or 'technique'}",
            "severity": "medium",
            "summary": "Mock alert for timeline entry (Sentinel integration pending).",
        }
    ]