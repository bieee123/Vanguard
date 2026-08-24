> **Dokumen historis Vanguard v1 (Django) — referensi paritas fitur, bukan spesifikasi aktif V2.**

# 04 — Routes (Peta URL Lengkap)

Root conf: `config/urls.py`. Semua app memakai namespace. Prefix per app:

| Prefix | App | Namespace |
|---|---|---|
| `/admin/<custom>` | Django admin (`DJANGO_ADMIN_URL` di .env) | — |
| `/accounts/` | allauth + MFA custom views | — |
| `/users/` | users | `users` |
| `/home/` | home | `home` |
| `/rolodex/` | rolodex | `rolodex` |
| `/shepherd/` | shepherd | `shepherd` |
| `/reporting/` | reporting | `reporting` |
| `/oplog/` | oplog | `oplog` |
| `/api/` | api (Hasura actions + token mgmt) | `api` |
| `/status/` | status healthcheck | `status` |
| `/knowledge-base/` | knowledge_base | `knowledge_base` |
| `/attack-matrix/` | purple_team | `purple_team` |
| `/long-term-coverage/` | dettct | `dettct` |
| `/` | redirect → `home:dashboard` | — |

## users (`/users/`)
```
~redirect/                       redirect setelah login
<username>/                      profil user
<username>/update/               update profil
<username>/update/avatar/        upload avatar
(+ halaman MFA: recovery codes, TOTP deactivate — didaftarkan langsung di root urls)
```

## home (`/home/`)
```
                                 dashboard utama
management/                      halaman management settings
ajax/...                         beberapa endpoint kecil (hide quickstart, dsb.)
```

## rolodex (`/rolodex/`) — engagement management
```
clients/  clients/<pk>  clients/create/  clients/update/<pk>  clients/delete/<pk>
projects/  projects/<pk>  projects/create/<client_pk>  projects/update|delete/<pk>
projects/<pk>/...                sub-resource: assignment, objective, scope, target,
                                 note, deconfliction, white card, invite (CRUD masing2)
ajax/                            endpoint dropdown dependent & tab content partials
export/projects/csv/             ekspor CSV
```
Detail path lengkap lihat `ghostwriter/rolodex/urls.py`.

## shepherd (`/shepherd/`) — infrastruktur
```
domains/  domains/<pk>  domains/create|update|delete  domains/checkout/<pk>  domains/burn/<pk>
servers/  servers/<pk>  servers/create|update|delete
user/active_assets               asset milik user
ajax/update/dns/all              trigger update DNS Namecheap massal
ajax/load_projects|load_project  dropdown dependent
export/domains/csv/  export/servers/csv/
(+ history, note, aux address CRUD)
```

## reporting (`/reporting/`) — findings & report
```
findings/            list library finding
findings/<pk>        create/ update/ delete/          CRUD library
observations/ ...    sama polanya untuk observation
reports/             list report milik user
reports/<pk>         detail builder (tab: findings/evidence/...)
reports/create/<project_pk>  update/ delete/ clone/<pk> archive/<pk> archive (list)
reports/<pk>/all/    generate DOCX/PPTX/XLSX sekaligus
templates/           template report (upload DOCX/PPTX)
evidence/...         upload/download evidence
export/findings/csv/ export/observations/csv/
ajax/...             banyak endpoint kecil (set primary, deliver letter, dll.)
```

## oplog (`/oplog/`)
```
                        list oplog per project
create/<pk> | create/   buat oplog baru
<int:pk>/entries        grid entri (editor bulk via API)
import                  import CSV
export/<pk>             export CSV
ajax/oplog/mute/<pk>    toggle mute entry
ajax/oplog/sanitize/<pk> sanitasi field sensitif
```

## api (`/api/`) — untuk Hasura actions & manajemen token
```
webhook                 auth webhook Hasura (validasi session → role GraphQL)
login / whoami / createUser / test / test_event
generateReport          generate report dari Hasura action
checkoutDomain / checkoutServer / generateCodename
deleteTemplate / downloadEvidence / attachFinding
uploadEvidence / uploadReportTemplate
linkOplogEvidence / uploadOplogRecording / downloadOplogRecording
event/domain/update     event Hasura domain
tags/get | tags/set | tags/get_by/<model>
token/* service-token/*   kelola personal API key & service token (create/revoke/expiry/regenerate)
v1/passive-voice/detect   NLP passive voice checker
```

## knowledge_base (`/knowledge-base/`)
```
                              daftar catatan (index)
notes/<pk>                    detail + backlink
notes/create/  notes/update/<pk>  notes/delete/<pk>
ajax/autocomplete/            autocomplete [[wiki-link]]
ajax/links/<pk>               daftar backlink JSON
graph/json/                   data node+edge graph view
ajax/rag/?q=                  RAG Q&A → {answer, sources[]}
```

## purple_team (`/attack-matrix/`)
```
                                timeline list (+ state timeline viz)
timeline/<pk>                   detail entry + verdict + suggested SOC match
timeline/create/[/engagement]   buat entry (prefill engagement)
timeline/update/<pk>
matrix/?engagement=&verdict=&technique=    heatmap + gap report + DeTT&CT panel + drawer
rule-requests/                  list rule request
rule-requests/<pk>              detail + status tracker + aksi submit/retest
rule-requests/create/?technique=
rule-requests/<pk>/submit       POST draft → pending_review (hanya transisi UI yang diizinkan)
rule-requests/<pk>/verify       POST retest passed→verified / failed→draft
ajax/confirm-verdict/<pk>       POST konfirmasi verdict dari suggested match
```

## dettct (`/long-term-coverage/`)
```
                     panel coverage terbaru (read-only snapshot)
runs/<pk>            raw snapshot run historis
```

## status (`/status/`)
```
                     health check lengkap
simple/              probe ringan (dipakai Docker healthcheck)
```

## Yang Belum Ada di Routes

- `/settings/sentinel/` sub-page (design 6.9) — status Sentinel saat ini menempel di
  `/attack-matrix/sentinel/`? Tidak — view sentinel_integration sudah di-revert bersama
  Step 9. Belum ada.
- Webhook receiver alert-match (`/redteam/webhooks/alert-match`, PRD 6.3).
- Endpoint Suricata ingest (rencana).
- Kanban tasks module (sidebar masih placeholder `href="#"`).
