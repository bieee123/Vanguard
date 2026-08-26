# Vanguard V2

Red team operations console — rebuild of Vanguard (ex-Ghostwriter fork) as a
**Next.js fullstack monolith** (TypeScript + Prisma + PostgreSQL/pgvector).

> **Status:** Sprint 4 + design-system completion pass selesai (drawer/sparkline/toolbar primitives,
> dashboard time-range & skeleton, findings investigation view, engagement tabs, Grafana-style settings,
> state-timeline strip, KB three-pane, report mini-panels, responsive grids + reduced-motion).
> Implementasi Django lama: `../Vanguard` (arsip referensi) / GitHub `vanguard-django-archive`.

## Dokumentasi

| Doc | Isi |
|---|---|
| [docs/PRD.md](docs/PRD.md) | **PRD v2** — scope paritas penuh, spec per modul, keputusan arsitektur, roadmap |
| [docs/SPRINTS.md](docs/SPRINTS.md) | Pembagian 5 sprint + backlog pasca-sprint 5 |
| [docs/design-system.md](docs/design-system.md) | Design system "Obsidian Red Team Console" (token, komponen, layout halaman) |
| [docs/data-model-reference.md](docs/data-model-reference.md) | Model data v1 sebagai referensi semantik entitas |
| [docs/features-checklist.md](docs/features-checklist.md) | Checklist fitur lengkap untuk paritas penuh |
| [docs/integrations/api-reference.md](docs/integrations/api-reference.md) | Kontrak integrasi: Sentinel API, DeTT&CT, RAG, Hasura-lama |
| [docs/reference/v1-endpoints.md](docs/reference/v1-endpoints.md) | (historis) Inventory endpoint v1 — cek paritas fitur |
| [docs/reference/v1-data-model-notes.md](docs/reference/v1-data-model-notes.md) | (historis) Catatan praktis model data v1 |
| [docs/samples/](samples/) | Contoh fixture (DeTT&CT YAML) |

## Stack

- Next.js (App Router, TypeScript strict) — frontend + API dalam satu app
- PostgreSQL 15 + pgvector · ORM: Prisma
- Auth: better-auth (sesi + **OTP via email** wajib semua user + recovery codes)
- Role: Admin tunggal (semua user full access) + audit log
- Jobs: pg-boss (queue di Postgres — tanpa Redis)
- Report generator: **PDF saja** — template HTML/React → headless Chromium (Playwright)

## Kontainer target (compose)

`postgres` · `app` (next start, image membawa Chromium untuk PDF) · `worker` (pg-boss runner)

## Quickstart (dev, Docker Compose)

```sh
docker compose up            # postgres + mailhog + app(:3000) + worker
docker compose exec app npm run db:seed   # user admin pertama
#   ADMIN_EMAIL=you@corp.local ADMIN_PASSWORD=... ADMIN_NAME="Ops Lead"
```

SMTP dev = Mailhog: UI di http://localhost:8025 (kode OTP login muncul di sini).
Login bisa pakai **username atau email**. Seed admin pertama: set juga `ADMIN_USERNAME` (default dari nama).

Smoke test auth end-to-end (app :3000 + mailhog :8025 harus hidup):

```sh
powershell -ExecutionPolicy Bypass -File scripts\smoke-auth.ps1
```

Catatan Windows: `npm run build` gagal kalau dev server jalan (engine Prisma terkunci saat generate) —
stop dev dulu, atau panggil `npx next build` langsung.

Tanpa Docker: set `.env` (copy dari `.env.example`), `npm ci`, `npx prisma migrate deploy`,
`npm run db:generate`, lalu `npm run dev` + `npm run worker:dev`.

## Struktur

```
prisma/schema.prisma        model data (auth, audit, engagement, assets, findings, reports)
src/lib/                    db, auth, mail, audit, session, cvss (v3.1), storage (lokal), csv
src/app/login/              login username/email → OTP email / recovery code
src/app/(app)/              dashboard, engagements(+assets/findings/observations/reports), assets, findings, reports, settings
src/server/actions/         server actions (mutasi + audit log)
src/server/reporting/       producer queue, template HTML report, generator Playwright→PDF
src/lib/mock-sentinel.ts    korelasi alert deterministik (mock sampai M12)
src/lib/rule-lifecycle.ts   guard transisi rule request
worker/index.ts             pg-boss runner (queue "report-generate")
scripts/seed-admin.ts       bootstrap user admin pertama
scripts/smoke-auth.ps1      E2E auth: login → OTP → session
scripts/smoke-report.ts     E2E report: enqueue → worker render PDF
scripts/smoke-matrix.ts     E2E purple team: entry → gap → rule request verified
scripts/smoke-kb.ts         E2E KB/RAG/DeTT&CT: links, embedding graceful, fixture import
```

RAG: tanpa provider AI, panel "AI Ask" tetap mengembalikan sources (keyword).
Aktifkan LLM via env `AI_API_URL` / `AI_API_KEY` / `AI_CHAT_MODEL` (OpenAI-compatible).

PDF engine butuh Chromium sekali saja per mesin: `npx playwright install chromium`.
Worker wajib jalan agar generate PDF selesai (`npm run worker`).
