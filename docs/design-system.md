# Design System — Vanguard V2 (Obsidian Red Team Console)

**Scope dokumen:** spesifikasi visual & UX-architecture yang mengikat semua halaman,
**tech-agnostic** — implementasi di Next.js memakai token ini sebagai Tailwind theme /
CSS custom properties; tidak ada lagi dependensi pada framework lama.

**Formula:** kepadatan dashboard/panel ala Grafana + pola data observability +
semantik ofensif red team + fondasi gelap obsidian + **Signal Red** sebagai aksen
operasional. Hasilnya harus terbaca sebagai *"Grafana yang dibangun khusus untuk
red team operations"* dengan identitas sendiri — bukan reskin Grafana.

**Yang harus bisa dijawab operator dalam sekali lihat:** apa yang aktif, apa yang
berbahaya sekarang, apa yang dieksploitasi, apa yang terdeteksi SOC, di mana celah
deteksi, teknik ATT&CK mana yang belum tercakup, apa aksi berikutnya, dan apakah
integrasi (Sentinel/Wazuh/Suricata) sehat.

---

## 1. Konsep Desain

Satuan UI inti adalah **panel** (bukan card): blok padat ber-border, chrome minimal,
data dulu dekorasi tidak ada. Setiap halaman adalah dashboard dari panel-panel.

Tiga hal non-negotiable (dibawa dari desain awal):
1. **Phase-tracker rail** untuk engagement.
2. **Warna = encoding semantik ketat** — tidak pernah dekoratif, selalu berpasangan
   dengan teks/ikon.
3. **Fondasi gelap graphite/obsidian** — tidak pernah hitam murni.

Yang meningkat dari desain lama: densitas informasi naik, chrome turun, dan setiap
panel ber-data mendapat affordance toolbar/hover/expand ala observability tool.

---

## 2. Palet Warna

### Background

| Token | Hex | Pemakaian |
|---|---|---|
| `--bg-base` | `#0B0D10` | Background aplikasi terluar |
| `--bg-canvas` | `#0F1217` | Canvas dashboard (di belakang panel) |
| `--bg-panel` | `#11151A` | Permukaan panel default |
| `--bg-panel-raised` | `#181D24` | Panel header, modal, dropdown |
| `--bg-panel-hover` | `#1D232C` | Hover state baris/panel |
| `--bg-panel-active` | `#202832` | State pressed/aktif |

Tidak pernah pakai hitam murni (`#000000`) sebagai permukaan utama — ini
graphite/obsidian, bukan kehampaan.

### Border

| Token | Hex | Pemakaian |
|---|---|---|
| `--border-subtle` | `#27303A` | Border panel/divider default |
| `--border-default` | `#303A46` | Divider tabel, border input |
| `--border-strong` | `#3D4856` | Divider aktif/fokus |

Border selalu tenang. Tidak ada border terang sebagai state default.

### Warna Tipografi

| Token | Hex | Pemakaian |
|---|---|---|
| `--text-primary` | `#E6EAF0` | Heading, konten primer |
| `--text-secondary` | `#9AA4B2` | Body copy, label |
| `--text-muted` | `#66707E` | Timestamp, placeholder |
| `--text-disabled` | `#454D58` | State disabled |

### Aksen Semantik

Setiap aksen punya satu tugas: mengkodekan satu makna operasional tertentu.
Semuanya tidak dekoratif dan bukan warna default sesuatu — permukaan tetap netral
sampai ada yang perlu disorot.

**Signal Red** — `--accent-signal #E5484D` / `--accent-signal-dim #351A1D`
Temuan kritikal, state offensive aktif, eksploitasi, aktivitas attack, detection gap,
"Not Detected", kontrol gagal, aksi destruktif primer. Makna: *ada yang penting butuh
perhatian.* Dipakai hemat agar tetap bermakna saat muncul.

**Teal** — `--accent-teal #35B7A0` / `--accent-teal-dim #16332F`
Detected, verified, fixed, mitigated, healthy, connected, successful, completed.
Makna: *kontrol bekerja, state sehat.*

**Amber** — `--accent-amber #D9A441` / `--accent-amber-dim #352B18`
Warning, deteksi parsial, pending, degraded, perlu retest, severity medium, butuh
aksi manusia. Makna: *perlu investigasi atau aksi.* Bukan aksen UI default — hanya semantik.

**Steel Blue** — `--accent-blue #5B8DEF` / `--accent-blue-dim #18253D`
Konten informasional, analitik, metadata, link navigasi, visualisasi data netral.
Selalu sekunder terhadap Signal Red — identitas produk ini merah, bukan biru.

**ATT&CK Violet** — `--accent-violet #8B7FE8` / `--accent-violet-dim #24203D`
Khusus MITRE ATT&CK: technique ID, tactic, taksonomi, klasifikasi teknis.
Bukan aksen brand generik — jika muncul artinya "ini terkait ATT&CK", tidak lain.

**Gray** (`--text-muted` / `--border-strong`)
Untested, disabled, unknown, inactive, historis, netral.

### Mapping Severity

Critical → Signal Red · High → blend merah-oranye hangat `#E8654D` · Medium → Amber ·
Low → kuning pudar `#D9C24A` · Info → `--text-muted`

### Mapping Detection Verdict

Detected → Teal · Detected-not-escalated/Partial → Amber · Not Detected → Signal Red ·
Untested → Gray (`--border-strong`)

### Disiplin Rasio Warna

Kira-kira **90% permukaan/teks netral gelap, 10% warna semantik**. Tidak boleh terbaca
sebagai interface security neon — area besar tetap gelap; aksen hanya mengarahkan
perhatian ke yang benar-benar membutuhkannya.

---

## 3. Tipografi

| Peran | Typeface | Weight |
|---|---|---|
| Display / judul halaman & panel | **Inter Tight** | 600–700 |
| UI / body | **Inter** | 400–600 |
| Data teknis | **JetBrains Mono** | 400–500 |

JetBrains Mono wajib untuk: alamat IP, hostname, CVE, CWE, ATT&CK technique ID,
hash, command, timestamp, API endpoint, rule ID — semua literal/teknis, di mana pun
kemunculannya (tabel, drawer, isi panel).

### Type Scale

| Token | Ukuran | Pakai |
|---|---|---|
| `--text-h1` | 28–30px | Judul halaman |
| `--text-h2` | 20–22px | Judul panel |
| `--text-h3` | 15–16px | Sub-label, header tabel (uppercase, `--text-muted`, tracking +0.04em) |
| `--text-body` | 14px | Body default |
| `--text-small` | 12px | Meta text, timestamp |
| `--text-mono` | 12–13px | Field teknis/data |

Tidak ada display type oversized di mana pun — density lebih prioritas daripada
tipografi hero.

---

## 4. Layout, Spacing & Shape

- Satuan spacing dasar: **4px**; gap standar 8/12/16/24/32px.
- Radius: `--radius-sm: 4px` (badge, tombol, input) · `--radius-md: 6–8px` (panel) ·
  `--radius-lg: 10px` (hanya drawer — modal dihindari, lihat §5).
- Tanpa shadow besar, tanpa glassmorphism, tanpa gradient. Panel dipisah lewat border
  1px, bukan elevasi.
- Grid: **12 kolom** desktop / 8 kolom tablet / 1 kolom mobile. Max content width
  1600px (lebih lebar dari SaaS umum, karena density panel butuh ruang).
- Sidebar: 240px expanded / 64px collapsed.
- Focus state: outline 2px `--accent-blue` (bukan Signal Red — merah disiapkan untuk
  semantik bahaya/kritikal, bukan focus ring) di setiap elemen interaktif.

---

## 5. Komponen Inti

### Application Shell

```
┌─────────────────────────────────────────────────────────────┐
│ TOP NAVIGATION / TOOLBAR                                     │
├───────────┬─────────────────────────────────────────────────┤
│           │  DASHBOARD CANVAS                                │
│ SIDEBAR   │  ┌────────┐┌────────┐┌────────┐┌────────┐        │
│           │  │ PANEL  ││ PANEL  ││ PANEL  ││ PANEL  │        │
│           │  └────────┘└────────┘└────────┘└────────┘        │
│           │  ┌──────────────────────┐┌────────────────┐      │
│           │  │        CHART         ││      CHART      │      │
│           │  └──────────────────────┘└─────────────────┘      │
│           │  ┌───────────────────────────────────────────┐  │
│           │  │            ATT&CK HEATMAP                  │  │
│           │  └───────────────────────────────────────────┘  │
└───────────┴─────────────────────────────────────────────────┘
```

### Top Navigation
56px tinggi, `--bg-panel-raised`, border bawah `--border-subtle`. Sengaja tidak
dominan secara visual — ini toolbar, bukan hero bar.
- Kiri: mark Vanguard, nama produk, label workspace.
- Tengah/kanan: engagement selector, global search, **time-range control**
  (gaya Grafana: "Last 24h / 7d / 30d / Custom" — berlaku untuk semua panel
  time-series di halaman aktif), tombol refresh, bell notifikasi, avatar operator.

### Sidebar
240px / 64px collapsed, `--bg-panel`. Item: Dashboard, Engagements, Assets, Findings,
ATT&CK Matrix, Timeline, Knowledge Base, Reports, Tasks, Settings. Ikon outline 18px
(Lucide atau setara). Item aktif: **garis 3px Signal Red di kiri + background raised +
teks primary** — tidak pernah block fill merah; indikatornya garis, bukan isian.

### Phase Tracker Rail
`Recon → Exploitation → Post-Exploitation → Reporting`. Completed = outline Teal,
current = fill Signal Red, upcoming = outline Gray. Dirender compact inline dengan
header engagement — bukan stepper besar berdiri sendiri.

### Panel (primitif UI inti — menggantikan "Card")

```
--bg-panel, border 1px solid --border-subtle, radius 6–8px, padding/gap 16px
```
Tanpa shadow, tanpa glassmorphism, tanpa gradient.

**Panel header:**
```
┌─────────────────────────────────────────────┐
│ PANEL TITLE                         ⋮  ↗  ⟳ │
├─────────────────────────────────────────────┤
│                 CONTENT                      │
└─────────────────────────────────────────────┘
```
Title (h2) + deskripsi opsional, dengan toolbar (menu more-actions, expand-to-
fullscreen, refresh) yang muncul saat hover untuk panel ber-data (chart, tabel,
heatmap) — panel konten statis (mis. scope text) tidak perlunya.

### Stat Panel
Angka besar (skala h1, mono untuk angkanya), label di atas, sparkline kecil di bawah,
opsional trend delta vs periode sebelumnya. Warna angka mengikuti mapping semantik
objeknya (mis. angka Open Critical Findings dalam Signal Red).

### Status / Severity Badge
`--radius-sm`, padding 4/10px, `--text-small` weight 600. Background = token dim,
teks = token solid aksen yang sama.

### Detection Verdict Chip
Bentuk pill sama dengan badge, dipasangi ikon kecil (check / x / clock / dash),
memakai mapping warna verdict.

### Compact Status Indicator
(replaces "connection chip" — lebih inline-telemetry daripada badge)
```
● CONNECTED     ● DETECTED     ● NOT DETECTED     ● DEGRADED     ● UNTESTED
```
Dot 8px + label, `--text-small`, tanpa background pill — menempel langsung di
permukaan panel seperti log line. Teal = healthy, Amber = degraded, Signal Red =
disconnected/critical, Gray = untested/inactive. **Jangan pernah hilangkan timestamp
penutupnya** ("Connected — last sync 30s ago") — justru ketiadaan info yang membuat
koneksi stale terlihat sehat karena kecelakaan.

### Table (dens, gaya Grafana)
Header: `--bg-panel-raised`, sticky, styling uppercase `--text-h3`. Baris: **tanpa
zebra striping** — pemisahan cukup divider baris 1px `--border-subtle`. Hover: panel
raise ringan (`--bg-panel-hover`), bukan highlight warna. Kolom teknis (IP, hash,
technique ID) pakai JetBrains Mono. Mendukung sort, filter, search, pagination, dan
row-expand untuk detail tanpa pindah halaman.

### Buttons
- Primary: fill Signal Red, teks putih — hanya untuk satu aksi paling konsekuensial
  per view.
- Secondary: transparan, border 1px `--border-strong`.
- Ghost/icon: tanpa border, `--text-secondary`, hover → `--bg-panel-hover`.
- Danger: outline Signal Red, fill solid saat hover.
- Radius 4–6px — sengaja lebih kecil dari tombol SaaS biasa, konsisten dengan radius panel.

### Drawers (menggantikan mayoritas modal)
Slide-in dari kanan, dipakai untuk: detail teknik ATT&CK, finding detail,
investigasi detection-gap, rule request, evidence viewer. Drawer mempertahankan
konteks dashboard di belakangnya — operator tidak pernah kehilangan posisi di canvas.
True modal hanya untuk konfirmasi pendek (mis. "Delete this finding?").

### Charts — aturan global
Garis tipis, gridline minimal, canvas gelap, legend/label compact, tooltip + crosshair
saat hover, threshold line dan annotation di tempat relevan (mis. garis target
coverage deteksi). **Dilarang:** 3D, gradient berat, efek glow/neon, jenis chart
dekoratif yang mengorbankan legibility demi penampilan.

### Sparklines
Garis kecil bernada sub-toned di dalam stat panel — detail pendukung, bukan elemen
utama panel.

---

## 6. Halaman

Setiap halaman mempertahankan scope/fungsinya; mental model berubah dari
cards-in-a-stack menjadi panels-on-a-dashboard-canvas.

### 6.1 Dashboard (Overview)

**Baris 1 — Stat panels** (4, masing-masing sparkline + trend):
`Active Engagements` · `Open Critical Findings` (angka Signal Red) ·
`Detection Coverage` (angka Teal, mini time-series) · `Detection Gaps`
(Signal Red atau Amber sesuai campuran severity).

**Baris 2 — Analytics** (dua panel berdampingan):
- *Detection Coverage Over Time* — time-series gaya Grafana: x=waktu, y=%, garis Teal,
  threshold line target coverage, annotation Signal Red saat gap ditemukan,
  crosshair + tooltip on hover.
- *Severity Distribution* — donut atau horizontal stacked bar, mapping warna severity.

**Baris 3 — ATT&CK Coverage** (panel full-width): teaser heatmap mini menuju halaman
ATT&CK Matrix penuh.

**Baris 4 — State Timeline** (aktivitas terakhir, event rows dens):
```
09:31:44  T1003   APP-02   Credential Access   NOT DETECTED
09:18:02  T1059   WEB-01   PowerShell           DETECTED
08:52:17  T1046   EDGE-01  Network Discovery   PARTIAL
```
Warna baris mengikuti verdict; klik baris membuka drawer timeline-entry terkait.

**Baris 5 — Integration Health** (tiga compact status panels): Vanguard → Sentinel,
Sentinel → Wazuh (read-only, informasional — memperkuat fakta tidak ada jalur langsung),
AI Provider (`Model: DeepSeek V4 Pro/Flash`). Semua memakai compact status indicator,
timestamp last-sync/last-push selalu terlihat.

*Empty state:* belum ada engagement → Baris 1–4 collapse jadi satu panel tengah:
"No engagement data yet — create your first engagement to populate this dashboard,"
dengan primary button. *Loading state:* skeleton panels, grid sama, tanpa spinner
overlay. *Error state (mis. Sentinel unreachable):* panel Sentinel di Baris 5 tunjukkan
status Signal Red inline; baris lain tetap bekerja dengan data lokal — satu integrasi
gagal tidak pernah mem-blank seluruh dashboard.

### 6.2 Engagements — List
Tabel dens: Nama (mono ID + bold name), Type, Status badge, Phase (mini rail),
Open Findings (chips jumlah berwarna severity), Start/End date, Owner. Filter bar di
atas (status, type, rentang tanggal) memakai control filter compact yang sama dengan
toolbar ATT&CK Matrix (6.5) demi konsistensi. Tombol primary "New Engagement" kanan atas.

### 6.3 Engagement Detail
Header panel: `ENG-026 — Acme External Assessment`, status, compact phase-tracker rail,
coverage %, indikator risiko, jumlah open findings — semuanya inline stat chips, bukan
paragraf teks.
Tabs: **Overview | Assets | Findings | Attack Path | Timeline | Purple Team Sync |
Report** — isi tiap tab tersusun dari panel. Tab Attack Path memakai node graph:
node rounded rectangle (`--bg-surface-raised`, border `--border-strong`), garis koneksi
`--border-strong`, border node flash `--accent-signal` jika langkah itu Not Detected —
pembacaan tercepat "di mana kami lolos".

### 6.4 Findings Page
Menjadi investigation dashboard penuh:
- Panels: *Critical Findings* (stat) · *Severity Distribution* (donut/bar) ·
  *CVSS Distribution* (histogram) · *Findings Over Time* (time-series) ·
  *Top Affected Assets* (ranked bar list)
- Di bawah: dense findings table (spec tabel §5), filterable by severity/status/asset.
- Row click → Finding Detail drawer (bukan navigasi full-page): title, severity badge,
  status, CVSS chip, description, affected assets, reproduction steps, evidence
  thumbnails, remediation fields, retest history.

### 6.5 ATT&CK Matrix (Purple Team View)
Layout analitik full-screen, tiga zona:
- **Top toolbar:** engagement selector, time range, verdict filter
  (Detected/Not Detected/Partial/Untested), technique search.
- **Main:** heatmap tactic-by-technique. Fill tile = warna verdict (Detected=Teal,
  Partial=Amber, Not Detected=Signal Red, Untested=Gray). Tile 64×48px, hover menampilkan
  nama/ID teknik, engagement, last tested, verdict, occurrence count. Click membuka
  technique detail drawer di kanan.
- **Bottom:** panel *Detection Gap Analytics* — jumlah gap, frekuensi gap, teknik
  paling sering sukses-tak-terdeteksi, asset/engagement terkait, dan dense Detection Gap
  table (kolom: Technique, Asset, Engagement, Verdict, Attempts, Last Tested, SOC Match,
  Rule Request) dengan sort/filter/search/pagination dan row action "Send to Sentinel
  backlog".
- Panel read-only sekunder **"Long-term Coverage (DeTT&CT)"** tetap di bawah gap table —
  snapshot dari scheduled external job, `Last updated: [timestamp]` selalu terlihat,
  secara visual berbeda dari panel live di atasnya.
- **Rule request drawer**, field dan footer status-tracker sama seperti sebelumnya,
  dibuka dari action baris gap.

### 6.6 Timeline Page
State Timeline visualization gaya Grafana: sumbu waktu horizontal, baris
teknik/asset, segmen state berwarna per verdict, marker korelasi SOC, marker evidence
sebagai ikon kecil di segmen terkait. Filter by technique/asset/engagement di pola
toolbar yang sama dengan 6.5.

### 6.7 Knowledge Base (Second Brain)
Struktur three-pane: kiri = note tree/search/tag filter; tengah = markdown editor
(atau toggle graph view); kanan = toggle Backlinks / AI Ask. Difrasiskan sebagai
**"Grafana Explore" bertemu Obsidian** — graph view berperilaku seperti data view
Explore-style: node clickable, filterable by type, zoomable. Panel AI Ask mempertahankan
label `Model: <nama model>` dalam `--text-muted`.

### 6.8 Reports (library)
Hybrid dashboard/library compact: tiap report adalah panel kecil berisi engagement,
version, template, status, generated date, dengan actions export/history — lebih dens
daripada card-grid.

### 6.9 Settings
Layout gaya administration Grafana: mini-nav kiri (Account & Security, Notifications,
Sentinel Integration, AI Provider, Data Retention, Audit Log, Users & Roles),
configuration panels di kanan. Sub-page **Sentinel Integration** mempertahankan diagram
arsitektur — Vanguard → Sentinel → Wazuh, kartu Sentinel→Wazuh selalu read-only —
dirender sebagai status panel row (bahasa visual Baris 5 di 6.1) dengan compact status
indicator per connection, credential fields, dan webhook toggle alert-match fungsinya
tetap.

---

## 7. Aksesibilitas & Responsivitas

- Semua makna warna semantik dipasangi teks, ikon, dan/atau shape — tidak pernah
  warna saja.
- Minimum contrast ratio 4.5:1 untuk semua pasangan token di atas.
- Focus outline: 2px `--accent-blue` pada setiap elemen interaktif; drawer trap focus
  dan close on Esc.
- Hormati `prefers-reduced-motion`: matikan animasi hover heatmap/graph dan transisi
  panel-expand, sisakan opacity fade saja.
- **Responsive grid:** 12 kolom desktop → 8 kolom tablet → 1 kolom mobile. Sidebar:
  240px desktop → icon-only 64px tablet → overlay nav compact mobile. Table collapse
  jadi stacked information rows di bawah 768px. Heatmap ATT&CK scroll horizontal,
  tidak reflow — memampatkan kolom teknik merusak legibility.

---

## 8. Catatan Implementasi Next.js (non-normatif)

- Token §2–§4 → CSS custom properties global + mapping Tailwind theme (`colors`,
  `fontFamily`, `radius`, `spacing`). Komponen §5 → React primitives di
  `components/ui/*`, tanpa library komponen besar; chart via Recharts (default tema:
  garis tipis, gridline minimal, warna dari token).
- Ikon: Lucide React (outline 18px) — konsisten dengan spesifikasi sidebar.
- Font: Inter Tight / Inter / JetBrains Mono via `next/font/google` (self-host otomatis).
