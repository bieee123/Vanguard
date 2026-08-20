"""DeTT&CT application admin configuration.

Runs are imported read-only snapshots, so the admin is intentionally read-only.
"""

# Django Imports
from django.contrib import admin

# Ghostwriter Libraries
from ghostwriter.dettct.models import DeTTCTRun


@admin.register(DeTTCTRun)
class DeTTCTRunAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`dettct.DeTTCTRun`."""

    list_display = ("pk", "output_file_path", "run_at", "imported_at", "source_file_type")
    list_filter = ("run_at", "imported_at")
    search_fields = ("output_file_path",)
    ordering = ("-run_at",)
    readonly_fields = (
        "output_file_path",
        "run_at",
        "imported_at",
        "payload",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False