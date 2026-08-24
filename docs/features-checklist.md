# 08 — Status Checklist (Sudah vs Belum)

Dasar keputusan rebuild: daftar kemampuan bisnis lengkap + status implementasi.
Legenda: ✅ selesai · 🟨 sebagian · ⏸ ditunda (butuh dependensi) · ❌ belum ada

## A. Modul Inti Warisan Ghostwriter (langsung pakai)

| Fitur | Status | Catatan |
|---|---|---|
| Auth + MFA (TOTP/passkey/recovery) | ✅ | allauth + otp; role RBAC custom |
| Client & Engagement CRUD | ✅ | rolodex |
| Assignment operator, objective, scope, target | ✅ | |
| Deconfliction log + White card | ✅ | |
| Domain/server inventory + checkout/burn | ✅ | shepherd |
| DNS update otomatis (Namecheap), WHOIS, health check infra | ✅ | butuh API key di settings |
| Finding library + CVSS v3/v4 | ✅ | reporting |
| Report builder + generate DOCX/PPTX/XLSX dari template | 🟨 | jalan di dev; test butuh file sampel `template.docx` yang tidak ada di repo ini |
| Evidence upload + caption | 🟨 | jalan; enkripsi at-rest + retention (PRD 5.6) ❌ |
| Observation + local finding note | ✅ | |
| Archive/clone report, export CSV | ✅ | |
| Operation log (oplog) + import/export + sanitasi | ✅ | |
| Kalender engagement (FullCalendar) | ✅ | dashboard |
| Konfigurasi runtime singleton (company/slack/banner/extra fields) | ✅ | commandcenter |
| Notifikasi Slack saat report complete | ✅ | Telegram/email (design 5.10) ❌ |

## B. Modul Native Vanguard

| Fitur | Status | Catatan |
|---|---|---|
| Asset inventory lintas-engagement (5.2) | ✅ | app `assets`; link Sentinel ID field siap |
| Knowledge Base: note CRUD + markdown + tags | ✅ | 5.9 |
| KB: backlink `[[wiki]]` + broken-link detection | ✅ | NoteLink auto-resolve |
| KB: graph view interaktif | ✅ | vis.js-style via graph/json |
| KB: embedding pgvector + RAG Q&A + citation | ✅ | Step 6+6b; butuh env provider LLM utk jawaban penuh |
| Purple Team: timeline entry CRUD (OPSEC log) | ✅ | 5.7 |
| Purple Team: detection verdict + korelasi alert mock + konfirmasi operator | ✅ | mock `mock_sentinel_alerts()` |
| ATT&CK Matrix: heatmap tile per verdict + filter toolbar | ✅ | redesign panel baru |
| Detection Gap Report + "Send to Sentinel backlog" | ✅ | drawer form langsung di matrix |
| Rule Request lifecycle draft→pending→approved→deployed→verified (+rejected) | ✅ | UI hanya boleh submit & verify; sisanya simulasi admin/command |
| Command simulasi respons Sentinel | ✅ | `simulate_sentinel_rule_response` |
| DeTT&CT: parser YAML + import command + panel coverage + raw snapshot | ✅ | Step 11 |
| Dashboard ops: stat panels, donut severity (Chart.js), recent verdicts, heatmap teaser, integration health | ✅ | design 6.1 (tanpa coverage-over-time line chart) |
| Design system "Obsidian Red Team Console" | 🟨 | token+komponen inti selesai; halaman warisan override-style, belum semua konversi panel |

## C. Yang Ditunda / Belum Ada

| Item | Status | Bloker / Catatan |
|---|---|---|
| **Step 9** — Sentinel live client + connection status page | ⏸ | menunggu API Sentinel siap; desain & prompt sudah disiapkan (06-api-integrations.md §B.1) |
| **Step 10** — wire rule request → Sentinel end-to-end | ⏸ | bergantung Step 9 |
| Webhook receiver alert-match (`/redteam/webhooks/alert-match`) | ❌ | PRD 6.3 opsional real-time push |
| **Suricata integration** | ❌ | rencana berikutnya user; belum ada spec |
| Kanban tasks module (5.10) | ❌ | sidebar masih placeholder |
| Notifications settings UI (Telegram/email) (5.12) | ❌ | hanya Slack warisan |
| Settings hub Grafana-style dua kolom (5.11) | ❌ | halaman settings masih terpisah-pisah |
| Credential Tracker (5.11 PRD lanjutan) | ❌ | |
| Audit trail UI (5.13) | 🟨 | logging dasar Django; UI pencarian audit belum |
| Coverage-over-time chart (dashboard 6.1 row 2) | ❌ | butuh tabel histori verdict |
| Findings investigation dashboard + finding drawer (6.4) | ❌ | komponen drawer CSS siap, wiring belum |
| Reports library panel hybrid (6.8) | ❌ | masih card grid warisan |
| Engagement detail header chips + phase tracker inline (6.3) | 🟨 | CSS `.phase-tracker` ada, belum dipakai template |
| Time-range control global topbar (Grafana-style) | ❌ | |
| Responsive penuh 12→8→1 kolom (§7) | 🟨 | partial Bootstrap grid |
| File sampel demo (`DOCS/example-data/*`, `template.docx`) untuk test seed/reporting | ❌ | penyebab ±170 test error pre-existing di lingkungan ini |

## D. Kualitas

| Aspek | Status |
|---|---|
| Test suite modul Vanguard (purple_team+dettct+KB) | ✅ 128+ lulus |
| Test suite warisan (reporting/api/rolodex) | 🟨 gagal karena file sampel hilang — bukan bug kode |
| Lint isort/black | ✅ dijalankan pada file baru (migration dikecualikan) |
| flake8 | ❌ rusak di kontainer (pkg_resources hilang) |
| CI GitHub Actions | ❌ belum dikonfigurasi untuk fork ini |
| Dokumentasi spesifikasi (PRD/design/schema/setup) | ✅ DOCS/vanguard/ |
| Dokumentasi codebase (folder ini) | ✅ |

## E. Estimasi Sisa Kerja (bukan rebuild)

1. Step 9+10 Sentinel — setelah API tersedia (±2–4 sesi kerja).
2. Suricata ingest — butuh spec dulu.
3. Penyempurnaan redesign Fase B/C sisa (findings dashboard, reports, settings, drawer wiring).
4. File sampel demo agar full suite hijau.

## F. Estimasi Rebuild Penuh (jika memilih stack lain)

Yang harus dibangun ulang apa pun stack-nya:
±60 model data, ±100 endpoint, RBAC + MFA, generator DOCX/PPTX/XLSX
(bagian paling berat & berisiko), oplog grid bulk-edit, kalender,
KB+RAG, purple team suite, integrasi eksternal (Namecheap/AWS/Slack/VirusTotal),
dan seluruh UI.

Yang bisa langsung di-copy sebagai aset netral teknologi:
spesifikasi PRD/design/schema (DOCS/vanguard/), kontrak API Sentinel,
parser DeTT&CT (konsep), fixture YAML contoh, dan seluruh keputusan UX.
