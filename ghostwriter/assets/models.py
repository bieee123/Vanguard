"""This contains all the database models used by the Assets application."""

# Django Imports
from django.db import models

# Ghostwriter Libraries
from ghostwriter.rolodex.models import Project
from ghostwriter.rolodex.validators import validate_ip_range


class Asset(models.Model):
    """Stores an individual asset in the cross-engagement inventory."""

    class Criticality(models.TextChoices):
        CRITICAL = "critical", "Critical"
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"
        UNKNOWN = "unknown", "Unknown"

    class Status(models.TextChoices):
        UNVERIFIED = "unverified", "Unverified"
        IN_SCOPE = "in_scope", "In Scope"
        OUT_OF_SCOPE = "out_of_scope", "Out of Scope"
        COMPROMISED = "compromised", "Compromised"
        NOT_COMPROMISED = "not_compromised", "Not Compromised"

    hostname = models.CharField(
        "Hostname / FQDN",
        max_length=255,
        default="",
        blank=True,
        help_text="Provide the asset's hostname or fully qualified domain name",
    )
    ip_address = models.CharField(
        "IP Address / Range",
        max_length=45,
        default="",
        blank=True,
        validators=[validate_ip_range],
        help_text="Enter the IP address or range of the asset",
    )
    os_fingerprint = models.CharField(
        "OS Fingerprint",
        max_length=255,
        default="",
        blank=True,
        help_text="Operating system and version identified for the asset",
    )
    open_ports = models.JSONField(default=list)
    business_unit = models.CharField(
        "Business Unit",
        max_length=255,
        default="",
        blank=True,
        help_text="Owning business unit or team responsible for the asset",
    )
    criticality = models.CharField(
        "Criticality",
        max_length=20,
        choices=Criticality.choices,
        default=Criticality.UNKNOWN,
        help_text="Assessed criticality of the asset to the organization",
    )
    status = models.CharField(
        "Status",
        max_length=20,
        choices=Status.choices,
        default=Status.UNVERIFIED,
        help_text="Current status of the asset within the engagement scope",
    )
    discovered_by = models.CharField(
        "Discovered By",
        max_length=255,
        default="",
        blank=True,
        help_text="Tool name or 'manual' indicating how the asset was discovered",
    )
    source_tool = models.CharField(
        "Source Tool",
        max_length=100,
        default="",
        blank=True,
        help_text="Tool used to import or create the asset record",
    )
    sentinel_asset_id = models.CharField(
        "Sentinel Asset ID",
        max_length=255,
        default="",
        blank=True,
        help_text="Link to the matching record in Sentinel's App Inventory",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Foreign Keys
    projects = models.ManyToManyField(
        Project,
        through="EngagementAsset",
        related_name="assets",
        help_text="Engagements in which this asset is in scope",
    )

    class Meta:
        ordering = ["hostname", "ip_address"]
        verbose_name = "Asset"
        verbose_name_plural = "Assets"
        indexes = [
            models.Index(fields=["criticality"], name="assets_criticality_idx"),
            models.Index(fields=["status"], name="assets_status_idx"),
            models.Index(fields=["hostname"], name="assets_hostname_idx"),
        ]

    def __str__(self):
        return self.hostname or self.ip_address or f"Asset {self.pk}"


class EngagementAsset(models.Model):
    """Links an individual :model:`assets.Asset` to an engagement (:model:`rolodex.Project`)."""

    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="engagement_links",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="engagement_assets",
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("asset", "project")
        ordering = ["project", "asset"]
        verbose_name = "Engagement asset"
        verbose_name_plural = "Engagement assets"

    def __str__(self):
        return f"{self.asset} ({self.project})"