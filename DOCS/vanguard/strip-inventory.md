# Strip-Inventory — Yang Dihapus / Disembunyikan Vanguard dari Ghostwriter

**Status:** Implementasi berjalan (feature-flag pass) — 2026-08-20
**Basis:** Ghostwriter v7.2.6 (commit `cdc225787653ee6a848f4cafe8f90adfdc1987c9`)
**Pendamping:** `take-inventory.md` (kebalikannya — daftar yang dipertahankan/diadaptasi)

Dokumen ini adalah jawaban PRD §10 Q1 ("produce a concrete list of modules/fields to strip... before the rebrand pass begins") dari sisi negatif: **daftar lengkap aset Ghostwriter yang di-strip atau disembunyikan** karena Vanguard adalah tool internal single-company (PRD §1.1, §3).

---

## Prinsip & Keputusan

| # | Keputusan | Detail |
|---|---|---|
| 1 | **Tidak ada kode billing/contract** | Inventarisasi grep `billing`, `invoice`, `contract`, `quote` = 0 hasil. Ghostwriter v7.2.6 tidak punya modul billing. Strip sebenarnya hanya soal **multi-client rolodex**. |
| 2 | **Feature flag dulu, hard delete belakangan** | `CONSULTING_MODE` (default `False` = fitur disembunyikan). Reversible; sesuai SETUP 4.2. Hard delete dilakukan nanti setelah yakin tidak ada dependensi tersisa. |
| 3 | **`Project.client` tetap FK required** | `models.py:299-304`. Data model membutuhkan minimal satu Client row. Vanguard mempertahankan **satu default client** (perusahaan sendiri) dan menyembunyikan seluruh UI manajemen client. |
| 4 | **Default client otomatis** | Helper `get_default_client()` + data migration `0064_vanguard_default_client` membuat Client "Vanguard" jika tabel kosong. |

---

## Yang Disembunyikan (feature flag `CONSULTING_MODE=False`)

### 1. Model client-side rolodex (data model dipertahankan, UI di-hide)

| Model | File:line | Status |
|---|---|---|
| `Client` | `rolodex/models.py:27` | **Hide** — 1 row default; manajemen di-hide |
| `ClientContact` | `rolodex/models.py:135` | **Hide** |
| `ClientNote` | `rolodex/models.py:805` | **Hide** |
| `ClientInvite` | `rolodex/models.py:949` | **Hide** — akses berbagi multi-user lintas client tidak relevan single-company |
| `ProjectContact` | `rolodex/models.py:563` | **Hide** — POC external (client) tidak relevan internal |
| `ProjectInvite` | `rolodex/models.py` | **Hide** — undangan akses lintas client |
| `WhiteCard` | `rolodex/models.py:1096` | **Hide** — white card authorization dari client tidak relevan |

### 2. View classes client (gated oleh `ConsultingModeMixin` → 404)

Semua di `rolodex/views.py`, mixin `ConsultingModeMixin` (def di ~line 1153) menaikkan `Http404` saat `CONSULTING_MODE=False`:

| View | Lokasi | URL name |
|---|---|---|
| `ClientListView` | ~1210 | `rolodex:clients` |
| `ClientDetailView` | ~1266 | `rolodex:client_detail` |
| `ClientExtraFieldJson` | ~1331 | `rolodex:client_extra_field_json` |
| `ClientCreate` | ~1335 | `rolodex:client_create` |
| `ClientUpdate` | ~1437 | `rolodex:client_update` |
| `ClientDelete` | ~1525 | `rolodex:client_delete` |
| `ClientNoteCreate` | ~1563 | `rolodex:client_note_add` |
| `ClientNoteUpdate` | ~1616 | `rolodex:client_note_edit` |
| `ClientNoteDelete` | ~513 | `rolodex:ajax_delete_client_note` |
| `ClientContactDelete` | ~540 | `rolodex:ajax_delete_client_poc` |
| `ClientInviteDelete` | ~565 | `rolodex:ajax_delete_client_invite` |
| `ClientLogoDownload` | ~1166 | `rolodex:client_logo_download` |
| `AssignProjectContact` | ~1056 | `rolodex:ajax_assign_project_contact` |

### 3. Function views client (404 guard manual)

| View | Lokasi | Catatan |
|---|---|---|
| `update_client_badges` | `rolodex/views.py:129` | `rolodex:ajax_update_client_badges` |
| `update_project_contacts` | `rolodex/views.py:151` | `rolodex:ajax_update_project_contacts` — baca `ClientContact` |

### 4. Template / UI

| Item | Lokasi | Perubahan |
|---|---|---|
| Sidebar "Clients" submenu | `templates/base_generic.html` | Wrap `{% if CONSULTING_MODE %}` |
| Kolom "Client" project list | `rolodex/templates/rolodex/project_list.html` | Header + cell wrap `{% if CONSULTING_MODE %}` |
| Autocomplete filter client | `project_list.html` | JS `#id_client` wrap flag |
| Filter "Client Name" ProjectFilter | `rolodex/filters.py` | Column dihapus dari layout saat flag off |
| Breadcrumb client → detail | `rolodex/project_detail.html`, `project_form.html`, `deconfliction_form.html`, `oplog/*`, `reporting/*` (9 file) | Link diganti teks polos saat flag off (hindari link ke 404) |
| "Jump to Client" dropdown | `reporting/templates/reporting/report_detail.html` | Wrap flag |
| Page title `{{ project.client }}` | `rolodex/project_detail.html:5,38` | Dipertahankan — nama default client tetap tampil (bukan link) |

### 5. API / Service Token

| Item | Lokasi | Perubahan |
|---|---|---|
| `ServiceTokenForm.clients` field | `api/forms.py:209` | Dihapus dari form saat flag off (`del self.fields["clients"]`) |
| `project_scope` opsi `selected_clients` | `api/forms.py:175-192` | Choice dihapus saat flag off |
| Layout row `service-token-clients-row` | `api/forms.py:301+` | Tidak dirender saat flag off |
| `clean()` guard | `api/forms.py:403+` | Coerce `selected_clients` → `selected` saat flag off; pastikan `cleaned_data["clients"]` selalu ada |
| `form_valid` token view | `api/views.py:2587` | Aman — `clients` selalu ada di cleaned_data |

### 6. CommandCenter configs (tidak relevan, tetap ada tapi tidak dipakai)

`NamecheapConfiguration`, `VirusTotalConfiguration`, `BloodHoundConfiguration`, `CloudServicesConfiguration` — dipertahankan modelnya (hasura/admin), tidak di-hide dari admin agar tidak merusak. Hard delete ditunda.

---

## Yang Dipertahankan (dengan catatan)

| Item | Alasan |
|---|---|
| `Project.client` FK (required) | Data model. Diisi default client secara otomatis. |
| Nama client di judul/breadcrumb (teks) | Laporan dan UI merujuk nama "client" = perusahaan; tidak jadi link. |
| Service token `selected_projects` / `all_accessible` scopes | Berfungsi normal dengan satu client. |
| `shepherd`, `reporting`, `oplog`, `home`, `api`, `users`, `status`, `singleton`, `contrib` | Dipertahankan penuh (lihat take-inventory). |

---

## Migration

| Migration | Isi |
|---|---|
| `rolodex/0064_vanguard_default_client` | `RunPython`: buat Client default "Vanguard" bila tabel kosong; reverse menghapusnya. |

---

## Test Coverage

- `config/settings/test.py` → `CONSULTING_MODE = True` (test suite inti tetap menguji permukaan client di balik flag).
- `rolodex/tests/test_consulting_mode.py` (baru) → `@override_settings(CONSULTING_MODE=False)` menguji: clients list/detail/create/update/delete = 404, projects tetap 200, project create bind default client. Plus satu test `CONSULTING_MODE=True` memastikan clients list tetap 200.

---

## Langkah Hard Delete (belakangan, setelah verifikasi)

1. Buat `Project.client` nullable (migration), backfill data ke default client.
2. Hapus model `Client`, `ClientContact`, `ClientNote`, `ClientInvite`, `ProjectContact`, `ProjectInvite`, `WhiteCard` + migration drop table.
3. Hapus view/form/template/URL client terkait (tidak lagi perlu flag).
4. Hapus `get_default_client()` dan migration 0064.
5. Update Hasura metadata: hapus tabel `rolodex_client*`.