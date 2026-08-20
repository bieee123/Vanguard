"""Tests for the import_dettct management command and Django Q task."""

# Standard Libraries
import tempfile
from pathlib import Path

# Django Imports
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

# Ghostwriter Libraries
from ghostwriter.dettct.models import DeTTCTRun
from ghostwriter.dettct.tasks import import_dettct_output

VALID_YAML = """\
version: "1.1"
file_type: data-source-administration
name: Endpoints
date: 2026-08-01
data_sources:
  - data_source_name: Process Creation
    data_source:
      - applicable_to: [all]
        date_registered: 2026-01-01
        products: [Windows Event Log]
        available_for_data_analytics: true
        data_quality:
          device_completeness: 4
          data_field_completeness: 4
          timeliness: 3
          consistency: 4
          retention: 5
"""


def _write_fixture(content):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        f.write(content)
        return Path(f.name)


class ImportDettctCommandTests(TestCase):
    def test_import_success(self):
        path = _write_fixture(VALID_YAML)
        call_command("import_dettct", str(path))
        run = DeTTCTRun.objects.get()
        self.assertEqual(run.output_file_path, str(path))
        self.assertEqual(run.source_file_type, "data-source-administration")
        self.assertEqual(run.run_at.date().isoformat(), "2026-08-01")
        self.assertEqual(run.coverage_stats["data_source_count"], 1)

    def test_run_at_override(self):
        path = _write_fixture(VALID_YAML)
        call_command("import_dettct", str(path), "--run-at", "2026-09-15T10:00:00Z")
        run = DeTTCTRun.objects.get()
        self.assertEqual(run.run_at.date().isoformat(), "2026-09-15")

    def test_missing_file_raises(self):
        with self.assertRaises(CommandError):
            call_command("import_dettct", "/nonexistent/path.yaml")

    def test_invalid_yaml_raises(self):
        path = _write_fixture("not: [valid\n")
        with self.assertRaises(CommandError):
            call_command("import_dettct", str(path))


class ImportDettctTaskTests(TestCase):
    def test_task_uses_default_path(self):
        path = _write_fixture(VALID_YAML)
        with override_settings(VANGUARD_DETTCT_OUTPUT_PATH=str(path)):
            run_id = import_dettct_output()
        self.assertIsNotNone(run_id)
        run = DeTTCTRun.objects.get(pk=run_id)
        self.assertEqual(run.output_file_path, str(path))

    def test_task_returns_none_without_path(self):
        with override_settings(VANGUARD_DETTCT_OUTPUT_PATH=""):
            self.assertIsNone(import_dettct_output())
        self.assertEqual(DeTTCTRun.objects.count(), 0)

    def test_task_returns_none_on_parse_error(self):
        with override_settings(VANGUARD_DETTCT_OUTPUT_PATH="/nonexistent.yaml"):
            self.assertIsNone(import_dettct_output())
        self.assertEqual(DeTTCTRun.objects.count(), 0)