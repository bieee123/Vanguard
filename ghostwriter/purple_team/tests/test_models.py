"""Tests for the Purple Team Sync models."""

# Django Imports
from django.test import TestCase
from django.utils import timezone

# Ghostwriter Libraries
from ghostwriter.assets.models import Asset
from ghostwriter.factories import ProjectFactory, UserFactory
from ghostwriter.purple_team.models import DetectionVerdict, RuleRequest, TimelineEntry


class TimelineEntryTests(TestCase):
    """Test :model:`purple_team.TimelineEntry`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.asset = Asset.objects.create(hostname="web-01.corp.example", ip_address="10.0.0.5")
        cls.entry = TimelineEntry.objects.create(
            engagement=cls.project,
            asset=cls.asset,
            technique_id="T1059.001",
            timestamp=timezone.now(),
            action_description="Ran encoded PowerShell",
            outcome=TimelineEntry.Outcome.SUCCESS,
        )

    def test_str(self):
        self.assertIn("T1059.001", str(self.entry))

    def test_get_absolute_url(self):
        self.assertEqual(
            self.entry.get_absolute_url(), f"/attack-matrix/timeline/{self.entry.id}"
        )

    def test_verdict_one_to_one(self):
        DetectionVerdict.objects.create(timeline_entry=self.entry)
        self.assertEqual(self.entry.verdict.verdict, DetectionVerdict.Verdict.UNTESTED)


class DetectionVerdictTests(TestCase):
    """Test :model:`purple_team.DetectionVerdict`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.user = UserFactory()
        cls.entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1003.001",
            timestamp=timezone.now(),
            action_description="Dumped LSASS",
        )
        cls.verdict = DetectionVerdict.objects.create(
            timeline_entry=cls.entry,
            verdict=DetectionVerdict.Verdict.DETECTED,
            matched_sentinel_alert_id="ALERT-0001",
            confirmed_by_operator=True,
            confirmed_by=cls.user,
            confirmed_at=timezone.now(),
        )

    def test_str(self):
        self.assertIn("Detected", str(self.verdict))

    def test_verdict_enum_values(self):
        self.assertEqual(DetectionVerdict.Verdict.NOT_DETECTED, "not_detected")
        self.assertEqual(DetectionVerdict.Verdict.DETECTED_LATE, "detected_late")
        self.assertEqual(DetectionVerdict.Verdict.UNTESTED, "untested")


class RuleRequestTests(TestCase):
    """Test :model:`purple_team.RuleRequest`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()
        cls.user = UserFactory()
        cls.entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1562.001",
            timestamp=timezone.now(),
            action_description="Disabled EDR",
        )
        cls.request = RuleRequest.objects.create(
            technique_id="T1562.001",
            timeline_entry=cls.entry,
            draft_rule_xml="<rule id=\"100001\">...</rule>",
            justification="EDR tampering goes undetected.",
            requested_by=cls.user,
        )

    def test_default_status_is_draft(self):
        self.assertEqual(self.request.status, RuleRequest.Status.DRAFT)

    def test_str(self):
        self.assertIn("T1562.001", str(self.request))

    def test_get_absolute_url(self):
        self.assertEqual(
            self.request.get_absolute_url(), f"/attack-matrix/rule-requests/{self.request.id}"
        )

    def test_status_enum_values(self):
        self.assertEqual(RuleRequest.Status.PENDING_REVIEW, "pending_review")
        self.assertEqual(RuleRequest.Status.VERIFIED, "verified")