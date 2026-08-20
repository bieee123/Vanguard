# Vanguard: enable the pgvector extension required by the Knowledge Base
# (PRD 5.14). Requires the pgvector/pgvector Docker image (compose
# production/postgres/Dockerfile) and the pgvector Python package.

from django.contrib.postgres.operations import CreateExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0001_initial"),
    ]

    operations = [
        CreateExtension("vector"),
    ]