# Vanguard: ensure a single default client exists when consulting (multi-client)
# mode is disabled. Project.client is a required FK, so at least one row must
# exist for the project form to function in single-company mode.

from django.conf import settings
from django.db import migrations


def ensure_default_client(apps, schema_editor):
    if settings.CONSULTING_MODE:
        # Multi-client mode keeps a normal empty client library; the default
        # client only exists in single-company (consulting-off) deployments.
        return
    Client = apps.get_model("rolodex", "Client")
    if not Client.objects.exists():
        Client.objects.create(
            name="Vanguard",
            short_name="Vanguard",
            description="Default client for single-company Vanguard use",
        )


def remove_default_client(apps, schema_editor):
    Client = apps.get_model("rolodex", "Client")
    Client.objects.filter(name="Vanguard", description="Default client for single-company Vanguard use").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("rolodex", "0063_alter_project_collab_note"),
    ]

    operations = [
        migrations.RunPython(ensure_default_client, remove_default_client),
    ]