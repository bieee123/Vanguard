"""Simulate Sentinel's response to a rule request for local testing.

SETUP.md 8.3 requires that only ``draft -> pending_review`` is triggerable from
Vanguard's UI; every later transition is driven by Sentinel. This command stands
in for Sentinel's side so the full lifecycle can be tested without a live
Sentinel deployment (Step 9 replaces these transitions with real API calls).

Usage::

    python manage.py simulate_sentinel_rule_response <pk or technique_id> {approve|deploy|reject|verified} [reason]

Example lifecycle::

    submit a request in the UI (draft -> pending_review)
    simulate_sentinel_rule_response 12 approve
    simulate_sentinel_rule_response 12 deploy
    (retest in the UI -> verified, or back to draft on failure)
"""

# Django Imports
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

# Ghostwriter Libraries
from ghostwriter.purple_team.models import RuleRequest


class Command(BaseCommand):
    help = "Simulate Sentinel approving/deploying/rejecting/verifying a rule request."

    def add_arguments(self, parser):
        parser.add_argument("pk", type=int, help="Primary key of the RuleRequest.")
        parser.add_argument(
            "action",
            choices=["approve", "deploy", "reject", "verify"],
            help="Which Sentinel-side transition to simulate.",
        )
        parser.add_argument("reason", nargs="?", default="", help="Rejection reason.")

    def handle(self, *args, **kwargs):
        rule_request, action = kwargs["pk"], kwargs["action"]
        try:
            rule_request_obj = RuleRequest.objects.get(pk=rule_request)
        except RuleRequest.DoesNotExist as exc:
            raise CommandError(f"No RuleRequest found with pk={rule_request}.") from exc

        transitions = {
            "approve": ("pending_review", "approved"),
            "deploy": ("approved", "deployed"),
            "verify": ("deployed", "verified"),
        }
        if action == "reject":
            if rule_request_obj.status != RuleRequest.Status.PENDING_REVIEW:
                raise CommandError("Only pending_review requests can be rejected.")
            rule_request_obj.status = RuleRequest.Status.REJECTED
            rule_request_obj.rejection_reason = kwargs.get("reason") or "Rejected by Sentinel (simulated)."
            rule_request_obj.save()
            self.stdout.write(
                self.style.SUCCESS("Simulated Sentinel rejection. Request is now rejected.")
            )
            return

        expected, new_status = transitions[action]
        if rule_request_obj.status != expected:
            raise CommandError(
                f"Cannot take action '{action}': request is '{rule_request_obj.status}', expected '{expected}'."
            )
        rule_request_obj.status = new_status
        if action == "approve":
            rule_request_obj.approved_by = "Sentinel (simulated)"
            rule_request_obj.approved_at = timezone.now()
        elif action == "deploy":
            rule_request_obj.deployed_at = timezone.now()
        elif action == "verify":
            rule_request_obj.verified_at = timezone.now()
        rule_request_obj.save()
        self.stdout.write(
            self.style.SUCCESS(
                f"Simulated Sentinel response: request #{rule_request_obj.pk} is now '{rule_request_obj.status}'."
            )
        )