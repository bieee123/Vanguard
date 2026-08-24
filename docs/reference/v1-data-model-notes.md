> **Dokumen historis Vanguard v1 (Django) — referensi paritas fitur, bukan spesifikasi aktif V2.**

# 05 — Data Model

±60 model Django. Dikelompokkan per app; hanya field/relasi kunci yang dicantumkan.
Migrasi adalah sumber kebenaran final — file ini ringkasan untuk orientasi.

## users
- `User` (AbstractUser custom): `username` (login), `role` {user|manager|admin},
  flag `enable_finding_*`, `enable_observation_*`, `enable_template_management`,
  `require_mfa`. `save()` menyelaraskan is_staff/is_superuser dgn role.
- `UserProfile` (home app): avatar, bio, dll.

## rolodex — engagement management
- `Client`: nama unik, kontak (`ClientContact`), note, invite.
- `Project` (**engagement**): codename, client FK, project_type, start/end date,
  `complete` bool, operator FK, timezone, slack_channel, tags.
- `ProjectAssignment`: operator + role di sebuah project (+periode).
- `ProjectObjective` / `ProjectSubTask`: objective berjenjang + status/priority FK.
- `ProjectScope` / `ProjectTarget`: daftar scope & target IP/domain.
- `ProjectNote` / `ClientNote`.
- `Deconfliction` (+Status): catatan deconfliction dengan SOC.
- `WhiteCard`: aksi tak terjadwal yang diizinkan.
- `ClientInvite` / `ProjectInvite`.

## shepherd — infrastructure
- `Domain`: nama, registrar (`DomainManager`), expirasi, status FK, whois snapshot.
- `History`: checkout domain ke project (periode pinjam).
- `StaticServer` / `TransientServer`, `ServerProvider/Role/Status`, `ServerHistory`.
- `DomainServerConnection`: relasi domain↔server↔project (vanity DNS).
- `AuxServerAddress`: alamat tambahan server. Note models untuk domain/server.

## reporting — findings & report
- `Finding`: library global — title, `severity` FK, `finding_type` FK, CVSS v3/v4,
  description/mitigation/replication, tags, extra fields JSONB.
- `Report`: milik project + template FK + status draft/complete + meta.
- `ReportFindingLink`: **salinan** finding ke dalam report (denormalisasi: punya
  `title`, `severity` FK sendiri, cvss, assignment, position) — edit di report tidak
  mengubah library.
- `ReportTemplate`: DOCX/PPTX/XLSX upload + doc_type + pilihan landscape dsb.
- `Evidence`: file + caption + report FK (+ alignment config models).
- `Observation` / `ReportObservationLink`: pasangan finding tapi non-actionable.
- `Archive`: arsip report selesai. Note models untuk finding/report.
- `Severity`: name unique + weight (kecil = parah) + color. Seed standar:
  Critical/High/Medium/Low/Informational (nama bebas per instalasi).

## oplog — operation log
- `Oplog`: nama log per project.
- `OplogEntry`: timestamp start/end, source/dest IP, tool, command, output,
  user_context, technique_id, description, status. Grid editor bulk via API.
- `OplogSanitization`: aturan sanitasi field sensitif.
- `OplogEntryEvidence` / `OplogEntryRecording`: lampiran per entry.

## assets (Vanguard native)
- `Asset`: hostname/ip_address/os_fingerprint/open_ports JSONB/business_unit/
  criticality/status/discovered_by/source_tool/sentinel_asset_id.
  M2M → Project lewat `EngagementAsset` (through, added_at).

## knowledge_base (Vanguard native)
- `Note`: title, body_markdown, engagement FK nullable, tags M2M, created_by,
  `exclude_from_rag` bool.
- `NoteLink`: source_note → target_note (resolved) + target_title_raw;
  ON DELETE CASCADE untuk backlink otomatis.
- `NoteEmbedding`: note FK, chunk_index, chunk_text, embedding **pgvector**
  (cosine ops), excluded_from_rag. Index IVFFlat.

## dettct (Vanguard native)
- `DeTTCTRun`: output_file_path, run_at, imported_at, payload JSONB
  (techniques/data_sources/groups). Property: `coverage_stats`
  (total/covered/uncovered teknik), `data_sources`, `groups`, `source_file_type`.

## purple_team (Vanguard native)
- `TimelineEntry`: engagement FK (Project), asset FK nullable (SET_NULL),
  technique_id, tactic, timestamp, action_description, outcome
  {success|failed|blocked}, operator FK, note, sequence_order.
- `DetectionVerdict` (1-1 ke TimelineEntry): verdict enum
  {detected, not_detected, detected_not_escalated, detected_late, untested},
  matched_sentinel_alert_id, detection_delay_seconds, confirmed_by_operator,
  confirmed_by/at.
- `RuleRequest`: technique_id, timeline_entry FK nullable, draft_rule_xml (required),
  test_log_sample_path, justification, **status** enum
  {draft → pending_review → approved → deployed → verified} + rejected branch;
  requested_by/at, approved_by (Sentinel-side string)/at, deployed_at,
  verified_at, rejection_reason. Index pada status & technique_id.

## api
- `APIKey` (drf-api-key): personal API key user, expiry, revoke.
- `ServiceToken` + `ServiceTokenPermission` + `ServiceTokenProjectScope`:
  token service-to-service dengan scope resource granular.
- `ServicePrincipal`: identitas pemanggil eksternal.
- `UserSession`: tracking sesi aktif (untuk auth webhook Hasura).

## commandcenter (singleton configs)
`CompanyInformation`, `ReportConfiguration` (default template, figure/table caption),
`SlackConfiguration` (webhook + channel), `GeneralConfiguration`, `BannerConfiguration`,
`Namecheap/VirusTotal/BloodHound/CloudServices` (sebagian di-hide utk Vanguard),
`ExtraFieldSpec/Model/Type`: field dinamis tambahan untuk Finding/Report/Client.

## Relasi Kunci Antar-App

```
Client ──< Project ──< ProjectAssignment >── User
              │ ──< Report ──< ReportFindingLink >── Finding(library)
              │ ──< Oplog ──< OplogEntry
              │ ──< TimelineEntry ──[1:1]── DetectionVerdict
              │ ──< EngagementAsset >── Asset
              ├──< Deconfliction / WhiteCard / ProjectObjective
              └──< RuleRequest (opsional timeline_entry FK)

Note ──< NoteEmbedding ; Note ──< NoteLink (self-M2M resolved)
DeTTCTRun (snapshot mandiri, tak berelasi)
```

## Catatan untuk Rebuild

- Pola "library + link copy" (Finding ↔ ReportFindingLink) penting dipertahankan:
  report harus immutable terhadap perubahan library.
- Verdict 1-1 per entry menyederhanakan agregasi heatmap (join langsung).
- Semua konfigurasi runtime singleton disimpan DB — ganti env restart-free.
