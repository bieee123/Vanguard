"""Tests for the DeTT&CT models."""

# Django Imports
from django.test import TestCase
from django.utils import timezone

# Ghostwriter Libraries
from ghostwriter.dettct.models import DeTTCTRun


class DeTTCTRunModelTests(TestCase):
    """Test the :model:`dettct.DeTTCTRun` model."""

    @classmethod
    def setUpTestData(cls):
        cls.dettct_run = DeTTCTRun.objects.create(
            output_file_path="/tmp/dettct.yaml",
            run_at=timezone.now(),
            payload={
                "file_type": "techniques-administration",
                "name": "Endpoints",
                "data_sources": [
                    {"name": "Process Creation", "connected": True, "products": [], "average_quality": 4.0}
                ],
                "techniques": [
                    {"technique_id": "T1059.001", "name": "PowerShell", "detection_score": 4},
                    {"technique_id": "T1562.001", "name": "Impair Defenses", "detection_score": 0},
                ],
                "groups": [
                    {"group_name": "FIN7", "campaign": "", "technique_ids": ["T1059.001"]}
                ],
            },
        )

    def test_str(self):
        self.assertIn("DeTT&CT run", str(self.dettct_run))

    def test_get_absolute_url(self):
        self.assertEqual(self.dettct_run.get_absolute_url(), f"/attack-matrix/runs/{self.dettct_run.pk}")

    def test_data_sources_property(self):
        self.assertEqual(len(self.dettct_run.data_sources), 1)

    def test_techniques_property(self):
        self.assertEqual(len(self.dettct_run.techniques), 2)

    def test_groups_property(self):
        self.assertEqual(len(self.dettct_run.groups), 1)

    def test_source_file_type(self):
        self.assertEqual(self.dettct_run.source_file_type, "techniques-administration")

    def test_coverage_stats(self):
        stats = self.dettct_run.coverage_stats
        self.assertEqual(stats["total_techniques"], 2)
        self.assertEqual(stats["covered_techniques"], 1)
        self.assertEqual(stats["uncovered_techniques"], 1)
        self.assertEqual(stats["data_source_count"], 1)
        self.assertEqual(stats["group_count"], 1)

    def test_coverage_stats_empty_payload(self):
        empty = DeTTCTRun.objects.create(
            output_file_path="/tmp/empty.yaml",
            run_at=timezone.now(),
            payload={},
        )
        stats = empty.coverage_stats
        self.assertEqual(stats["total_techniques"], 0)
        self.assertEqual(stats["covered_techniques"], 0)
        self.assertEqual(stats["data_source_count"], 0)

    def test_ordering_newest_first(self):
        older = DeTTCTRun.objects.create(
            output_file_path="/tmp/older.yaml",
            run_at=timezone.now() - timezone.timedelta(days=1),
            payload={},
        )
        runs = list(DeTTCTRun.objects.all())
        self.assertEqual(runs[0], self.dettct_run)
        self.assertEqual(runs[1], older)