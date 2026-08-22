"""Tests for the Purple Team Sync management commands."""

# Standard Libraries
from io import StringIO

# Django Imports
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

# Ghostwriter Libraries
from ghostwriter.purple_team.models import RuleRequest


class SimulateSentinelRuleResponseTests(TestCase):
    """Test the ``simulate_sentinel_rule_response`` command (SETUP.md 8.3).

    The command stands in for Sentinel's side of the lifecycle so the full
    status tracker can be tested without a live Sentinel. It must never allow
    Vanguard to self-approve a request out of the documented transition order.
    """

    @classmethod
    def setUpTestData(cls):
        cls.request = RuleRequest.objects.create(
            technique_id="T1562.001",
            draft_rule_xml="<rule id=\"100001\">...</rule>",
        )

    def _run(self, *args, **kwargs):
        out = StringIO()
        call_command("simulate_sentinel_rule_response", *args, stdout=out, **kwargs)
        return out.getvalue()

    def test_approve_pending_review(self):
        self.request.status = RuleRequest.Status.PENDING_REVIEW
        self.request.save()
        self._run(self.request.pk, "approve")
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RuleRequest.Status.APPROVED)
        self.assertIsNotNone(self.request.approved_at)
        self.assertEqual(self.request.approved_by, "Sentinel (simulated)")

    def test_deploy_approved(self):
        self.request.status = RuleRequest.Status.APPROVED
        self.request.save()
        self._run(self.request.pk, "deploy")
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RuleRequest.Status.DEPLOYED)
        self.assertIsNotNone(self.request.deployed_at)

    def test_verify_deployed(self):
        self.request.status = RuleRequest.Status.DEPLOYED
        self.request.save()
        self._run(self.request.pk, "verify")
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RuleRequest.Status.VERIFIED)
        self.assertIsNotNone(self.request.verified_at)

    def test_reject_pending_review_with_reason(self):
        self.request.status = RuleRequest.Status.PENDING_REVIEW
        self.request.save()
        self._run(self.request.pk, "reject", "Noisy rule, high false-positive rate.")
        self.request.refresh_from_db()
        self.assertEqual(self.request.status, RuleRequest.Status.REJECTED)
        self.assertIn("false-positive", self.request.rejection_reason)

    def test_reject_requires_pending_review(self):
        self.request.status = RuleRequest.Status.DRAFT
        self.request.save()
        with self.assertRaises(CommandError):
            self._run(self.request.pk, "reject")

    def test_out_of_order_transition_raises(self):
        # Approve -> deploy is valid, but deploy must not be reached from
        # pending_review; the command enforces the documented transition order.
        self.request.status = RuleRequest.Status.PENDING_REVIEW
        self.request.save()
        with self.assertRaises(CommandError):
            self._run(self.request.pk, "deploy")