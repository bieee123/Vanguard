# Django Imports
from django.test import TestCase

# Ghostwriter Libraries
from ghostwriter.assets.models import Asset, EngagementAsset
from ghostwriter.factories import OplogEntryFactory, ProjectFactory


class AssetModelTests(TestCase):
    """Collection of tests for :model:`assets.Asset`."""

    @classmethod
    def setUpTestData(cls):
        cls.Asset = Asset
        cls.project = ProjectFactory()

    def test_crud_asset(self):
        asset = Asset.objects.create(
            hostname="dc01.vanguard.local",
            ip_address="10.10.10.10",
            criticality=Asset.Criticality.CRITICAL,
            status=Asset.Status.IN_SCOPE,
        )

        self.assertEqual(asset.hostname, "dc01.vanguard.local")
        self.assertEqual(asset.criticality, "critical")
        self.assertEqual(asset.status, "in_scope")
        self.assertEqual(str(asset), "dc01.vanguard.local")

        asset.hostname = "dc02.vanguard.local"
        asset.save()
        self.assertEqual(asset.hostname, "dc02.vanguard.local")

        asset.delete()
        self.assertFalse(Asset.objects.filter(pk=asset.pk).exists())

    def test_asset_defaults(self):
        asset = Asset.objects.create(hostname="web01")

        self.assertEqual(asset.criticality, Asset.Criticality.UNKNOWN)
        self.assertEqual(asset.status, Asset.Status.UNVERIFIED)
        self.assertEqual(asset.open_ports, [])

    def test_asset_default_str_when_no_hostname_or_ip(self):
        asset = Asset.objects.create(hostname="", ip_address="")

        self.assertEqual(str(asset), f"Asset {asset.pk}")

    def test_asset_link_to_project(self):
        asset = Asset.objects.create(hostname="db01")
        link = EngagementAsset.objects.create(asset=asset, project=self.project)

        self.assertEqual(asset.projects.count(), 1)
        self.assertEqual(asset.projects.first(), self.project)
        self.assertEqual(self.project.assets.count(), 1)
        self.assertEqual(str(link), f"{asset} ({self.project})")

    def test_unique_asset_project_pair(self):
        asset = Asset.objects.create(hostname="db01")
        EngagementAsset.objects.create(asset=asset, project=self.project)

        with self.assertRaises(Exception):
            EngagementAsset.objects.create(asset=asset, project=self.project)


class OplogEntryVanguardFieldsTests(TestCase):
    """Collection of tests for the Vanguard ATT&CK fields on :model:`oplog.OplogEntry`."""

    @classmethod
    def setUpTestData(cls):
        cls.project = ProjectFactory()

    def test_vanguard_fields_are_optional(self):
        entry = OplogEntryFactory(oplog_id__project=self.project)

        self.assertEqual(entry.technique_id, "")
        self.assertEqual(entry.tactic, "")
        self.assertEqual(entry.outcome, "")
        self.assertIsNone(entry.sequence_order)
        self.assertIsNone(entry.asset)

    def test_vanguard_fields_can_be_set(self):
        asset = Asset.objects.create(hostname="dc01")
        entry = OplogEntryFactory(
            oplog_id__project=self.project,
            technique_id="T1059.001",
            tactic="execution",
            outcome="success",
            sequence_order=1,
            asset=asset,
        )

        entry.refresh_from_db()
        self.assertEqual(entry.technique_id, "T1059.001")
        self.assertEqual(entry.tactic, "execution")
        self.assertEqual(entry.outcome, "success")
        self.assertEqual(entry.sequence_order, 1)
        self.assertEqual(entry.asset, asset)

    def test_entry_links_to_asset_inventory(self):
        asset = Asset.objects.create(hostname="dc01")
        entry = OplogEntryFactory(oplog_id__project=self.project, asset=asset)

        self.assertEqual(asset.oplog_entries.count(), 1)
        self.assertEqual(asset.oplog_entries.first(), entry)