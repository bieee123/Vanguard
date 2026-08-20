"""Tests for the DeTT&CT YAML parser."""

# Standard Libraries
import json
import tempfile
from pathlib import Path

# Django Imports
from django.test import SimpleTestCase

# 3rd Party Libraries
import yaml

# Ghostwriter Libraries
from ghostwriter.dettct.parser import (
    parse_data_source_administration,
    parse_dettct_file,
    parse_group_administration,
    parse_techniques_administration,
    parse_timestamp,
)

DATA_SOURCE_YAML = """\
version: "1.1"
file_type: data-source-administration
name: Endpoints
data_sources:
  - data_source_name: Process Creation
    data_source:
      - applicable_to: [all]
        date_registered: 2026-01-01
        date_connected: 2026-02-01
        products: [Windows Event Log]
        available_for_data_analytics: true
        comment: Sysmon EID 1
        data_quality:
          device_completeness: 4
          data_field_completeness: 4
          timeliness: 3
          consistency: 4
          retention: 5
  - data_source_name: Network Traffic Flow
    data_source:
      - applicable_to: [all]
        date_registered: 2026-01-01
        products: [Zeek]
        available_for_data_analytics: false
        data_quality:
          device_completeness: 1
          data_field_completeness: 2
          timeliness: 1
          consistency: 1
          retention: 2
"""

TECHNIQUES_YAML = """\
version: "1.2"
file_type: techniques-administration
name: Endpoints
techniques:
  - technique_id: T1059.001
    technique_name: "Command and Scripting Interpreter: PowerShell"
    detection:
      - applicable_to: [all]
        location: [SIEM: Encoded PowerShell]
        comment: ""
        score_logbook:
          - date: 2026-01-10
            score: 2
            comment: initial
          - date: 2026-03-01
            score: 4
            comment: tuned
    visibility:
      - applicable_to: [all]
        score_logbook:
          - date: 2026-01-10
            score: 3
  - technique_id: T1003.001
    technique_name: "OS Credential Dumping: LSASS Memory"
    detection:
      - applicable_to: [all]
        location: [EDR: LSASS access]
        score_logbook:
          - date: 2026-02-01
            score: 3
  - technique_id: T1562.001
    technique_name: "Impair Defenses: Disable or Modify Tools"
    detection:
      - applicable_to: [all]
        location: []
        score_logbook:
          - date: 2026-01-01
            score: 0
"""

GROUPS_YAML = """\
version: "1.0"
file_type: group-administration
name: Threat groups
groups:
  - group_name: FIN7
    campaign: Carbon Spider
    technique_id: [T1059.001, T1003.001, T1027]
    software_id: [S0245]
    enabled: true
  - group_name: APT29
    campaign: Midnight Blizzard
    technique_id: [T1059.001]
    enabled: true
"""


class ParseTimestampTests(SimpleTestCase):
    def test_none(self):
        self.assertIsNone(parse_timestamp(None))

    def test_empty_string(self):
        self.assertIsNone(parse_timestamp(""))

    def test_iso_string(self):
        self.assertEqual(parse_timestamp("2026-01-01"), "2026-01-01T00:00:00+00:00")

    def test_epoch_int(self):
        self.assertIsInstance(parse_timestamp(0), str)


class ParseDataSourceAdministrationTests(SimpleTestCase):
    def setUp(self):
        self.payload = parse_dettct_file(self._write(DATA_SOURCE_YAML))

    def _write(self, content):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(content)
            return Path(f.name)

    def test_file_type(self):
        self.assertEqual(self.payload["file_type"], "data-source-administration")

    def test_data_source_count(self):
        self.assertEqual(len(self.payload["data_sources"]), 2)

    def test_connected_flag(self):
        by_name = {ds["name"]: ds for ds in self.payload["data_sources"]}
        self.assertTrue(by_name["Process Creation"]["connected"])
        self.assertFalse(by_name["Network Traffic Flow"]["connected"])

    def test_quality_average(self):
        by_name = {ds["name"]: ds for ds in self.payload["data_sources"]}
        self.assertEqual(by_name["Process Creation"]["average_quality"], 4.0)

    def test_products_extracted(self):
        by_name = {ds["name"]: ds for ds in self.payload["data_sources"]}
        self.assertIn("Windows Event Log", by_name["Process Creation"]["products"])


class ParseTechniquesAdministrationTests(SimpleTestCase):
    def setUp(self):
        self.payload = parse_dettct_file(self._write(TECHNIQUES_YAML))

    def _write(self, content):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(content)
            return Path(f.name)

    def test_technique_count(self):
        self.assertEqual(len(self.payload["techniques"]), 3)

    def test_latest_detection_score(self):
        by_id = {t["technique_id"]: t for t in self.payload["techniques"]}
        self.assertEqual(by_id["T1059.001"]["detection_score"], 4)
        self.assertEqual(by_id["T1003.001"]["detection_score"], 3)
        self.assertEqual(by_id["T1562.001"]["detection_score"], 0)

    def test_visibility_score(self):
        by_id = {t["technique_id"]: t for t in self.payload["techniques"]}
        self.assertEqual(by_id["T1059.001"]["visibility_score"], 3)

    def test_detection_count(self):
        by_id = {t["technique_id"]: t for t in self.payload["techniques"]}
        self.assertEqual(by_id["T1059.001"]["detection_count"], 1)

    def test_technique_name(self):
        by_id = {t["technique_id"]: t for t in self.payload["techniques"]}
        self.assertIn("PowerShell", by_id["T1059.001"]["name"])


class ParseGroupAdministrationTests(SimpleTestCase):
    def setUp(self):
        self.payload = parse_dettct_file(self._write(GROUPS_YAML))

    def _write(self, content):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(content)
            return Path(f.name)

    def test_group_count(self):
        self.assertEqual(len(self.payload["groups"]), 2)

    def test_group_techniques(self):
        by_name = {g["group_name"]: g for g in self.payload["groups"]}
        self.assertIn("T1059.001", by_name["FIN7"]["technique_ids"])
        self.assertIn("T1027", by_name["FIN7"]["technique_ids"])

    def test_group_campaign(self):
        by_name = {g["group_name"]: g for g in self.payload["groups"]}
        self.assertEqual(by_name["FIN7"]["campaign"], "Carbon Spider")


class ParseDettctFileTests(SimpleTestCase):
    def test_json_input(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"file_type": "techniques-administration", "name": "t", "techniques": []}, f)
            path = Path(f.name)
        payload = parse_dettct_file(path)
        self.assertEqual(payload["file_type"], "techniques-administration")

    def test_type_inferred_from_keys(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("techniques: []\n")
            path = Path(f.name)
        payload = parse_dettct_file(path)
        self.assertEqual(payload["file_type"], "techniques-administration")

    def test_missing_file_raises(self):
        with self.assertRaises(ValueError):
            parse_dettct_file("/nonexistent/path.yaml")

    def test_invalid_yaml_raises(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("not: [valid yaml: :::\n")
            path = Path(f.name)
        with self.assertRaises(ValueError):
            parse_dettct_file(path)

    def test_non_mapping_raises(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("- just\n- a\n- list\n")
            path = Path(f.name)
        with self.assertRaises(ValueError):
            parse_dettct_file(path)


class DirectParserFunctionTests(SimpleTestCase):
    def test_parse_data_source_function(self):
        payload = parse_data_source_administration(yaml.safe_load(DATA_SOURCE_YAML))
        self.assertEqual(len(payload["data_sources"]), 2)

    def test_parse_techniques_function(self):
        payload = parse_techniques_administration(yaml.safe_load(TECHNIQUES_YAML))
        self.assertEqual(len(payload["techniques"]), 3)

    def test_parse_groups_function(self):
        payload = parse_group_administration(yaml.safe_load(GROUPS_YAML))
        self.assertEqual(len(payload["groups"]), 2)
