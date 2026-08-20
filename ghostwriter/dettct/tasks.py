"""This contains tasks to be run using Django Q and Redis for DeTT&CT.

Per PRD 1.1 / SETUP.md 11, DeTT&CT itself runs as a standalone scheduled job
(cron or sidecar) and writes its YAML output to a known path. These tasks only
read that output file and import it into :model:`dettct.DeTTCTRun` so the panel
can render the latest snapshot. No DeTT&CT source code is embedded here.
"""

# Standard Libraries
import logging
from datetime import datetime

# Django Imports
from django.conf import settings
from django.utils import timezone

# Ghostwriter Libraries
from ghostwriter.dettct.models import DeTTCTRun
from ghostwriter.dettct.parser import parse_dettct_file

# Using __name__ resolves to ghostwriter.dettct.tasks
logger = logging.getLogger(__name__)


def import_dettct_output(output_path=None):
    """Import the latest DeTT&CT output file into a :model:`dettct.DeTTCTRun`.

    Runs as a Django Q background task so the scheduled job only needs to invoke
    this task (or the matching management command) after DeTT&CT has written its
    output. The path defaults to ``settings.VANGUARD_DETTCT_OUTPUT_PATH``.

    Returns the ID of the created run, or None if the file was not available.

    Args:
        output_path: Optional filesystem path to the DeTT&CT output file.
    """
    path = output_path or getattr(settings, "VANGUARD_DETTCT_OUTPUT_PATH", "")
    if not path:
        logger.warning("No DeTT&CT output path configured; skipping import")
        return None

    try:
        payload = parse_dettct_file(path)
    except ValueError as exc:
        logger.error("DeTT&CT import failed: %s", exc)
        return None

    run_at = payload.get("date")
    try:
        if isinstance(run_at, str):
            run_at = datetime.fromisoformat(run_at)
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
    logger.info(
        "Imported DeTT&CT run %s from %s (%s techniques, %s data sources, %s groups)",
        run.pk,
        path,
        stats["total_techniques"],
        stats["data_source_count"],
        stats["group_count"],
    )
    return run.pk