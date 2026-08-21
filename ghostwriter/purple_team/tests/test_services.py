"""Tests for the Purple Team Sync service helpers."""

# Standard Libraries
from datetime import timedelta

# Django Imports
from django.test import TestCase
from django.utils import timezone

# Ghostwriter Libraries
from ghostwriter.factories import ProjectFactory
from ghostwriter.purple_team.models import DetectionVerdict, TimelineEntry
from ghostwriter.purple_team.services import (
    DEFAULT_CORRELATION_WINDOW_SECONDS,
    detection_gap_report,
    heatmap_data,
    mock_sentinel_alerts,
    suggest_alert_match,
    verdict_stats,
)


class VerdictStatsTests(TestCase):
    """Test :func:`purple_team.services.verdict_stats`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.entries = [
            TimelineEntry.objects.create(
                engagement=cls.project,
                technique_id="T1059.001",
                timestamp=timezone.now(),
                action_description=f"Action {i}",
            )
            for i in range(4)
        ]
        DetectionVerdict.objects.create(
            timeline_entry=cls.entries[0], verdict=DetectionVerdict.Verdict.DETECTED
        )
        DetectionVerdict.objects.create(
            timeline_entry=cls.entries[1], verdict=DetectionVerdict.Verdict.NOT_DETECTED
        )
        DetectionVerdict.objects.create(
            timeline_entry=cls.entries[2], verdict=DetectionVerdict.Verdict.DETECTED_LATE
        )

    def test_counts_and_coverage(self):
        stats = verdict_stats()
        self.assertEqual(stats["total"], 3)
        self.assertEqual(stats["detected"], 2)
        self.assertEqual(stats["not_detected"], 1)
        self.assertEqual(stats["detected_late"], 1)
        self.assertEqual(stats["coverage_percent"], 67)

    def test_empty_queryset(self):
        stats = verdict_stats(queryset=TimelineEntry.objects.none())
        self.assertEqual(stats["total"], 0)
        self.assertEqual(stats["coverage_percent"], 0)


class DetectionGapReportTests(TestCase):
    """Test :func:`purple_team.services.detection_gap_report`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.gap_entries = [
            TimelineEntry.objects.create(
                engagement=cls.project,
                technique_id="T1562.001",
                timestamp=timezone.now(),
                action_description="Tampered with EDR",
            )
            for _ in range(2)
        ]
        cls.detected_entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1003.001",
            timestamp=timezone.now(),
            action_description="Dumped LSASS",
        )
        DetectionVerdict.objects.create(
            timeline_entry=cls.gap_entries[0], verdict=DetectionVerdict.Verdict.NOT_DETECTED
        )
        DetectionVerdict.objects.create(
            timeline_entry=cls.gap_entries[1], verdict=DetectionVerdict.Verdict.NOT_DETECTED
        )
        DetectionVerdict.objects.create(
            timeline_entry=cls.detected_entry, verdict=DetectionVerdict.Verdict.DETECTED
        )

    def test_returns_only_not_detected_techniques(self):
        report = detection_gap_report()
        self.assertEqual(len(report), 1)
        self.assertEqual(report[0]["technique_id"], "T1562.001")
        self.assertEqual(report[0]["count"], 2)


class HeatmapDataTests(TestCase):
    """Test :func:`purple_team.services.heatmap_data`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.late_entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1055",
            tactic="defense-evasion",
            timestamp=timezone.now(),
            action_description="Ran injection",
        )
        cls.detected_entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1055",
            tactic="defense-evasion",
            timestamp=timezone.now(),
            action_description="Ran injection again",
        )
        DetectionVerdict.objects.create(
            timeline_entry=cls.late_entry, verdict=DetectionVerdict.Verdict.DETECTED_LATE
        )
        DetectionVerdict.objects.create(
            timeline_entry=cls.detected_entry, verdict=DetectionVerdict.Verdict.DETECTED
        )

    def test_uses_most_severe_verdict_and_counts(self):
        data = heatmap_data()
        row = data["T1055"]
        self.assertEqual(row["count"], 2)
        # DETECTED has higher weight than DETECTED_LATE
        self.assertEqual(row["verdict"], DetectionVerdict.Verdict.DETECTED)

    def test_tactic_filter(self):
        data = heatmap_data(tactic="defense-evasion")
        self.assertIn("T1055", data)


class SuggestAlertMatchTests(TestCase):
    """Test :func:`purple_team.services.suggest_alert_match`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1059.001",
            timestamp=timezone.now(),
            action_description="Ran PowerShell",
        )

    def test_matches_alert_within_window(self):
        alerts = [
            {"id": "ALERT-1", "timestamp": self.entry.timestamp + timedelta(seconds=90)}
        ]
        match = suggest_alert_match(self.entry, alerts)
        self.assertEqual(match["id"], "ALERT-1")

    def test_no_match_outside_window(self):
        outside = timedelta(seconds=DEFAULT_CORRELATION_WINDOW_SECONDS + 1)
        alerts = [{"id": "ALERT-2", "timestamp": self.entry.timestamp + outside}]
        self.assertIsNone(suggest_alert_match(self.entry, alerts))


class MockSentinelAlertsTests(TestCase):
    """Test :func:`purple_team.services.mock_sentinel_alerts`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1059.001",
            timestamp=timezone.now(),
            action_description="Ran PowerShell",
        )

    def test_returns_deterministic_mock_alert(self):
        alerts = mock_sentinel_alerts(self.entry)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["id"], f"ALERT-{self.entry.id:04d}")
        self.assertEqual(alerts[0]["asset"], "target")