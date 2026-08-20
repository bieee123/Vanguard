# Vanguard: extend OplogEntry with ATT&CK tagging (PRD 5.4/5.5) and a link to
# the global Asset inventory (PRD 5.2). All new fields are optional so existing
# entries and integrations remain valid.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("oplog", "0025_preserve_oplog_entry_timestamp_for_noop_updates"),
        ("assets", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="oplogentry",
            name="technique_id",
            field=models.CharField(
                blank=True,
                default="",
                help_text="MITRE ATT&CK technique ID, e.g. T1059.001",
                max_length=20,
                verbose_name="ATT&CK Technique ID",
            ),
        ),
        migrations.AddField(
            model_name="oplogentry",
            name="tactic",
            field=models.CharField(
                blank=True,
                default="",
                help_text="MITRE ATT&CK tactic, e.g. initial-access or persistence",
                max_length=50,
                verbose_name="ATT&CK Tactic",
            ),
        ),
        migrations.AddField(
            model_name="oplogentry",
            name="outcome",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Result of the action: success, failed, or blocked",
                max_length=50,
                verbose_name="Outcome",
            ),
        ),
        migrations.AddField(
            model_name="oplogentry",
            name="sequence_order",
            field=models.IntegerField(
                blank=True,
                help_text="Order of this action within the engagement's attack path",
                null=True,
                verbose_name="Sequence Order",
            ),
        ),
        migrations.AddField(
            model_name="oplogentry",
            name="asset",
            field=models.ForeignKey(
                blank=True,
                help_text="Link this action to a tracked asset in the inventory.",
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="oplog_entries",
                to="assets.asset",
            ),
        ),
        migrations.AddIndex(
            model_name="oplogentry",
            index=models.Index(fields=["technique_id"], name="oplog_entry_technique_idx"),
        ),
        migrations.AddIndex(
            model_name="oplogentry",
            index=models.Index(fields=["tactic"], name="oplog_entry_tactic_idx"),
        ),
    ]