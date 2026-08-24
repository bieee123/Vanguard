# Sprint Plan — Vanguard V2

Pembagian 5 sprint untuk membangun paritas penuh sesuai [PRD.md](PRD.md) r3.
Setiap sprint ditutup dengan: test hijau · compose dev jalan · checklist demo terpenuhi.

**Prinsip urutan:** fondasi → alur inti pentest (temuan→laporan) → purple team →
pengetahuan → integrasi eksternal. Sprint 5 sengaja menampung semua pekerjaan yang
bergantung pada layanan eksternal (Sentinel API, LLM provider).

---

## Sprint 1 — Fondasi & Engagement Management

| Modul | Isi |
|---|---|
| M0 | Scaffold Next.js + Prisma + better-auth (**OTP email**, mailhog untuk dev) + Docker Compose dev (`postgres` / `app` / `worker`) + CI lint/test |
| M1 | CRUD user; settings account/security (enroll OTP email, recovery codes); audit log dasar (append-only) |
| M2 | Application CRUD (target pentest: nama, repo URL, criticality, tim pemilik) → Engagement CRUD penuh (objective/subtask, scope, target, notes, deconfliction, white card, penanggung jawab) + app shell (sidebar/topbar gaya design-system) |

**Exit criteria:** login dengan OTP email jalan; buat Application → Engagement lengkap;
semua mutasi tercatat di audit log.

---

## Sprint 2 — Temuan & Laporan

| Modul | Isi |
|---|---|
| M3 | Asset inventory: CRUD asset, link M2M ke engagement, filter/search by criticality/business unit/status |
| M4 | Findings **per project**: CRUD (CVSS v3/v4 calculator, tags, detection techniques), observations, severity/type management, export CSV per project |
| M6 | Reporting engine: builder report, pilih findings milik project, evidence upload, narasi markdown, generate **PDF** async (HTML template React → Playwright), archive + clone |

**Exit criteria:** alur inti utuh — engagement → catat temuan → generate report PDF →
archive.

---

## Sprint 3 — Purple Team Sync & Dashboard

| Modul | Isi |
|---|---|
| M7 | Timeline entry CRUD (termasuk field opsional `command` / `technical_notes`); verdict 1-1 + korelasi alert **mock** + konfirmasi operator; ATT&CK Matrix (toolbar filter engagement/verdict/search, heatmap tile, gap analytics table, rule request drawer); lifecycle draft→pending_review→approved→deployed→verified (+rejected) dengan command simulasi untuk transisi Sentinel |
| M8 | Dashboard ops 5 baris: stat panels, donut severity (Chart.js/Recharts), recent verdicts, heatmap teaser, integration health row (status mock/inactive + timestamp) |

**Exit criteria:** siklus simulasi penuh jalan — entry → gap muncul di Gap Report →
rule request draft→verified lewat command simulasi; dashboard hidup dengan data real.

---

## Sprint 4 — Knowledge Base & Utilitas

| Modul | Isi |
|---|---|
| M9 | Notes markdown CRUD + tag; wiki-link `[[...]]` autocomplete + backlink index + broken-link marker; graph view interaktif |
| M10 | Embedding pipeline ke pgvector (job async saat save) + Q&A UI dengan citation chips — **berjalan graceful tanpa provider** (sources-only sampai Sprint 5) |
| M11 | DeTT&CT reader: import job YAML → snapshot coverage panel + raw snapshot history + label Last updated |
| M14 | Tasks Kanban per engagement (To Do / In Progress / Blocked / Done, drag antar kolom) |

**Exit criteria:** second brain berfungsi penuh kecuali jawaban LLM; DeTT&CT panel hidup
dari fixture YAML contoh.

---

## Sprint 5 — Integrasi: Sentinel + AI Provider & Hardening ⭐

> Setelah sprint ini selesai, development pindah ke sisi Sentinel untuk menyiapkan
> API agar koneksi live terbentuk.

| Isi | Detail |
|---|---|
| **Integrations — Sentinel** | Settings sub-page: base URL + read/write scoped API keys; health probe + compact connection status indicator (+ last sync selalu tampil); push timeline entry async via pg-boss (outage Sentinel tidak blokir operator); polling status rule request (approved/deployed/rejected → update lokal + notifikasi); kirim retest result; idempotency key di semua push + retry/backoff. Loop penuh: submit → approve → deploy → verify |
| **Integrations — AI Provider** | Settings sub-page: endpoint/model/API key LLM; aktifkan jawaban RAG melawan provider terkonfigurasi (label model tampil di panel AI Ask); test koneksi |
| Notifications (M15) | Slack webhook + email SMTP; trigger: report-complete, rule-request status change, assignment baru |
| Hardening | Responsive penuh (12→8→1 kolom), aksesibilitas (focus ring biru, reduced-motion, kontras), perf pass (pagination/filter server-side), E2E Playwright alur kritis (login OTP, engagement→finding→report PDF, matrix verdict flow, rule request lifecycle) |

**Exit criteria:** Vanguard *consumer-ready* — begitu Sentinel punya API, cukup isi
konfigurasi dan seluruh loop hidup tanpa perubahan kode.

---

## Backlog Pasca-Sprint 5

| Item | Status |
|---|---|
| **Suricata ingest** | ❌ belum dispesifikasi (open question PRD §8). Kandidat dibangun di sisi Sentinel (pemilik data alert) atau sebagai modul Vanguard jika bentuknya pull-file/webhook. Diputuskan setelah Sprint 5 / saat development Sentinel dimulai |
| Eksport format lain (DOCX/XLSX) | Hanya jika kebutuhan nyata muncul — v2 sengaja PDF-only |
| Multi-tenant/read-only viewer role | Tidak direncanakan; role Admin tunggal |

---

## Pemetaan Modul → Sprint (ringkas)

| Sprint | Modul |
|---|---|
| 1 | M0 · M1 · M2 |
| 2 | M3 · M4 · M6 |
| 3 | M7 · M8 |
| 4 | M9 · M10 · M11 · M14 |
| 5 | M12 (Sentinel) · AI Provider settings · M15 (Notifications) · Hardening |
