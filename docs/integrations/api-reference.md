# 06 — API & Integrasi Eksternal

## A. Hasura GraphQL (warisan, dipakai fitur lama)

- Engine: kontainer `graphql_engine` (Hasura), metadata di `hasura-docker/metadata/`.
- Auth: setiap request GraphQL → Hasura memanggil webhook
  `GET|POST /api/webhook` (`GraphqlAuthenticationWebhook`) yang validasi session Django
  dan mengembalikan role untuk permission rule Hasura.
- Actions (Django menangani): daftar di `/api/*` — lihat 04-routes.md bagian api.
  Dipakai terutama oleh frontend collab/report builder React.
- **Status Vanguard**: tidak ada schema baru yang ditambahkan; fitur native Vanguard
  (KB, purple_team, dettct, assets) TIDAK melewati Hasura — mereka Django views biasa.
- Implikasi rebuild: kalau tidak butuh collab editor realtime + report builder React,
  seluruh lapisan Hasura bisa digantikan endpoint REST/Django biasa.

## B. Integrasi Eksternal — Status

### 1. Sentinel (SOC middleware) — ⏸ DITUNDA (Step 9–10)

Kontrak final sudah dispesifikasikan (PRD §6, prompt siap pakai pernah dibuat):

| Endpoint | Method | Scope | Fungsi |
|---|---|---|---|
| `/api/v1/redteam/actions` | POST | write | push timeline entry |
| `/api/v1/redteam/findings` | POST | write | push finding |
| `/api/v1/redteam/engagements` | POST/PATCH | write | sync scope engagement |
| `/api/v1/soc/alerts?asset&from&to` | GET | read | lookup alert utk korelasi verdict |
| `/api/v1/soc/assets/{id}` | GET | read | enrichment asset |
| `/api/v1/redteam/rule-requests` | POST | write | kirim draft rule request |
| `/api/v1/soc/rule-requests/{id}/status` | GET | read | poll status |
| `/api/v1/redteam/rule-requests/{id}/retest` | POST | write | hasil retest |
| `/api/v1/health` | GET | — | health probe |

Aturan: 2 kredensial terpisah (read `soc/*`, write `redteam/*`), Bearer token,
Idempotency-Key header, retry/backoff di sisi client, Vanguard TIDAK PERNAH bicara
langsung ke Wazuh. Sisi Vanguard saat ini masih mock:
`purple_team/services.mock_sentinel_alerts()`.

Yang sudah disiapkan sebelum ditunda (desain siap di-reimplement):
client module dengan retry+scoped key+idempotency, halaman status integrasi,
tracking `SentinelConnection` (model), whitelist task push async.

### 2. DeTT&CT — ✅ jalan (pembaca)

- DeTT&CT berjalan EKSTERNAL (cron/sidecar), menulis YAML ke path.
- Import: `python manage.py import_dettct <file>` atau task
  `ghostwriter.dettct.tasks.import_dettct_output` (whitelisted django-q).
- Parser: `dettct/parsers.py` — tipe file `techniques-administration` dll.
- Output: snapshot read-only di panel "Long-term Coverage" + label Last updated.

### 3. AI/RAG Knowledge Base — ✅ jalan (butuh provider)

```
Note.body_markdown ──chunk──▶ embeddings API ──▶ NoteEmbedding(pgvector)
Pertanyaan ──embed──▶ cosine top-K chunk ──build_prompt──▶ LLM chat/completions
          ──▶ {answer, sources[{note_id, title, snippet}]}
```
- Embedding provider & LLM = endpoint OpenAI-compatible, dikonfigurasi env
  (rencana: LiteLLM proxy yang sama dgn Sentinel; model target DeepSeek V4).
- Tanpa konfigurasi: RAG tetap menjawab dengan sources kosong (tidak error).

### 4. Integrasi warisan Ghostwriter (tetap hidup)

| Layanan | Dipakai |
|---|---|
| Namecheap API | update DNS otomatis domain (shepherd, task django-q) |
| VirusTotal API | cek domain (opsional) |
| AWS creds check / DigitalOcean check | validasi infra cloud |
| Slack webhook | notifikasi report complete |
| WHOIS lookup | data domain |

### 5. Suricata — 🆕 BELUM ADA (rencana user berikutnya)

Belum ada spesifikasi. Kandidat bentuk integrasi:
ingest `eve.json` (alert IDS) sebagai sumber detection verdict otomatis /
enrichment asset. Perlu PRD section sendiri sebelum dibangun.

## C. Endpoint Internal AJAX (non-GraphQL)

Pola umum: view function `@require_GET/@require_POST` return `JsonResponse`,
auth via session + cek privileged manual.

Contoh penting:
- `/knowledge-base/ajax/rag/?q=` — RAG Q&A.
- `/knowledge-base/ajax/autocomplete/?q=` — saran wiki-link.
- `/knowledge-base/graph/json/` — nodes+edges graph view.
- `/attack-matrix/ajax/confirm-verdict/<pk>` — simpan verdict operator.
- `/attack-matrix/rule-requests/<pk>/submit|verify` — transisi lifecycle.
- `/shepherd/ajax/load_projects/` dsb. — dropdown dependent.
- `/oplog/ajax/oplog/mute|sanitize/<pk>` — aksi grid oplog.
- `/api/tags/get|set|get_by/<model>` — tag lintas model.

## D. Catatan Rebuild

- Semua "API" internal bergaya RPC sederhana (JSON in/out + session cookie).
  Belum ada REST API publik yang konsisten — drf-api-key dipakai untuk service token,
  bukan API publik terdokumentasi.
- Kalau rebuild: definisikan REST/GraphQL schema tunggal sejak awal; hindari duplikasi
  jalur Django-view vs Hasura-action seperti sekarang.
