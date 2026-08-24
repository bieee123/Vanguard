# PRD v2 — Vanguard (Next.js Rebuild)

**Status:** Draft untuk review · **Tanggal:** 2026-08-24
**Pengganti:** `PRD-v1-reference.md` (spesifikasi lama berbasis Django/Ghostwriter)
**Referensi pendukung:** [design-system.md](design-system.md) · [data-model-reference.md](data-model-reference.md) · [features-checklist.md](features-checklist.md) · [integrations/api-reference.md](integrations/api-reference.md)

---

## 1. Visi & Masalah

**Visi:** satu dashboard operasi red team yang membuat operator langsung bisa menjawab
dengan sekali lihat: apa yang aktif, apa yang berbahaya sekarang, apa yang berhasil
dieksploitasi, apa yang terdeteksi SOC, di mana celah deteksi, teknik ATT&CK mana yang
belum tercakup, apa aksi berikutnya, dan apakah integrasi (Sentinel/Wazuh/Suricata) sehat.

**Masalah yang diselesaikan:**
1. Hasil operasi red team tersebar di banyak tool tanpa korelasi dengan sisi biru.
2. Detection gap sulit dilacak dan ditindaklanjuti jadi perubahan rule Wazuh.
3. Pembuatan report client memakan waktu karena format manual.
4. Pengetahuan operasi (note, playbooks, temuan) tidak terpusat dan tidak bisa dicari.

**Prinsip produk:** pasif & aman — dashboard mengimpor/melacak hasil, TIDAK mengeksekusi
serangan. Write-path ke infrastruktur deteksi (Wazuh rule) hanya lewat Sentinel dengan
approval manusia.

## 2. Pengguna & Role

**Satu role: Admin.** Semua user terautentikasi = akses penuh (tim internal kecil,
semua anggota dipercaya). Tidak ada tier manager/operator, tidak ada permission matrix,
tidak ada flag granular.

- Auth: email/username + password + **MFA TOTP wajib untuk SEMUA user**, recovery codes.
- Service-to-service pakai API key scoped (untuk Sentinel nanti).
- Audit trail tetap wajib: dengan multi-admin, semua mutasi penting tercatat
  (siapa, kapan, before/after ringkas).
- Konsep assignment operator ke engagement tetap ada — sebagai metadata kepemilikan/
  penanggung jawab, bukan pembatasan akses.

## 3. Ruang Lingkup — Paritas Penuh, Dibagi Fase

Semua fitur v1 direplikasi + penambahan baru. Urutan fase mengikuti dependensi
(lihat §6 Roadmap). Modul:

| # | Modul | Fase | Sumber referensi |
|---|---|---|---|
| M1 | Auth, User & Audit | 0 | checklist §A |
| M2 | Application & Engagement Management | 0 | checklist §A (Client → Application) |
| M3 | Asset Inventory | 1 | modul native v1 |
| M4 | Findings per Project (+CVSS, tags, observation) | 1 | checklist §A, dimodifikasi — lihat §5 M4 |
| M5 | Operation Log (oplog grid) | 1 | checklist §A |
| M6 | Reporting Engine (template HTML → PDF via headless Chromium, evidence, archive) | 2 | bagian tersulit — lihat §4.4 |
| M7 | Purple Team Sync (timeline, verdict, matrix, gap report, rule request) | 2 | modul native v1 |
| M8 | Dashboard Ops | 2 | design §6.1 |
| M9 | Knowledge Base + backlink + graph | 3 | modul native v1 |
| M10 | KB RAG (pgvector + LLM) | 3 | modul native v1 |
| M11 | DeTT&CT reader + coverage panel | 3 | modul native v1 |
| M12 | Sentinel Integration client | 4 | kontrak di integrations/api-reference.md |
| M13 | Suricata ingest (BARU) | 4 | spec menyusul — open question |
| M14 | Tasks Kanban | 4 | design 5.10 |
| M15 | Notifications (Slack/email) | 4 | |
| M16 | Settings hub + Audit Log UI | 4 | design 5.11 / 5.13 |

*(Collab editor realtime dihapus dari scope — keputusan owner 2026-08-24.)*

## 4. Keputusan Arsitektur (final untuk v2)

### 4.1 Bentuk Aplikasi
- **Satu repo, satu app:** Next.js App Router (TypeScript strict), frontend + API route
  handlers + Server Actions dalam satu deploy unit.
- Proses pendamping dalam repo yang sama: `worker` (job runner pg-boss) — dijalankan
  sebagai proses/kontainer terpisah.

### 4.2 Data & Infrastruktur
- **PostgreSQL 15 + pgvector.** ORM: **Prisma**. Migrasi: prisma migrate.
- **Tanpa Redis, tanpa Hasura, tanpa server collab** (beda dari v1): job queue =
  **pg-boss** (tabel di Postgres yang sama).
- File storage (evidence/report/avatar): local disk volume dengan interface abstrak
  `StorageService` — swap ke S3-compatible tanpa ubah kode pemanggil.
- Deployment: Docker Compose — kontainer: `postgres`, `app`, `worker`.

### 4.3 Auth & Audit
- **better-auth**: sesi httpOnly cookie, password hash argon2/bcrypt.
- MFA: TOTP (otpauth) + recovery codes — **wajib untuk semua user**.
- RBAC minimal: semua user terautentikasi = admin. Assignment ke engagement tetap
  dicatat sebagai penanggung jawab (metadata), bukan pembatas akses.
- Service API keys: tabel sendiri, scope read/write + resource scope, hash di DB.
- Audit log append-only untuk semua mutasi entitas penting.

### 4.4 Reporting Engine (bagian tersulit — keputusan eksplisit)

**Output tunggal: PDF.** Tidak ada DOCX/PPTX/XLSX.

Pendekatan: **template report = komponen HTML/CSS (React)** → render via
**headless Chromium (Playwright) print-to-PDF**.

| Aspek | Keputusan |
|---|---|
| Template | Komponen React per jenis report (layout dikodekan, bukan upload file template) — placeholder = props biasa, full kontrol CSS |
| Render | Playwright `page.pdf()` (kualitas print, font embed, page-break control) |
| Data | Report snapshot immutable findings milik project → bind langsung ke komponen |
| Evidence | Gambar inline via `<img>` dari StorageService |
| Cover/TOC | Otomatis dari struktur section report |
| Biaya | Image Docker app membawa Chromium (+~200MB); job generate jalan di `worker` agar tidak blokir app |

Kelebihan vs pendekatan Office v1: satu pipeline untuk semua konten, styling bebas
(pakai design tokens), tanpa lisensi pihak ketiga, placeholder logic = kode biasa.
Trade-off yang diterima: tidak ada lagi "upload template .docx buatan sendiri" —
perubahan desain report = ubah kode komponen (deploy).

Kontrak internal: service `ReportGenerator.generate(reportId)` — input report +
snapshot findings, output PDF stream + record Archive.

### 4.5 AI/RAG (M10)
- Embedding + chat completion via endpoint OpenAI-compatible (env-configurable,
  target LiteLLM proxy sama dgn Sentinel; model DeepSeek-class).
- pgvector untuk similarity; chunk note saat save (job async); exclude-from-RAG flag.
- UI "Ask the KB" menjawab dengan citation chip ke note sumber; sources tetap
  dikembalikan walau LLM tak dikonfigurasi.

### 4.6 Integrasi Eksternal
- **Sentinel (M12):** kontrak final 9 endpoint + aturan kredensial/idempotency/retry
  sudah final — lihat `integrations/api-reference.md`. Vanguard tidak pernah bicara
  langsung ke Wazuh. Push timeline = async job (outage Sentinel tak blokir operator).
- **DeTT&CT (M11):** tool eksternal terjadwal menulis YAML; import job baca path →
  snapshot read-only + label Last updated.
- **Suricata (M13):** belum dispesifikasi (open question §8).

## 5. Spec Ringkas Per Modul

Format tiap modul: Tujuan · Fitur · Entitas · Halaman. Detail field lengkap mengikuti
`data-model-reference.md` (semantik sama, nama bebas disesuaikan Prisma).

### M1 Auth/User/Audit
- Fitur: login, logout, ganti password, enroll TOTP (wajib), recovery codes, CRUD user,
  profil+avatar, audit log append-only.
- Entitas: User, Session, MfaFactor, RecoveryCode, ApiKey, AuditLog.
- Halaman: `/login`, `/settings/account`, `/settings/security`, `/settings/users`.

### M2 Application & Engagement Management
- Fitur: CRUD **Application** (aplikasi internal yang jadi target pentest: nama,
  deskripsi, repo URL, criticality, tim pemilik) menggantikan konsep Client v1;
  CRUD project/engagement (kode, tipe, periode, status, FK application wajib);
  penanggung jawab (assignment metadata), objectives (+subtask), scope list,
  target list, notes, deconfliction log, white card.
- Entitas: Application, Project, ProjectAssignment, ProjectObjective, ProjectSubTask,
  ProjectScope, ProjectTarget, Deconfliction, WhiteCard, Note.
- Halaman: `/applications`, `/applications/[id]`, `/engagements`, `/engagements/[id]`
  (tab: Overview | Assets | Findings | Timeline | Purple Team | Report) + header chips
  (status, phase tracker rail, coverage %, open findings).

### M3 Asset Inventory
- Fitur: CRUD asset (hostname/IP/CIDR, OS fingerprint, ports JSON, business unit,
  criticality, status, discovered-by), link M2M ke engagement, filter/search, enrich
  Sentinel ID (field siap).
- Halaman: `/assets` + panel asset di tab engagement.

### M4 Findings per Project
- Fitur: CRUD finding yang **wajib terikat ke project** — langsung terlihat
  "pentest ini untuk aplikasi apa" (via FK project → application). Field: title,
  severity, type, CVSS v3/v4 calculator, description, mitigation, replication,
  network/host detection techniques, references, tags. Observation serupa
  (juga per project). Severity/type management. Export CSV per project.
  *Tidak ada lagi library global lintas-project* — setiap finding lahir dan hidup
  dalam konteks satu aplikasi target.
- Entitas: Finding(project_id FK required), Observation, Severity, FindingType, Tag.

### M5 Oplog
- Fitur: oplog per engagement, entry bulk-grid editor (inline add/edit/delete),
  import CSV, export CSV, sanitization rules, mute toggle.
- Entitas: Oplog, OplogEntry, SanitizationRule.

### M6 Reporting Engine
- Fitur: buat report dari engagement; findings otomatis diambil dari project yang sama
  (dipilih mana yang masuk); urutkan; evidence upload; edit narasi section (markdown);
  generate **PDF** via async job (notifikasi selesai); archive + clone; history arsip.
  Saat generate, nilai finding di-*snapshot* ke report agar dokumen terbit immutable.
- Entitas: Report, ReportFinding (snapshot), Evidence, ArchivedReport.
  *(ReportTemplate entity tidak ada — template = komponen React.)*
- Halaman: `/reports`, `/reports/[id]` (builder tab), `/reports/archive`.

### M7 Purple Team Sync
- Fitur: timeline entry CRUD (teknik ATT&CK, tactic, outcome, asset, timestamp,
  deskripsi); verdict 1-1 per entry (detected / not_detected / partial / late /
  untested) + konfirmasi operator dari suggested alert match (mock sampai M12);
  ATT&CK Matrix page: toolbar filter (engagement/verdict/search) + heatmap tile +
  gap analytics table + tombol "Send to Sentinel backlog" membuka drawer form;
  rule request lifecycle draft→pending_review→approved→deployed→verified (+rejected)
  — UI hanya boleh submit & verify-retest, transisi lain dari Sentinel (atau command
  simulasi utk dev).
- Entitas: TimelineEntry, DetectionVerdict, RuleRequest.
- Halaman: `/attack-matrix` (heatmap), `/timeline`, `/rule-requests`, `/rule-requests/[id]`.

### M8 Dashboard Ops
- Row stat (active engagements, open critical findings, detection coverage %, gaps) ·
  donut severity · recent verdicts state-list · heatmap teaser · integration health
  row (status indicator + timestamp selalu tampil). Empty/loading/error states per design.

### M9–M10 Knowledge Base + RAG
- Fitur: note markdown CRUD + tag; wiki-link `[[...]]` autocomplete + backlink index +
  broken-link marker; graph view interaktif (filter tipe node); embedding async saat
  save; Q&A box dengan citation chips; exclude-from-RAG flag per note.
- Entitas: Note, NoteLink, NoteChunk(embedding vector).

### M11 DeTT&CT Reader
- Fitur: import job baca YAML output; simpan snapshot run; panel coverage (teknik,
  skor deteksi/visibility, data source, threat group); riwayat raw snapshot; label
  Last updated selalu tampil; bedakan visual dari data live purple team.
- Entitas: DettctRun (payload JSONB + computed stats).

### M12 Sentinel Client
- Fitur: konfigurasi base URL + 2 scoped key (read/write) di settings; health probe +
  connection status indicator; push timeline entry async saat dibuat; polling status
  rule request (approved/deployed/rejected) → update lokal; kirim retest result;
  idempotency key pada semua push; retry/backoff.
- Aturan hard: no self-approve di UI; rejected/failed-verify gap tetap tampak di
  Gap Report sampai resolved.

### M13 Suricata (baru)
- Tujuan: ingest alert IDS sebagai sumber korelasi deteksi.
- Status: **butuh spesifikasi** (format eve.json? pull file / push webhook? mapping
  alert→technique?). Bloker M13, bukan jalur kritis lainnya.

### M14–M16 Tasks, Notifications, Settings/Audit
- Kanban To Do/In Progress/Blocked/Done per engagement, card drag (drag-and-drop lib).
- Notifications: channel Slack webhook + email SMTP; event trigger report-complete,
  rule-request status change, assignment.
- Settings hub dua-kolom ala Grafana admin: Account, Security, Notifications,
  Integrations (Sentinel/AI Provider), Data Retention, Audit Log (searchable),
  Users.

## 6. Roadmap

| Milestone | Isi | Keluaran uji |
|---|---|---|
| **M0** | Scaffold Next.js + Prisma + better-auth + CI lint/test + Docker Compose dev | login + MFA jalan |
| **M1** | User mgmt + settings account/security + audit log dasar | CRUD user + TOTP wajib |
| **M2** | Application & engagement management penuh | alur application→project→assignment |
| **M3** | Asset inventory | CRUD + link engagement |
| **M4** | Findings per project + observations | CRUD + CSV export |
| **M5** | Oplog grid | bulk edit + import/export |
| **M6** | Reporting engine (HTML template → PDF via Playwright) | generate PDF end-to-end |
| **M7** | Purple Team Sync lengkap (mock alert) | matrix+gap+drawer+lifecycle simulasi |
| **M8** | Dashboard ops | panel hidup dgn data real |
| **M9–M10** | KB + RAG | backlink/graph + Q&A citation |
| **M11** | DeTT&CT | import + panel |
| **M12** | Sentinel live | loop penuh submit→approve→deploy→verify |
| **M13–M16** | Suricata, Kanban, Notifications, Settings/Audit | |

Prinsip urutan: setiap milestone meninggalkan aplikasi yang usable; dashboard panel
ditambah bertahap mengikuti data yang sudah ada.

## 7. Non-Fungsional

- **Keamanan:** session httpOnly, CSRF protection built-in framework, rate limit login,
  input sanitization (markdown sanitize), file upload whitelist + size cap, secrets di env.
- **Audit:** middleware/service log untuk semua mutasi entitas penting.
- **Testing:** Vitest unit (services/utils) + Playwright E2E alur kritis (login, buat
  engagement, finding→report generate, matrix verdict flow). Target: setiap modul punya
  minimal smoke test sebelum milestone ditutup.
- **Performa:** tabel densitas tinggi → pagination + filter server-side; chart lazy.
- **Deployment:** compose V2 (postgres/app/worker); image Node + Chromium (untuk PDF);
  migrasi otomatis on-deploy; backup pg_dump terjadwal.

## 8. Open Questions

1. **Suricata:** mode ingest apa (baca eve.json via path/watcher, syslog, webhook)?
   Mapping alert↔technique bagaimana?
2. **LLM provider final** (DeepSeek direct vs LiteLLM proxy) + kebijakan data-residency.
3. **Nama domain/hosting target** deployment (VPS internal?) — mempengaruhi TLS & proxy.
4. Bahasa UI: tetap English (seperti v1) atau bilingual?
5. **PDF layout report:** satu template generik untuk semua engagement, atau per jenis
   assessment (web app / infra / API)?

---

**Proses perubahan dokumen ini:** PRD adalah living document — perubahan scope masuk
lewat section changelog di bawah, review manual oleh owner.

## Changelog
- 2026-08-24 (r2): Keputusan owner — role disederhanakan jadi Admin tunggal
  (MFA TOTP wajib semua user); Reporting Engine output PDF saja via HTML+Chromium;
  Findings wajib per-project; entitas Client diganti Application; collab editor
  dihapus dari scope (TipTap/Hocuspocus keluar stack).
- 2026-08-24: v2 awal — rewrite dari PRD v1 (Django/Ghostwriter) ke arsitektur
  Next.js fullstack monolith; paritas penuh fitur + Suricata sebagai modul baru.
