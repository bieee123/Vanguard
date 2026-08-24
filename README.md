# Vanguard V2

Red team operations console — rebuild of Vanguard (ex-Ghostwriter fork) as a
**Next.js fullstack monolith** (TypeScript + Prisma + PostgreSQL/pgvector).

> **Status:** fase dokumentasi — PRD & design system disusun sebelum scaffold.
> Implementasi Django lama: `../Vanguard` (arsip referensi) / GitHub `vanguard-django-archive`.

## Dokumentasi

| Doc | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | **PRD v2** — scope paritas penuh, spec per modul, keputusan arsitektur, roadmap |
| [docs/design-system.md](docs/design-system.md) | Design system "Obsidian Red Team Console" (token, komponen, layout halaman) |
| [docs/data-model-reference.md](docs/data-model-reference.md) | Model data v1 sebagai referensi semantik entitas |
| [docs/features-checklist.md](docs/features-checklist.md) | Checklist fitur lengkap untuk paritas penuh |
| [docs/integrations/api-reference.md](integrations/api-reference.md) | Kontrak integrasi: Sentinel API, DeTT&CT, RAG, Hasura-lama |
| [docs/samples/](samples/) | Contoh fixture (DeTT&CT YAML) |

## Stack

- Next.js (App Router, TypeScript strict) — frontend + API dalam satu app
- PostgreSQL 15 + pgvector · ORM: Prisma
- Auth: better-auth (sesi + TOTP MFA + recovery codes)
- Jobs: pg-boss (queue di Postgres — tanpa Redis)
- Collab realtime: TipTap + Hocuspocus
- Report generator: docxtemplater (DOCX) · exceljs (XLSX) · pptxgenjs (PPTX)

## Kontainer target (compose)

`postgres` · `app` (next start) · `worker` (pg-boss runner) · `collab` (hocuspocus)
