# Vanguard

**Vanguard** is a red-team operations dashboard built on top of the
Ghostwriter codebase (BSD-3). It rebrands the platform for a single-company
red team, hiding multi-client/consulting features behind a feature flag and
adding native modules for asset tracking, a knowledge base (Second Brain),
purple-team sync, and SOC/Sentinel integration.

## Features

- **Engagements** — projects, scope, objectives, and operation logs with
  ATT&CK tagging (technique, tactic, outcome, sequence) and asset linking.
- **Assets** — cross-engagement asset inventory with criticality and status
  tracking, backed by `pgvector` for vector search.
- **Knowledge Base** — markdown notes with `[[wikilinks]]`, automatic
  backlinks, a node graph, and RAG search over embedded chunks.
- **Reporting** — Ghostwriter's report generation engine (findings, evidence,
  custom templates, export to DOCX/PDF).
- **Infrastructure** — server and domain management for covert operations.

## Tech Stack

- Django 5.2, PostgreSQL 16 + pgvector, Redis
- Bootstrap 4 + jQuery (server-rendered UI)
- Django Q for background tasks
- GraphQL (Hasura) for the collaborative report frontend

## Quick Start (Local Development)

Requires Docker + Docker Compose.

1. Copy `.env` from the template and set a `DJANGO_SECRET_KEY`:
   ```
   copy .envs/.local/.django .env
   ```
2. Bring the stack up:
   ```
   docker compose -f local.yml up -d
   ```
3. Run migrations:
   ```
   docker compose -f local.yml run --rm django python manage.py migrate
   ```
4. Open http://localhost:8000 and log in with the admin account created via
   `createsuperuser`.

## Running Tests

The Python test suite runs against the test settings (which enable the
multi-client surface so the inherited Ghostwriter tests stay green):

```
docker compose -f local.yml run --rm django python manage.py test --settings=config.settings.test --exclude-tag=GitHub
```

## Documentation

Product requirements and architecture live in `DOCS/vanguard/`:

- `PRD.md` — product requirements document
- `design.md` — UI/design tokens and page specs
- `SCHEMA.md` — reference DDL for native modules
- `SETUP.md` — step-by-step build guide
- `take-inventory.md` / `strip-inventory.md` — fork analysis

## License

BSD-3-Clause. Vanguard is a fork of
[Ghostwriter](https://github.com/GhostManager/Ghostwriter); the original
copyright and license text are preserved in `LICENSE`.