# Design System — Red Team Dashboard

## 0. Design Concept

**Implementation note:** Vanguard is built as a fork of Ghostwriter (SpecterOps, Django/Python) rather than from scratch — see PRD.md section 1.1 for the build strategy. Everything below is the **target design system** the fork gets restyled into: Ghostwriter's default Django-admin-adjacent look is fully replaced by these tokens and components. Pages/fields inherited from Ghostwriter (Engagement, Findings, Evidence, Reporting) still follow this system; only Purple Team Sync, the ATT&CK Matrix, and the Rule Request tracker are net-new UI with no equivalent in the upstream project.

**Signature idea:** a field operator's console, not a corporate SaaS panel. The SOC dashboard already owns "monitoring calm" — blue, steady, watching. The Red Team Dashboard should feel like the opposite half of the same organization: **planning and pressure**. Dark graphite surface (not pure black — pure black + one neon accent is the generic "hacker dashboard" default), a single signal-red accent used sparingly for anything that represents *active offensive state*, and a muted amber/teal pair reserved strictly for detection verdicts (Detected / Not Detected) so that color always encodes meaning, never decoration.

Structural device: engagements are tracked like **operations with phases** (Recon → Exploitation → Post-Ex → Reporting), so a thin phase-tracker rail appears wherever an engagement is shown — this is a real sequence, so numbering/phase markers are earned here, unlike a generic "01/02/03" decoration.

---

## 1. Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#14161A` | App background — graphite, not pure black |
| `--bg-surface` | `#1C1F25` | Cards, panels, sidebar |
| `--bg-surface-raised` | `#242830` | Modals, dropdowns, hover surfaces |
| `--border-subtle` | `#31353E` | Default borders/dividers |
| `--border-strong` | `#454A56` | Input borders, active dividers |
| `--text-primary` | `#EDEFF3` | Headings, primary content |
| `--text-secondary` | `#9CA2AF` | Body copy, labels |
| `--text-muted` | `#6B7280` | Timestamps, placeholder, disabled |
| `--accent-signal` | `#E5484D` | Primary accent — active engagement, critical severity, "not detected" |
| `--accent-signal-dim` | `#3A1F21` | Signal accent background tint (badges) |
| `--accent-amber` | `#E8A23D` | Warnings, medium severity, "partially detected" |
| `--accent-amber-dim` | `#3A2E1A` | Amber background tint |
| `--accent-teal` | `#3DBFA8` | Success, "detected", fixed findings |
| `--accent-teal-dim` | `#1A3330` | Teal background tint |
| `--accent-violet` | `#8B7FE8` | Informational, ATT&CK technique tags, links |

Severity color mapping (used consistently across findings, heatmap, charts):
- Critical → `--accent-signal` (#E5484D)
- High → `#E8654D` (warm red-orange, blended signal/amber)
- Medium → `--accent-amber` (#E8A23D)
- Low → `#D9C24A` (muted yellow)
- Info → `--text-muted` (#6B7280)

Detection verdict mapping (Purple Team Sync):
- Detected → `--accent-teal`
- Detected but not escalated → `--accent-amber`
- Not Detected → `--accent-signal`
- Untested → `--border-strong` (neutral gray, not yet meaningful)

---

## 2. Typography

| Role | Typeface | Notes |
|---|---|---|
| Display / page headers | **Inter Tight** (or "IBM Plex Sans Condensed" as fallback), weight 650 | Condensed, tight tracking gives the "console" tension without going full stencil |
| Body / UI text | **Inter**, weight 400/500 | Standard, legible at small sizes |
| Technical / data (IPs, hashes, commands, timestamps) | **JetBrains Mono**, weight 400/500 | Used in tables for anything literal — hostnames, CVEs, technique IDs |

Type scale:

| Token | Size / Line-height | Weight | Use |
|---|---|---|---|
| `--text-h1` | 28px / 34px | 650 | Page titles |
| `--text-h2` | 20px / 26px | 600 | Section headers, card titles |
| `--text-h3` | 15px / 20px | 600 | Sub-section labels, table headers (uppercase, +0.04em tracking) |
| `--text-body` | 14px / 20px | 400 | Default body |
| `--text-small` | 12.5px / 18px | 400 | Meta text, timestamps |
| `--text-mono` | 13px / 20px | 400/500 | Technical/data fields |

Table headers use `--text-h3` in uppercase with `--text-muted` color and `0.04em` letter-spacing — this is the one place all-caps is used, kept consistent everywhere.

---

## 3. Layout, Spacing & Shape Tokens

- Base spacing unit: **4px**. Standard gaps: 8 / 12 / 16 / 24 / 32px.
- Border radius: `--radius-sm: 4px` (badges, inputs), `--radius-md: 8px` (cards), `--radius-lg: 12px` (modals).
- Shadows are minimal (dark UI) — one soft elevation shadow: `0 4px 16px rgba(0,0,0,0.4)` for modals/dropdowns only. Cards use border, not shadow, for separation.
- Grid: 12-column, max content width 1440px, sidebar fixed 240px (collapsible to 64px icon rail).
- Focus states: 2px `--accent-violet` outline, visible on all interactive elements (keyboard accessibility, non-negotiable).

---

## 4. Core Components

**Top nav bar** — 56px height, `--bg-surface`, bottom border `--border-subtle`. Left: product mark + "RED TEAM" label chip. Right: active engagement switcher dropdown, notification bell, operator avatar/menu.

**Sidebar** — 240px, `--bg-surface`. Sections: Dashboard, Engagements, Assets, Findings, ATT&CK Matrix, Knowledge Base, Reports, Tasks, Settings. Active item: left 3px `--accent-signal` bar + `--bg-surface-raised` background. Icons: outline style (Lucide), 18px.

**Phase tracker rail** — horizontal stepper shown at the top of any engagement view: `Recon → Exploitation → Post-Exploitation → Reporting`, each phase a pill; current phase filled `--accent-signal`, completed phases `--accent-teal` outline, upcoming phases `--text-muted` outline.

**Card** — `--bg-surface`, 1px `--border-subtle`, `--radius-md`, 16–20px padding. Card header: `--text-h2` + optional right-aligned action button.

**Status / severity badge (pill)** — `--radius-sm`, 4px/10px padding, `--text-small` weight 600, background = severity-dim token, text = severity solid token. e.g. Critical badge: bg `--accent-signal-dim`, text `--accent-signal`.

**Detection verdict chip** — same pill shape, uses the detection-verdict color mapping, always paired with a small icon (check / x / clock / dash for untested).

**Connection status chip** — 8px colored dot + label, used for API/integration health (Sentinel Integration settings, 5.10). Connected = `--accent-teal` dot + "Connected — last sync Xm ago" in `--text-secondary`; Degraded = `--accent-amber` dot; Disconnected/Error = `--accent-signal` dot + retry action link. Never removes the last-sync timestamp — silence is what makes a stale connection look healthy by accident.

**Rule request status tracker** — used wherever a Detection Gap turns into a Wazuh rule change (6.5 write-path). A horizontal 5-step pill sequence: `Draft → Pending review → Approved → Deployed → Verified`, plus a `Rejected` terminal state that branches off after any step. Current step filled `--accent-amber` (still in motion, human action needed), completed steps `--accent-teal` outline, `Rejected` uses `--accent-signal`. Unlike the phase tracker rail (4), this one is never fully under the operator's control — steps past "Pending review" require an action taken inside Sentinel, so the tracker always shows a small note under the current step: who owns the next action ("Waiting on Sentinel admin approval" vs "Waiting on you — run retest").

**Data table** — row height 44px, header row `--bg-surface-raised` sticky, zebra rows off (rely on 1px `--border-subtle` row dividers), hover row background `--bg-surface-raised`. Monospace font for IP/hash/technique-ID columns, Inter for everything else. Sortable column headers show a small chevron on hover.

**Kanban card** — `--bg-surface`, `--radius-md`, left 3px color bar = task-type color, drag handle on hover, title `--text-body` weight 500, meta row (assignee avatar, due date) in `--text-small`.

**Modal** — `--bg-surface-raised`, `--radius-lg`, elevation shadow, max-width 560px (forms) or 900px (evidence viewer). Header with title + close (X), footer right-aligned action buttons.

**Buttons**
- Primary: `--accent-signal` bg, white text, `--radius-sm`, used for the single most important action per view (e.g. "New Finding", "Generate Report").
- Secondary: transparent bg, 1px `--border-strong`, `--text-primary` text.
- Destructive: 1px `--accent-signal` border, `--accent-signal` text, transparent bg — fills solid on hover.
- Ghost/icon buttons: no border, `--text-secondary`, hover → `--bg-surface-raised`.

**Form inputs** — `--bg-base` fill, 1px `--border-subtle`, `--radius-sm`, focus → `--border-strong` + violet outline. Labels `--text-small` `--text-secondary` above field.

**ATT&CK heatmap tile** — 64x48px cells in a tactic-by-technique grid, fill color = detection-verdict mapping, border `--border-subtle`, hover shows tooltip (technique name/ID, engagement, timestamp, verdict).

**Timeline entry** — vertical line (`--border-subtle`) with node dot colored by outcome (success=teal, failed=muted, alert-triggered=signal), entry card to the right: timestamp (mono, muted) → technique tag (violet pill) → action description → optional evidence thumbnail.

**Attack path node graph** — rounded rectangle nodes (`--bg-surface-raised`, 1px `--border-strong`), connecting lines `--border-strong`, node border flashes `--accent-signal` if that step was Not Detected — this is the fastest visual read of "where did we get away with it."

**Charts** — severity distribution: horizontal stacked bar using severity colors. Coverage over time: line chart, `--accent-teal` line on `--bg-surface` background, grid lines `--border-subtle` at 20% opacity.

**Empty states** — icon (outline, `--text-muted`) + one-line direct instruction in the interface's voice, e.g. "No findings yet. Log one from a scan import or add manually." + primary button.

---

## 5. Pages

### 5.1 Login
```
┌─────────────────────────────────────┐
│              [ logo mark ]           │
│         RED TEAM DASHBOARD           │
│                                       │
│   [ email/username input        ]    │
│   [ password input              ]    │
│   [ MFA code input              ]    │
│                                       │
│   [        Sign in (primary)    ]    │
└─────────────────────────────────────┘
```
Centered card, 400px wide, `--bg-surface` on `--bg-base`. No decoration — this is a utility screen, restraint intentional.

### 5.2 Dashboard (Overview)
```
┌ Topnav ───────────────────────────────────────────────┐
├ Sidebar │ Page: "Overview"                             │
│         │ ┌───────────┐┌───────────┐┌───────────┐      │
│         │ │Active Eng.││Open Crit. ││Detection  │      │
│         │ │   3       ││Findings   ││Coverage   │      │
│         │ │           ││   7       ││  62%      │      │
│         │ └───────────┘└───────────┘└───────────┘      │
│         │ ┌─────────────────────┐┌───────────────┐     │
│         │ │ Severity Distribution││ Recent Timeline│     │
│         │ │ (stacked bar chart)  ││ (last 6 entries)│    │
│         │ └─────────────────────┘└───────────────┘     │
│         │ ┌───────────────────────────────────────┐    │
│         │ │ ATT&CK Coverage Heatmap (mini, full-width)│  │
│         │ └───────────────────────────────────────┘    │
└─────────┴───────────────────────────────────────────────┘
```
Four stat cards top row (Active Engagements, Open Critical Findings, Detection Coverage %, Detection Gaps needing SOC follow-up). Two-column row: severity chart + recent activity feed. Full-width mini ATT&CK heatmap teaser linking to the full matrix page.

### 5.3 Engagements — List
Table view with columns: Name (mono for internal ID + bold name), Type, Status (badge), Phase (mini phase-rail), Open Findings (severity-colored count chips), Start/End date, Owner. Top-right "New Engagement" primary button. Filter bar above table: status, type, date range.

### 5.4 Engagement Detail
Tabbed page. Header block: engagement name, status badge, phase tracker rail, scope summary line, edit/close-engagement actions.
Tabs: **Overview | Assets | Findings | Attack Path | Timeline | Purple Team Sync | Report**

- *Overview tab* `(Ghostwriter, restyled)`: objectives list, scope (in/out), rules of engagement, progress stats.
- *Assets tab* `(Ghostwriter, restyled)`: asset table (5.2 in PRD) + "Import" button (Nmap/Amass upload) + network map toggle view.
- *Findings tab* `(Ghostwriter, restyled)`: findings table, filter by severity/status, "New Finding" + "Bulk Import" buttons, severity distribution mini-chart pinned top-right.
- *Attack Path tab* `(native, new)`: node graph builder (drag to arrange, or auto-laid-out from timeline order).
- *Timeline tab* `(Ghostwriter activity log, extended)`: vertical timeline component, filter by technique/asset, "Add Entry" button.
- *Purple Team Sync tab* `(native, new — highest-effort tab, no upstream equivalent)`: side-by-side list — left: red team timeline entries; right: matched SOC alert (or "No match found — mark as Not Detected"); confirm/reject match action per row; summary banner "Detection Coverage: 62% (18/29 actions detected)".
- *Report tab* `(Ghostwriter Jinja2 engine, restyled)`: report builder — checklist of sections to include, template picker (Executive/Technical), live preview pane, "Generate PDF/DOCX" buttons, version history list.

### 5.5 Finding Detail (modal or full page)
Header: title, severity badge, status dropdown, CVSS score chip. Body sections: Description, Affected Assets (chips), Reproduction Steps (numbered list), Evidence (thumbnail grid, click to lightbox), Remediation (recommendation + owner + due date), Retest history log. Right rail: metadata (discovered date, discoverer, CVE/CWE, related ATT&CK techniques as violet pills).

### 5.6 ATT&CK Matrix (Purple Team View) `(native — verdict logic reimplemented in-house, no VECTR code; long-term coverage panel below fed by DeTT&CT's output file, DeTT&CT itself runs externally and is not embedded)`
Full tactic-by-technique grid (heatmap component from 4). Top filter bar: engagement selector (or "All time"), verdict filter toggle (Detected/Not Detected/Untested). Click a tile → side panel slides in: technique name/ID/description, list of engagements/timeline entries that used it, verdict per instance. Below the grid: "Detection Gap Report" card listing all Not-Detected techniques sorted by how many times they succeeded, each row with a "Send to Sentinel backlog" button.

A secondary panel, **"Long-term Coverage (DeTT&CT)"**, sits below the Detection Gap Report — a read-only table imported from the latest scheduled DeTT&CT run (data-source visibility, technique coverage vs. threat-group TTPs). It carries a small `Last updated: [timestamp from the job]` label so it's visually distinct from the live, in-app Purple Team data above it — this table is a snapshot, not a live query.

**Rule request drawer** — opens when a gap row's action is taken. Fields: technique summary (read-only, pulled from the gap), draft rule/decoder text area (monospace), test log sample upload, justification text field. Footer shows the **Rule request status tracker** component (4) once submitted — this is where the operator watches a request move from Draft through Sentinel's approval to Deployed and Verified without leaving Vanguard.

### 5.7 Asset Inventory (global, cross-engagement)
Table: asset, criticality (pulled from SOC if linked), engagements it has appeared in, current status tag, last tested date. Search/filter by criticality, business unit, status. Row click → asset detail panel: history across engagements, all findings tied to it, all timeline actions against it.

### 5.8 Reports (library)
Card grid of generated reports (thumbnail = first page render), each card: engagement name, template type, version, generated date, download/export buttons.

### 5.9 Knowledge Base (Second Brain) `(native — no Ghostwriter equivalent)`
Two-pane layout: left sidebar = note tree/search + tag filter; center = markdown editor with live `[[link]]` autocomplete; right rail toggles between **Backlinks** (notes referencing this one) and **AI Ask** (chat box grounded in the vault via RAG — answers cite source notes as clickable chips). Top toolbar: New Note, Template picker, Graph View toggle (swaps center pane for the node-link graph — nodes colored by type: note=violet, finding=severity color, asset=teal). AI Ask panel shows a small `Model: DeepSeek V4 Pro/Flash` label in `--text-muted` — visible so the operator always knows which model is answering, matters once cost/data-residency policy is finalized.

### 5.10 Tasks (Kanban)
Four columns (To Do / In Progress / Blocked / Done), cards per 4's Kanban card spec. Column headers show count badge. Filter by engagement.

### 5.11 Settings
Sections in left mini-nav within the page: Account & MFA, Notifications (Telegram/Slack/email toggles), **Sentinel Integration**, **AI Provider** (Knowledge Base model config — DeepSeek V4 Pro/Flash, key status, usage), Data Retention (artifact auto-purge rules), Audit Log (searchable table), Users & Roles (Phase 2).

**Sentinel Integration sub-page** — this is the one page that visualizes the three-app architecture, so the operator can see at a glance whether the chain is healthy end to end.

```
┌ Sentinel Integration ─────────────────────────────────────────┐
│                                                                 │
│  [Red Team Dashboard] ──●API key──> [Sentinel] ──●(read-only)──>│
│                                                    [Wazuh]      │
│      ● Connected                    ● Connected                │
│      Last push: 2 min ago           Last sync: 30s ago         │
│                                                                 │
│  ┌─ Connection: Red Team → Sentinel ────────────────────────┐  │
│  │ API base URL      [ https://sentinel.internal/api/v1  ]  │  │
│  │ API key            [ ••••••••••••••1a2b ]  [Rotate]      │  │
│  │ Status              ● Connected — last push 2 min ago     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─ Connection: Sentinel → Wazuh (read-only, informational) ┐  │
│  │ Managed by Sentinel — shown here for visibility only.    │  │
│  │ Status              ● Connected — last sync 30s ago       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Webhook: alert-match notifications        [ Enabled  ⚙ ]     │
└─────────────────────────────────────────────────────────────┘
```

Each connection card uses the **Connection status chip** component (4): green dot + `--accent-teal` text for Connected, `--accent-signal` dot for Disconnected/Error, `--accent-amber` dot for Degraded (e.g. high latency, retry backoff active). The Sentinel→Wazuh card is always read-only here — reinforces that Red Team Dashboard has no direct path to Wazuh, it can only observe that hop's health via what Sentinel reports.

---

## 6. Accessibility & Responsiveness

- All color-coded meaning (severity, verdict) is paired with text/icon, never color alone.
- Minimum contrast ratio 4.5:1 for body text against its background at all token pairings above.
- Sidebar collapses to icon-only rail below 1024px; tables switch to stacked card rows below 768px.
- Full keyboard navigation: visible focus ring (`--accent-violet`, 2px) on every interactive element; modals trap focus and close on Esc.
- Respect `prefers-reduced-motion`: disable node-graph and heatmap hover animations, keep only opacity fades.
