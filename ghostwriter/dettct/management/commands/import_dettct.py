"""Management command to import a DeTT&CT output file into Vanguard.

Usage::

    python manage.py import_dettct <path> [--run-at "2026-08-20T00:00:00Z"]

This reads a DeTT&CT YAML/JSON administration file (data-source, technique, or
group) and stores a new :model:`dettct.DeTTCTRun` row that powers the read-only
"Long-term Coverage (DeTT&CT)" panel (design.md 5.6). It can be run manually for
the SETUP.md 11 checkpoint or invoked by a cron/Django Q scheduled job.
"""

# Standard Libraries
from datetime import datetime

# Django Imports
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

# Ghostwriter Libraries
from ghostwriter.dettct.models import DeTTCTRun
from ghostwriter.dettct.parser import parse_dettct_file


class Command(BaseCommand):
    help = "Import a DeTT&CT output file into the Long-term Coverage panel."

    def add_arguments(self, parser):
        parser.add_argument("path", help="Path to the DeTT&CT output YAML/JSON file.")
        parser.add_argument(
            "--run-at",
            help="Override the run timestamp (ISO 8601). Defaults to the file date or now.",
        )

    def handle(self, *args, **options):
        path = options["path"]
        try:
            payload = parse_dettct_file(path)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        run_at = payload.get("date")
        if options["run_at"]:
            run_at = options["run_at"]
        try:
            if isinstance(run_at, str):
                run_at = datetime.fromisoformat(run_at.replace("Z", "+00:00"))
            if run_at and run_at.tzinfo is None:
                run_at = timezone.make_aware(run_at)
        except (TypeError, ValueError):
            run_at = None

        run = DeTTCTRun.objects.create(
            output_file_path=path,
            run_at=run_at or timezone.now(),
            payload=payload,
        )
        stats = run.coverage_stats
        self.stdout.write(
            self.style.SUCCESS(
                f"Imported DeTT&CT run {run.pk} ({run.run_at:%Y-%m-%d %H:%M}) "
                f"from {path}"
            )
        )
        self.stdout.write(
            f"  Techniques: {stats['total_techniques']} "
            f"(covered: {stats['covered_techniques']})"
        )
        self.stdout.write(f"  Data sources: {stats['data_source_count']}")
        self.stdout.write(f"  Threat groups: {stats['group_count']}")