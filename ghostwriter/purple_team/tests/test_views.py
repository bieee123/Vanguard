"""Tests for the Purple Team Sync views."""

# Django Imports
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

# Ghostwriter Libraries
from ghostwriter.dettct.models import DeTTCTRun
from ghostwriter.factories import AdminFactory, ProjectFactory, UserFactory
from ghostwriter.purple_team.models import DetectionVerdict, RuleRequest, TimelineEntry

PASSWORD = "SuperNaturalReporting!"


class TimelineViewTests(TestCase):
    """Test the timeline list/detail/create/update views."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = AdminFactory(password=PASSWORD)
        cls.user = UserFactory(password=PASSWORD)
        cls.project = ProjectFactory()
        cls.entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1059.001",
            timestamp=timezone.now(),
            action_description="Ran encoded PowerShell",
            outcome=TimelineEntry.Outcome.SUCCESS,
        )

    def setUp(self):
        self.client.login(username=self.admin.username, password=PASSWORD)

    def test_list_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("purple_team:timeline_list"))
        self.assertEqual(response.status_code, 302)

    def test_list_renders(self):
        response = self.client.get(reverse("purple_team:timeline_list"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Activity Timeline")
        self.assertContains(response, "T1059.001")

    def test_list_filters_by_technique(self):
        response = self.client.get(
            reverse("purple_team:timeline_list"), {"technique": "T1059.001"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "T1059.001")

    def test_detail_renders(self):
        response = self.client.get(
            reverse("purple_team:timeline_detail", args=[self.entry.id])
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Timeline Entry")
        self.assertContains(response, "Detection Verdict")

    def test_create_renders_form(self):
        response = self.client.get(reverse("purple_team:timeline_create"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Add New Timeline Entry")

    def test_create_privilege_required(self):
        self.client.login(username=self.user.username, password=PASSWORD)
        response = self.client.get(reverse("purple_team:timeline_create"))
        self.assertRedirects(response, reverse("home:dashboard"))

    def test_create_creates_verdict(self):
        response = self.client.post(
            reverse("purple_team:timeline_create"),
            {
                "engagement": self.project.id,
                "technique_id": "T1003.001",
                "timestamp": "2026-01-01T10:00",
                "action_description": "Dumped LSASS",
                "outcome": "success",
            },
        )
        entry = TimelineEntry.objects.get(technique_id="T1003.001")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(entry.operator, self.admin)
        self.assertTrue(DetectionVerdict.objects.filter(timeline_entry=entry).exists())

    def test_update_renders_form(self):
        response = self.client.get(
            reverse("purple_team:timeline_update", args=[self.entry.id])
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Edit Timeline Entry")

    def test_update_saves_changes(self):
        response = self.client.post(
            reverse("purple_team:timeline_update", args=[self.entry.id]),
            {
                "engagement": self.project.id,
                "technique_id": "T1059.001",
                "timestamp": self.entry.timestamp.strftime("%Y-%m-%dT%H:%M"),
                "action_description": "Updated description",
                "outcome": "failed",
            },
        )
        self.assertEqual(response.status_code, 302)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.action_description, "Updated description")


class MatrixViewTests(TestCase):
    """Test the ATT&CK Matrix heatmap + gap report view."""

    @classmethod
    def setUpTestData(cls):
        cls.user = UserFactory(password=PASSWORD)
        cls.project = ProjectFactory()
        gap_entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1562.001",
            timestamp=timezone.now(),
            action_description="Tampered with EDR",
        )
        DetectionVerdict.objects.create(
            timeline_entry=gap_entry, verdict=DetectionVerdict.Verdict.NOT_DETECTED
        )
        cls.rule_request = RuleRequest.objects.create(
            technique_id="T1562.001",
            draft_rule_xml="<rule id=\"100001\">...</rule>",
        )
        DeTTCTRun.objects.create(
            output_file_path="/tmp/dettct.yaml",
            run_at=timezone.now(),
            payload={
                "file_type": "techniques-administration",
                "name": "Endpoints",
                "data_sources": [
                    {"name": "Process Creation", "connected": True, "products": [], "average_quality": 4.0}
                ],
                "techniques": [
                    {"technique_id": "T1059.001", "name": "PowerShell", "detection_score": 4, "visibility_score": 3, "detection_count": 1},
                    {"technique_id": "T1562.001", "name": "Impair Defenses", "detection_score": 0, "visibility_score": 1, "detection_count": 1},
                ],
                "groups": [
                    {"group_name": "FIN7", "campaign": "", "technique_ids": ["T1059.001"]}
                ],
            },
        )

    def setUp(self):
        self.client.login(username=self.user.username, password=PASSWORD)

    def test_matrix_renders(self):
        response = self.client.get(reverse("purple_team:matrix"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "ATT&amp;CK Matrix")
        self.assertContains(response, "Detection Gap Report")
        self.assertContains(response, "Technique Heatmap")
        self.assertContains(response, "T1562.001")
        self.assertContains(response, "Rule Requests")

    def test_matrix_shows_stats(self):
        response = self.client.get(reverse("purple_team:matrix"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Detection Coverage")

    def test_matrix_renders_dettct_panel(self):
        # The long-term coverage panel (design.md 5.6) appears on the matrix page
        # fed by the latest DeTT&CT run; a "Last updated" label distinguishes it.
        response = self.client.get(reverse("purple_team:matrix"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Long-term Coverage (DeTT")
        self.assertContains(response, "Last updated")


class RuleRequestViewTests(TestCase):
    """Test the rule request workflow views."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = AdminFactory(password=PASSWORD)
        cls.user = UserFactory(password=PASSWORD)
        cls.rule_request = RuleRequest.objects.create(
            technique_id="T1562.001",
            draft_rule_xml="<rule id=\"100001\">...</rule>",
        )

    def setUp(self):
        self.client.login(username=self.admin.username, password=PASSWORD)

    def test_list_renders(self):
        response = self.client.get(reverse("purple_team:rule_request_list"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Rule Requests")
        self.assertContains(response, "T1562.001")

    def test_detail_renders_tracker(self):
        response = self.client.get(
            reverse("purple_team:rule_request_detail", args=[self.rule_request.id])
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Status Tracker")
        self.assertContains(response, "Draft")

    def test_create_renders_form(self):
        response = self.client.get(reverse("purple_team:rule_request_create"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "New Rule Request")

    def test_create_prefills_technique(self):
        response = self.client.get(
            reverse("purple_team:rule_request_create"), {"technique": "T1562.001"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "T1562.001")

    def test_create_saves_draft(self):
        response = self.client.post(
            reverse("purple_team:rule_request_create"),
            {
                "technique_id": "T1003.001",
                "draft_rule_xml": "<rule id=\"100002\">...</rule>",
                "justification": "LSASS dump goes undetected.",
            },
        )
        request_obj = RuleRequest.objects.get(technique_id="T1003.001")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(request_obj.status, RuleRequest.Status.DRAFT)
        self.assertEqual(request_obj.requested_by, self.admin)

    def test_submit_moves_to_pending_review(self):
        response = self.client.post(
            reverse("purple_team:rule_request_submit", args=[self.rule_request.id])
        )
        self.assertEqual(response.status_code, 200)
        self.rule_request.refresh_from_db()
        self.assertEqual(self.rule_request.status, RuleRequest.Status.PENDING_REVIEW)

    def test_submit_requires_privileged(self):
        self.client.login(username=self.user.username, password=PASSWORD)
        response = self.client.post(
            reverse("purple_team:rule_request_submit", args=[self.rule_request.id])
        )
        self.assertEqual(response.status_code, 403)

    def test_submit_rejects_non_draft(self):
        self.rule_request.status = RuleRequest.Status.APPROVED
        self.rule_request.save()
        response = self.client.post(
            reverse("purple_team:rule_request_submit", args=[self.rule_request.id])
        )
        self.assertEqual(response.status_code, 400)


class ConfirmVerdictTests(TestCase):
    """Test the AJAX confirm-verdict endpoint."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = AdminFactory(password=PASSWORD)
        cls.user = UserFactory(password=PASSWORD)
        cls.project = ProjectFactory()
        cls.entry = TimelineEntry.objects.create(
            engagement=cls.project,
            technique_id="T1059.001",
            timestamp=timezone.now(),
            action_description="Ran PowerShell",
        )

    def setUp(self):
        self.client.login(username=self.admin.username, password=PASSWORD)

    def test_confirm_verdict_creates_and_marks_confirmed(self):
        response = self.client.post(
            reverse("purple_team:ajax_confirm_verdict", args=[self.entry.id]),
            {"verdict": "detected", "matched_sentinel_alert_id": "ALERT-0001"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            response.content,
            {"status": "ok", "verdict": "detected", "label": "Detected"},
        )
        verdict = DetectionVerdict.objects.get(timeline_entry=self.entry)
        self.assertTrue(verdict.confirmed_by_operator)
        self.assertEqual(verdict.matched_sentinel_alert_id, "ALERT-0001")

    def test_confirm_verdict_requires_privileged(self):
        self.client.login(username=self.user.username, password=PASSWORD)
        response = self.client.post(
            reverse("purple_team:ajax_confirm_verdict", args=[self.entry.id]),
            {"verdict": "detected"},
        )
        self.assertEqual(response.status_code, 403)