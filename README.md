# Vanguard V2

Red team operations console — rebuild of Vanguard (ex-Ghostwriter fork) as a
**Next.js fullstack monolith** (TypeScript + Prisma + PostgreSQL/pgvector).

> **Status:** fase dokumentasi — PRD & design system disusun sebelum scaffold.
> Implementasi Django lama: `../Vanguard` (arsip referensi) / GitHub `vanguard-django-archive`.

## Dokumentasi

| Doc | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | **PRD v2** — scope paritas penuh, spec per modul, keputusan arsitektur, roadmap |
| [docs/SPRINTS.md](docs/SPRINTS.md) | Pembagian 5 sprint + backlog pasca-sprint 5 |
| [docs/design-system.md](docs/design-system.md) | Design system "Obsidian Red Team Console" (token, komponen, layout halaman) |
| [docs/data-model-reference.md](docs/data-model-reference.md) | Model data v1 sebagai referensi semantik entitas |
| [docs/features-checklist.md](docs/features-checklist.md) | Checklist fitur lengkap untuk paritas penuh |
| [docs/integrations/api-reference.md](integrations/api-reference.md) | Kontrak integrasi: Sentinel API, DeTT&CT, RAG, Hasura-lama |
| [docs/samples/](samples/) | Contoh fixture (DeTT&CT YAML) |

## Stack

- Next.js (App Router, TypeScript strict) — frontend + API dalam satu app
- PostgreSQL 15 + pgvector · ORM: Prisma
- Auth: better-auth (sesi + TOTP MFA wajib semua user + recovery codes)
- Role: Admin tunggal (semua user full access) + audit log
- Jobs: pg-boss (queue di Postgres — tanpa Redis)
- Report generator: **PDF saja** — template HTML/React → headless Chromium (Playwright)

## Kontainer target (compose)

`postgres` · `app` (next start, image membawa Chromium untuk PDF) · `worker` (pg-boss runner)
