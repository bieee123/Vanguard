# Take-Inventory — Apa yang Diambil Vanguard dari Ghostwriter

**Status:** Approved 2026-08-20
**Basis:** Ghostwriter v7.2.6 (commit `cdc225787653ee6a848f4cafe8f90adfdc1987c9`)
**Pendamping:** `strip-inventory.md` (kebalikannya — daftar yang dihapus/disembunyikan)

Dokumen ini memetakan **setiap modul PRD** ke aset Ghostwriter yang diambil, dengan tindakan: `keep as-is` / `adapt` / `build native`. Ini menjawab PRD §10 Q1 ("produce a concrete list of modules/fields to strip... before the rebrand pass begins") dari sisi yang positif: bukan hanya apa yang dibuang, tapi apa yang dipertahankan dan menjadi fondasi Vanguard.

---

## Keputusan Terkunci

| # | Keputusan | Pilihan | Catatan |
|---|---|---|---|
| 1 | App `shepherd` (C2 infra mgmt) | **Pertahankan sepenuhnya** | Self-contained, tidak mengganggu; berguna untuk tracking C2 infra (domain, VPS) |
| 2 | Timeline (5.5) | **Adaptasi `OplogEntry`** | Sudah punya UI, sanitization audit, API import; tambah field via migration |
| 3 | Asset (5.2) | **Tabel `assets` global native** | PRD butuh cross-engagement inventory; `ProjectTarget` terlalu sederhana & project-scoped |
| 4 | Output | **`DOCS/vanguard/take-inventory.md`** | Dokumen permanen di repo |

---

## Peta Take per PRD Modul

### 5.1 Engagement Management — `adapt`

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| `rolodex.Project` | **Adapt** | Inilah "Engagement". Rename konsep jadi engagement di UI/API. Drop FK `client` (jadikan nullable lalu remove) |
| `rolodex.ProjectType` | **Adapt** | = engagement type (internal pentest / red team / purple drill / etc). Tambah enum value yang dibutuhkan PRD |
| `rolodex.ProjectStatus` / field status | **Adapt** | Align ke status PRD: Planned / Active / Paused / Completed / Reported |
| `rolodex.ProjectScope` | **Adapt** | = scope in/out (JSON) + rules of engagement. Kolom `scope` sudah menampung daftar |
| `rolodex.ProjectObjective` | **Adapt** | = objectives; support status/prioritas |
| `rolodex.ProjectSubTask` | **Adapt** | = sub-tasks di bawah objective; dasar untuk 5.9 di fase 2 |
| `rolodex.ProjectNote` | **Keep** | Catatan bebas per engagement |
| `rolodex.ProjectAssignment` | **Keep** | Assignee di engagement |
| `rolodex.ProjectRole` | **Keep** | Peran anggota engagement |
| `rolodex.Deconfliction` | **Keep** | OPSEC deconfliction — relevan untuk 5.5/6 (waspada "apakah ini dari saya?") |

**Yang di-strip dari app ini:** `Client`, `ClientContact`, `ClientNote`, `ClientInvite`, `ProjectContact`, `ProjectInvite`, `WhiteCard`, dan semua field/client-scoped queries (lihat `strip-inventory.md`).

### 5.2 Asset & Target Inventory — `build native`

`ProjectTarget` dipertahankan untuk **hijau/kompromi state per engagement**, tetapi inventory utama dibuat native sebagai tabel global `assets` + `engagement_assets` (bisa lintas engagement) sesuai SCHEMA.md.

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| `rolodex.ProjectTarget` | **Keep (terbatas)** | Status compromised/not-compromised per engagement; bisa di-relink ke `assets` global |
| `assets` (baru) | **Build native** | hostname/IP, OS fingerprint, open ports, business unit, criticality, status, discovered-by, source_tool, sentinel_asset_id (SCHEMA.md 5.2) |
| `engagement_assets` (baru) | **Build native** | Many-to-many lintas engagement |

### 5.3 Findings / Vulnerability Management — `keep as-is`

Ini inti dan sudah battle-tested. Dipertahankan hampir penuh.

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| `reporting.Finding` | **Keep** | title, description, impact, mitigation, replication steps, CVSS, severity, status, references, timestamps |
| `reporting.FindingType` | **Keep** | Kategori finding |
| `reporting.Severity` | **Keep** | Skala severity |
| `reporting.FindingNote` | **Keep** | Catatan per finding |
| `reporting.ReportFindingLink` | **Keep** | Relasi finding ↔ report |
| `reporting.Evidence` (sebagian) | **Adapt** | FileField + caption + report link; tambah `engagement_id` + `encrypted` + `expires_at` + link ke timeline entry (lihat 5.6) |
| `reporting.Observation` + link | **Keep** | Observasi terstruktur di report |
| CVSS calculator | **Keep** | Sudah ada di form/JS |
| Bulk import (Nessus/OpenVAS/Nuclei) | **Adapt** | Parser ada untuk beberapa format; 5.10 membangun parser tambahan |

**Catatan strip:** tidak ada. Modul ini inti PRD 5.3.

### 5.4 Attack Path & ATT&CK Mapping — `build native`

Ghostwriter **tidak punya model ATT&CK terstruktur** — hanya `tags` informal (mis. `ATT&CK:T1555` pada tag field). Semua dibangun native:

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| Tag system (`taggit`) | **Keep (alat bantu)** | Tetap dipakai untuk tags ad-hoc, tapi bukan basis data ATT&CK |
| `finding_attack_techniques` (baru) | **Build native** | Mapping finding → technique (SCHEMA.md 5.3) |
| `timeline_entries.technique_id` / `tactic` | **Build native** | Field pada timeline (lihat 5.5) |
| ATT&CK Matrix page | **Build native** | Navigator-style heatmap, cumulative coverage, gap view |
| DeTT&CT ingestion | **Build native (pembaca)** | Baca output file DeTT&CT (PRD 1.1) — `dettct_runs` table (SCHEMA.md) |

### 5.5 Activity / Action Timeline — `adapt`

**Keputusan terkunci #2:** adaptasi `OplogEntry`, bukan model native baru.

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| `oplog.Oplog` | **Keep** | Kontainer per project (engagement); sudah punya mute notifications |
| `oplog.OplogEntry` | **Adapt** | Sudah punya: start/end timestamps, source_ip, dest_ip, tool, user_context, command, description, output, comments, tags, operator_name, status |
| `oplog.OplogEntryEvidence` | **Keep** | File evidence per entry |
| `oplog.OplogEntryRecording` | **Keep** | Rekaman sesi per entry |
| `oplog.OplogSanitization` | **Keep** | Audit sanitasi field sensitif — sangat relevan dengan 5.6 encryption |
| Migration penambah field | **Build native** | Tambah `technique_id`, `tactic`, `outcome` (success/failed/blocked), `sequence_order`, `asset_id` (link ke `assets` global) |

**Alasan adaptasi:** UI lengkap sudah ada (filter, pagination, export), API import/export sudah ada, sanitization audit sudah ada. Membangun model timeline native berarti membangun ulang semua itu dari nol.

### 5.6 Evidence & Artifact Repository — `adapt`

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| `reporting.Evidence` | **Adapt** | Tambah `engagement_id`, `encrypted` flag, `expires_at` (retention/purge), `timeline_entry_id` (link 5.5) |
| `reporting.Archive` | **Keep** | Zip/archive export |
| Storage backend | **Adapt** | PRD §10 Q: gunakan storage lokal terenkripsi; evaluasi ulang vs MinIO. Ghostwriter pakai `MEDIA_ROOT` lokal |
| Encryption-at-rest | **Build native** | Enkripsi file saat upload (application-layer) + access logging pada download |

### 5.7 Purple Team Sync — `build native`

Tidak ada di Ghostwriter. Semua native (PRD 1.1 — konsep VECTR saja, tanpa kode VECTR):

| Komponen | Tindakan | Detail |
|---|---|---|
| `detection_verdicts` (baru) | **Build native** | verdict per timeline entry (SCHEMA.md 5.7) |
| Sentinel API client | **Build native** | Client REST ke Sentinel (`/api/v1/soc/alerts`) — pakai `api.ServiceToken` sebagai kredensial (lihat 6.x) |
| Time-correlation lookup + konfirmasi operator | **Build native** | Auto-suggest match, operator confirm/reject |
| Detection Gap Report | **Build native** | Auto-generated; jadi input Wazuh rule-tuning |
| Push detection-gap task ke SOC backlog | **Build native** | Optional |

### 5.8 Reporting & Export — `keep as-is`

Ini **kekuatan utama fork** — dipertahankan penuh.

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| `reporting.Report` | **Keep** | Model report + status draft/reviewed/final |
| `reporting.ReportTemplate` | **Adapt** | Template Jinja2; **strip `client` FK** (template jadi global); tambah type executive/technical (PRD) |
| `reporting.DocType` | **Keep** | Jenis dokumen |
| `modules/reportwriter/*` | **Keep** | Engine Jinja2 → DOCX/PPTX/XLSX/JSON (dengan sandbox) |
| Collab editor (TipTap) di `javascript/` | **Keep** | Rich-text editing report/finding fields |
| Template Executive/Technical | **Build native** | Template Jinja2 baru sesuai PRD 5.8 |
| Report versioning | **Adapt** | Tambah `version` field + change history |

### 5.9 Task / Kanban — `build native`

`ProjectObjective`/`ProjectSubTask` bukan kanban. Tabel `tasks` native (SCHEMA.md 5.9). Fase 2.

### 5.10 Tool Integrations (Import Layer) — `build native`

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| Import existing (oplog API import, dll) | **Keep** | Sebagian sudah ada |
| Parser Nmap/Nuclei/Amass/Subfinder/Burp/Nessus/OpenVAS | **Build native** | Parser per format + generic CSV/JSON mapper (PRD 5.10) |
| `assets`/`findings` update via import | **Build native** | Buat/update record + source_tool tag + dedup |

### 5.11 Credential & Access Tracker — `build native`

Tidak ada di Ghostwriter. Tabel `credentials` native (SCHEMA.md 5.11), encryption application-layer, mask-by-default, reveal logging, auto-purge reminder.

### 5.12 Notifications — `keep + extend`

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| `modules/notifications_slack.py` (SlackNotification) | **Keep** | Slack already implemented |
| `home/consumers.py` (WebSocket notification channel) | **Keep** | Real-time per-user notifications |
| `commandcenter.SlackConfiguration` | **Keep** | Config Slack + channel |
| `oplog.mute_notifications` | **Keep** | Mute per log |
| Telegram/email channel | **Build native** | Tambah channel (SCHEMA.md 5.12) |
| Digest harian/mingguan | **Build native** | Scheduled job |

### 5.13 Access Control & Audit — `keep + extend`

| Aset Ghostwriter | Tindakan | Detail |
|---|---|---|
| `users.User` + role (manager/admin/user) | **Keep** | Align role PRD: Operator / Viewer (ready untuk multi-user) |
| allauth (SSO, MFA) | **Keep** | MFA mandatory (PRD) |
| `api.APIKey` / `ServiceToken` | **Keep** | Basis kredensial integrasi Sentinel (6.x) |
| `home/consumers` access control | **Keep** | WebSocket auth |
| **Audit log** | **Build native** | Ghostwriter **tidak punya full audit trail** (hanya oplog sanitization). Tabel `audit_log` native (SCHEMA.md 5.13): view/edit/export/reveal_credential events |

### 5.14 Knowledge Base / Second Brain — `build native`

Tidak ada di Ghostwriter. Semua native (SCHEMA.md 5.14): notes markdown + `[[links]]` + backlinks + graph, RAG via pgvector, RBAC-aware retrieval, sensitive-field exclusion. Fase 2/3, tergantung keputusan model AI (PRD open question).

### 6.x Sentinel Integration & Rule Request — `build native`

| Komponen | Tindakan | Detail |
|---|---|---|
| `api.ServiceToken`/`APIKey` | **Keep (dipakai ulang)** | Dijadikan basis kredensial service-to-service (PRD 6.4) |
| `sentinel_connections` (baru) | **Build native** | read/write scope terpisah, API key terenkripsi, status, last sync (SCHEMA.md) |
| Push endpoints (actions/findings/engagements) | **Build native** | REST ke Sentinel (PRD 6.1) |
| Pull endpoints (alerts, asset metadata) | **Build native** | Dari Sentinel (PRD 6.3) |
| Webhook alert-match | **Build native** | Push real-time dari Sentinel (PRD 6.3 optional) |
| `rule_requests` (baru) | **Build native** | Workflow draft → pending_review → approved → deployed → verified (SCHEMA.md 6.5) |
| Idempotency + rate limiting + backoff | **Build native** | PRD 6.5 guardrails |

---

## Ringkasan Aksi per App

| App | Aksi | Alasan |
|---|---|---|
| `reporting` | **Keep** | Inti findings/evidence/report — PRD 5.3, 5.6, 5.8 |
| `oplog` | **Keep + adapt** | Timeline — PRD 5.5 |
| `api` | **Keep** | Service tokens, API keys, GraphQL actions — PRD 5.13, 6.x |
| `users` | **Keep** | Auth, roles, MFA |
| `home` | **Keep** | Dashboard, profile, WebSocket notifications — PRD 5.12 |
| `status` | **Keep** | Health checks |
| `singleton` | **Keep** | SingletonModel base class |
| `contrib` | **Keep** | Django sites framework |
| `commandcenter` (sebagian) | **Keep** | `CompanyInformation`, `ReportConfiguration`, `GeneralConfiguration`, `BannerConfiguration`, `ExtraField*` — config inti |
| `commandcenter` (sebagian) | **Hide** | `NamecheapConfiguration`, `VirusTotalConfiguration`, `BloodHoundConfiguration`, `CloudServicesConfiguration` — tidak relevan |
| `rolodex` (project-side) | **Keep** | Project/ProjectType/ProjectScope/ProjectObjective/ProjectSubTask/ProjectNote/ProjectAssignment/ProjectRole/Deconfliction — PRD 5.1 |
| `rolodex` (client-side) | **Strip/hide** | Client/ClientContact/ClientNote/ClientInvite/ProjectContact/ProjectInvite/WhiteCard — multi-client |
| `shepherd` | **Pertahankan sepenuhnya** | C2 infra management (keputusan #1); self-contained, tidak mengganggu |
| `modules/notifications_slack` | **Keep** | Notifications — PRD 5.12 |
| `modules/reportwriter` | **Keep** | Jinja2 report engine — PRD 5.8 |
| `javascript/` (collab editor) | **Keep** | TipTap editor untuk report/finding fields |
| Hasura metadata | **Adapt** | Strip tabel `client*`; tambah tabel native baru seiring build |

---

## Yang WAJIB Dibangun Native (tidak ada di Ghostwriter)

| Modul | PRD | Catatan |
|---|---|---|
| Asset & Target Inventory (global) | 5.2 | `assets` + `engagement_assets` |
| ATT&CK Matrix & heatmap | 5.4 | + DeTT&CT file reader |
| Purple Team Sync | 5.7 | `detection_verdicts` + Sentinel client |
| Task/Kanban | 5.9 | `tasks` |
| Tool import parsers | 5.10 | Nmap/Nuclei/Amass/Burp/Nessus + generic mapper |
| Credential tracker | 5.11 | `credentials` (encrypted) |
| Notification channel Telegram/email | 5.12 | + digest |
| Full audit trail | 5.13 | `audit_log` |
| Knowledge Base + RAG | 5.14 | `notes` + pgvector |
| Sentinel connections + rule request | 6.x | `sentinel_connections`, `rule_requests` |

---

## Implementasi

- **Order:** baseline sudah di-commit (Tahap 0) → rebrand (branch `rebrand/ui`) → strip eksekusi (branch `strip/consulting-features`) → build native bertahap per fase PRD (Phase 1: 5.1–5.3, 5.5, 5.8 basic; Phase 2: 5.4, 5.9, 5.10, 5.12; Phase 3: 5.7, 5.11, 5.13, 6.5, 5.14).
- **Timeline adaptasi** dilakukan di awal eksekusi strip (migration field baru `OplogEntry`) supaya 5.5 segera siap.
- **Audit log** dibangun native di awal (Phase 1) karena merupakan fondasi kepercayaan untuk semua modul yang menyentuh data sensitif.