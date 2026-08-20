"""Tests for the DeTT&CT views."""

# Django Imports
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

# Ghostwriter Libraries
from ghostwriter.dettct.models import DeTTCTRun
from ghostwriter.factories import UserFactory

PASSWORD = "SuperNaturalReporting!"


class DeTTCTViewTests(TestCase):
    """Test the DeTT&CT coverage views."""

    @classmethod
    def setUpTestData(cls):
        cls.user = UserFactory(password=PASSWORD)
        cls.dettct_run = DeTTCTRun.objects.create(
            output_file_path="/tmp/dettct.yaml",
            run_at=timezone.now(),
            payload={
                "file_type": "techniques-administration",
                "name": "Endpoints",
                "data_sources": [
                    {"name": "Process Creation", "connected": True, "products": ["Windows Event Log"], "average_quality": 4.0}
                ],
                "techniques": [
                    {"technique_id": "T1059.001", "name": "PowerShell", "detection_score": 4, "visibility_score": 3, "detection_count": 1},
                    {"technique_id": "T1562.001", "name": "Impair Defenses", "detection_score": 0, "visibility_score": 1, "detection_count": 1},
                ],
                "groups": [
                    {"group_name": "FIN7", "campaign": "Carbon Spider", "technique_ids": ["T1059.001"]}
                ],
            },
        )

    def setUp(self):
        self.client.login(username=self.user.username, password=PASSWORD)

    def test_index_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse("dettct:index"))
        self.assertEqual(response.status_code, 302)

    def test_index_renders(self):
        response = self.client.get(reverse("dettct:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Long-term Coverage")
        self.assertContains(response, "Last updated")
        self.assertContains(response, "Process Creation")
        self.assertContains(response, "T1059.001")
        self.assertContains(response, "FIN7")

    def test_index_empty_state(self):
        DeTTCTRun.objects.all().delete()
        response = self.client.get(reverse("dettct:index"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "No DeTT&amp;CT output has been imported yet")

    def test_run_detail(self):
        response = self.client.get(reverse("dettct:run_detail", args=[self.dettct_run.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Raw Snapshot")
        self.assertContains(response, "/tmp/dettct.yaml")

    def test_run_detail_missing(self):
        response = self.client.get(reverse("dettct:run_detail", args=[99999]))
        self.assertEqual(response.status_code, 404)