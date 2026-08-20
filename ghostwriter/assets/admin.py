"""Assets application admin configuration."""

# Django Imports
from django.contrib import admin

# Local Libraries
from ghostwriter.assets.models import Asset, EngagementAsset


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`assets.Asset`."""

    list_display = ("hostname", "ip_address", "criticality", "status", "business_unit", "updated_at")
    list_filter = ("criticality", "status", "business_unit")
    search_fields = ("hostname", "ip_address", "os_fingerprint")
    ordering = ("-updated_at",)


@admin.register(EngagementAsset)
class EngagementAssetAdmin(admin.ModelAdmin):
    """Admin configuration for :model:`assets.EngagementAsset`."""

    list_display = ("asset", "project", "added_at")
    search_fields = ("asset__hostname", "asset__ip_address", "project__codename")
    ordering = ("-added_at",)