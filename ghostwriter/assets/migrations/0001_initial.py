# Vanguard: native cross-engagement Asset inventory (PRD 5.2). Ghostwriter uses
# integer primary keys throughout, so Asset/EngagementAsset follow the same
# convention instead of SCHEMA.md's reference UUIDs (see SCHEMA.md notes).

from django.db import migrations, models

import ghostwriter.rolodex.validators


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("rolodex", "0064_vanguard_default_client"),
    ]

    operations = [
        migrations.CreateModel(
            name="Asset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "hostname",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Provide the asset's hostname or fully qualified domain name",
                        max_length=255,
                        verbose_name="Hostname / FQDN",
                    ),
                ),
                (
                    "ip_address",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Enter the IP address or range of the asset",
                        max_length=45,
                        validators=[ghostwriter.rolodex.validators.validate_ip_range],
                        verbose_name="IP Address / Range",
                    ),
                ),
                (
                    "os_fingerprint",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Operating system and version identified for the asset",
                        max_length=255,
                        verbose_name="OS Fingerprint",
                    ),
                ),
                ("open_ports", models.JSONField(default=list)),
                (
                    "business_unit",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Owning business unit or team responsible for the asset",
                        max_length=255,
                        verbose_name="Business Unit",
                    ),
                ),
                (
                    "criticality",
                    models.CharField(
                        choices=[
                            ("critical", "Critical"),
                            ("high", "High"),
                            ("medium", "Medium"),
                            ("low", "Low"),
                            ("unknown", "Unknown"),
                        ],
                        default="unknown",
                        help_text="Assessed criticality of the asset to the organization",
                        max_length=20,
                        verbose_name="Criticality",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("unverified", "Unverified"),
                            ("in_scope", "In Scope"),
                            ("out_of_scope", "Out of Scope"),
                            ("compromised", "Compromised"),
                            ("not_compromised", "Not Compromised"),
                        ],
                        default="unverified",
                        help_text="Current status of the asset within the engagement scope",
                        max_length=20,
                        verbose_name="Status",
                    ),
                ),
                (
                    "discovered_by",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Tool name or 'manual' indicating how the asset was discovered",
                        max_length=255,
                        verbose_name="Discovered By",
                    ),
                ),
                (
                    "source_tool",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Tool used to import or create the asset record",
                        max_length=100,
                        verbose_name="Source Tool",
                    ),
                ),
                (
                    "sentinel_asset_id",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Link to the matching record in Sentinel's App Inventory",
                        max_length=255,
                        verbose_name="Sentinel Asset ID",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Asset",
                "verbose_name_plural": "Assets",
                "ordering": ["hostname", "ip_address"],
            },
        ),
        migrations.CreateModel(
            name="EngagementAsset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("added_at", models.DateTimeField(auto_now_add=True)),
                (
                    "asset",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="engagement_links",
                        to="assets.asset",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="engagement_assets",
                        to="rolodex.project",
                    ),
                ),
            ],
            options={
                "verbose_name": "Engagement asset",
                "verbose_name_plural": "Engagement assets",
                "ordering": ["project", "asset"],
            },
        ),
        migrations.AddField(
            model_name="asset",
            name="projects",
            field=models.ManyToManyField(
                help_text="Engagements in which this asset is in scope",
                related_name="assets",
                through="assets.EngagementAsset",
                to="rolodex.project",
            ),
        ),
        migrations.AddIndex(
            model_name="asset",
            index=models.Index(fields=["criticality"], name="assets_criticality_idx"),
        ),
        migrations.AddIndex(
            model_name="asset",
            index=models.Index(fields=["status"], name="assets_status_idx"),
        ),
        migrations.AddIndex(
            model_name="asset",
            index=models.Index(fields=["hostname"], name="assets_hostname_idx"),
        ),
        migrations.AlterUniqueTogether(
            name="engagementasset",
            unique_together={("asset", "project")},
        ),
    ]