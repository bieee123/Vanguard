"""This contains all the database models used by the DeTT&CT application.

Vanguard does not embed DeTT&CT (PRD 1.1 / SETUP.md 11). DeTT&CT runs as a
standalone scheduled job that writes YAML administration files to a known path.
This app stores the parsed results of those files in :model:`dettct.DeTTCTRun`
rows so the read-only "Long-term Coverage (DeTT&CT)" panel (design.md 5.6) can
render the latest snapshot without re-reading the file on every page load.
"""

# Django Imports
from django.db import models
from django.urls import reverse

# Detection status buckets derived from DeTT&CT detection scores. Higher is
# better: a technique is "fully covered" only when its latest detection score
# is at least 3 (behavioral/tuned detection).
DETTCT_STATUS_CHOICES = [
    ("undetected", "Undetected"),
    ("partial", "Partially Covered"),
    ("covered", "Covered"),
    ("unknown", "Unknown"),
]


class DeTTCTRun(models.Model):
    """A single import of a DeTT&CT output file (data sources, techniques, groups).

    Matches the ``dettct_runs`` table in SCHEMA.md, extended with a ``payload``
    JSON field that holds the normalized parsed contents of the source file so
    the panel can render entirely from the database. Integer primary keys are
    used for consistency with the rest of the Ghostwriter/Vanguard schema (the
    UUID suggestion in SCHEMA.md is explicitly reconciled against the fork's
    actual integer-keyed tables).
    """

    output_file_path = models.CharField(
        "Output file path",
        max_length=500,
        help_text="Filesystem path of the DeTT&CT output file this run imported.",
    )
    run_at = models.DateTimeField(
        "Run at",
        help_text="Timestamp of the DeTT&CT job run (from the file's date, or when the job executed).",
    )
    imported_at = models.DateTimeField(
        "Imported at",
        auto_now_add=True,
        help_text="When this snapshot was imported into Vanguard.",
    )
    payload = models.JSONField(
        "Payload",
        default=dict,
        help_text="Normalized parsed contents of the DeTT&CT output file.",
    )

    class Meta:
        ordering = ["-run_at", "-imported_at"]
        verbose_name = "DeTT&CT run"
        verbose_name_plural = "DeTT&CT runs"

    def __str__(self):
        return f"DeTT&CT run {self.pk} ({self.run_at:%Y-%m-%d})"

    def get_absolute_url(self):
        return reverse("dettct:run_detail", args=[str(self.id)])

    @property
    def data_sources(self):
        """Return the list of data-source entries from the payload."""
        return self.payload.get("data_sources", [])

    @property
    def techniques(self):
        """Return the list of technique entries from the payload."""
        return self.payload.get("techniques", [])

    @property
    def groups(self):
        """Return the list of threat-group entries from the payload."""
        return self.payload.get("groups", [])

    @property
    def source_file_type(self):
        """Return the DeTT&CT file type this run imported."""
        return self.payload.get("file_type", "unknown")

    @property
    def coverage_stats(self):
        """Return simple coverage statistics for the panel summary banner."""
        techniques = self.techniques
        total = len(techniques)
        covered = sum(
            1
            for technique in techniques
            if technique.get("detection_score", 0) >= 3
        )
        return {
            "total_techniques": total,
            "covered_techniques": covered,
            "uncovered_techniques": total - covered,
            "data_source_count": len(self.data_sources),
            "group_count": len(self.groups),
        }