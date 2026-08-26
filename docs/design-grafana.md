# Design System — Vanguard (Obsidian Red Team Console)

**Implementation note:** Vanguard is built as a fork of Ghostwriter (SpecterOps, Django/Python) — see PRD.md section 1.1. This document supersedes `design.md`'s visual language while preserving every page, feature, and workflow it defined (Engagement Management, Findings, ATT&CK Mapping, Timeline, Purple Team Sync, Rule Request workflow, Knowledge Base, Sentinel/Wazuh integration, Reports, Tasks, Settings). Nothing in the product scope changes here — this is a visual and UX-architecture transformation only.

**Formula:** Grafana's dashboard/panel density + observability data patterns + Red Team offensive semantics + a dark obsidian foundation + Signal Red as the operational accent (not Grafana's orange). The result should read as **"Grafana built specifically for Red Team operations"** with its own identity, not a Grafana reskin.

**What the operator should be able to answer at a glance:** what's active, what's dangerous right now, what was exploited, what the SOC detected, where the detection gaps are, which ATT&CK techniques are uncovered, what needs action next, and whether Sentinel/Wazuh are healthy.

---

## 1. Design Concept

The old design.md leaned on card-based SaaS layout. This version replaces that mentality entirely with **panels** — Grafana's core unit: dense, bordered, minimal-chrome blocks that show data first and decoration never. Every page becomes a dashboard of panels rather than a stack of cards.

Three things stay non-negotiable from the original design, carried forward unchanged: (1) the phase-tracker rail concept for engagements, (2) color as strict semantic encoding — never decorative, always paired with text/icon, and (3) the dark graphite/obsidian foundation, never pure black.

What's new: information density goes up, chrome goes down, and every data-bearing panel gets the toolbar/hover/expand affordances of an observability tool — because that's what this product actually is now: an instrument for reading operational state, not a form-filling app.

---

## 2. Color Palette

### Background

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#0B0D10` | Outermost app background |
| `--bg-canvas` | `#0F1217` | Dashboard canvas (behind panels) |
| `--bg-panel` | `#11151A` | Default panel surface |
| `--bg-panel-raised` | `#181D24` | Panel headers, modals, dropdowns |
| `--bg-panel-hover` | `#1D232C` | Row/panel hover state |
| `--bg-panel-active` | `#202832` | Pressed/active state |

Never pure black (`#000000`) as a primary surface — this is graphite/obsidian, not void.

### Borders

| Token | Hex | Usage |
|---|---|---|
| `--border-subtle` | `#27303A` | Default panel/divider borders |
| `--border-default` | `#303A46` | Table dividers, input borders |
| `--border-strong` | `#3D4856` | Active/focused dividers |

Borders stay quiet everywhere. No bright borders as a default state.

### Typography colors

| Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#E6EAF0` | Headings, primary content |
| `--text-secondary` | `#9AA4B2` | Body copy, labels |
| `--text-muted` | `#66707E` | Timestamps, placeholders |
| `--text-disabled` | `#454D58` | Disabled state |

### Semantic accents

Every accent below has one job: encode a specific operational meaning. None is used decoratively, and none is the default color of anything by default — surfaces stay neutral until something needs to be surfaced.

**Signal Red** — `--accent-signal #E5484D` / `--accent-signal-dim #351A1D`
Critical findings, active offensive state, exploitation, attack activity, detection gaps, "Not Detected," failed controls, primary destructive action. Meaning: *something important requires attention.* Not a decoration for every Red Team element — used sparingly, so it stays meaningful when it does appear.

**Teal** — `--accent-teal #35B7A0` / `--accent-teal-dim #16332F`
Detected, verified, fixed, mitigated, healthy, connected, successful, completed. Meaning: *the control worked, the state is healthy.*

**Amber** — `--accent-amber #D9A441` / `--accent-amber-dim #352B18`
Warning, partial detection, pending, degraded, retest required, medium severity, human action required. Meaning: *needs investigation or action.* Not a default UI accent — semantic only.

**Steel Blue** — `--accent-blue #5B8DEF` / `--accent-blue-dim #18253D`
Informational content, analytics, metadata, navigation links, neutral data visualization. Stays secondary to Signal Red — this product's identity is red, not blue.

**ATT&CK Violet** — `--accent-violet #8B7FE8` / `--accent-violet-dim #24203D`
Reserved specifically for MITRE ATT&CK: technique IDs, tactics, taxonomy, technical classification. Not a generic brand accent — if it shows up, it means "this is ATT&CK-related," nothing else.

**Gray** (uses `--text-muted` / `--border-strong`)
Untested, disabled, unknown, inactive, historical, neutral.

### Severity mapping (unchanged concept from design.md, restated for this palette)
Critical → Signal Red · High → warm red-orange blend `#E8654D` · Medium → Amber · Low → muted yellow `#D9C24A` · Info → `--text-muted`

### Detection verdict mapping
Detected → Teal · Detected, not escalated / Partial → Amber · Not Detected → Signal Red · Untested → Gray (`--border-strong`)

### Color ratio discipline
Roughly **90% neutral dark surface/text, 10% semantic color**. This must not read as a neon security interface — large areas stay dark; accents exist only to direct attention to what actually needs it.

---

## 3. Typography

| Role | Typeface | Weight |
|---|---|---|
| Display / page & panel titles | **Inter Tight** | 600–700 |
| UI / body | **Inter** | 400–600 |
| Technical data | **JetBrains Mono** | 400–500 |

JetBrains Mono is mandatory for: IP addresses, hostnames, CVEs, CWEs, ATT&CK technique IDs, hashes, commands, timestamps, API endpoints, rule IDs — anything literal/technical, everywhere it appears (tables, drawers, panel content).

### Type scale

| Token | Size | Use |
|---|---|---|
| `--text-h1` | 28–30px | Page titles |
| `--text-h2` | 20–22px | Panel titles |
| `--text-h3` | 15–16px | Sub-labels, table headers (uppercase, `--text-muted`, +0.04em tracking) |
| `--text-body` | 14px | Default body |
| `--text-small` | 12px | Meta text, timestamps |
| `--text-mono` | 12–13px | Technical/data fields |

No oversized display type anywhere — density is the priority over hero typography.

---

## 4. Layout, Spacing & Shape Tokens

- Base spacing unit: **4px**; standard gaps 8/12/16/24/32px.
- Radius: `--radius-sm: 4px` (badges, buttons, inputs), `--radius-md: 6–8px` (panels), `--radius-lg: 10px` (drawers only — modals are avoided, see 5).
- No large shadows, no glassmorphism, no gradients. Panels separate via 1px border, not elevation.
- Grid: **12-column** desktop / 8-column tablet / single-column mobile. Max content width 1600px (wider than a typical SaaS max-width, because panel density needs the room).
- Sidebar: 240px expanded / 64px collapsed.
- Focus state: 2px `--accent-blue` outline (not Signal Red — red is reserved for danger/critical semantics, not focus rings) on every interactive element.

---

## 5. Core Components

### Application shell
```
┌─────────────────────────────────────────────────────────────┐
│ TOP NAVIGATION / TOOLBAR                                     │
├───────────┬─────────────────────────────────────────────────┤
│           │  DASHBOARD CANVAS                                │
│ SIDEBAR   │  ┌────────┐┌────────┐┌────────┐┌────────┐        │
│           │  │ PANEL  ││ PANEL  ││ PANEL  ││ PANEL  │        │
│           │  └────────┘└────────┘└────────┘└────────┘        │
│           │  ┌──────────────────────┐┌────────────────┐      │
│           │  │        CHART          ││      CHART      │      │
│           │  └──────────────────────┘└────────────────┘      │
│           │  ┌───────────────────────────────────────────┐  │
│           │  │            ATT&CK HEATMAP                  │  │
│           │  └───────────────────────────────────────────┘  │
└───────────┴─────────────────────────────────────────────────┘
```

### Top navigation `(replaces design.md's top nav bar)`
56px, `--bg-panel-raised`, bottom border `--border-subtle`. Deliberately not visually dominant — it's a toolbar, not a hero bar.
- Left: Vanguard mark, product name, workspace label.
- Center/right: engagement selector, global search, **time-range control** (Grafana-style: "Last 24h / 7d / 30d / Custom" — applies to every time-series panel on the current page), refresh button, notification bell, operator avatar.

### Sidebar `(same information architecture as design.md, restyled)`
240px / 64px collapsed, `--bg-panel`. Items: Dashboard, Engagements, Assets, Findings, ATT&CK Matrix, Timeline, Knowledge Base, Reports, Tasks, Settings. Lucide icons, 18px, outline style. Active item: **left 3px Signal Red bar + raised background + primary text** — never a red-filled background block, the indicator is a line, not a fill.

### Phase tracker rail `(same concept as design.md, restyled as a compact dashboard progress component)`
`Recon → Exploitation → Post-Exploitation → Reporting`. Completed = Teal outline, current = Signal Red fill, upcoming = Gray outline. Rendered compact and inline with the engagement header, not as a large standalone stepper.

### Panel `(replaces "Card" entirely — the core UI primitive)`
```
--bg-panel, 1px solid --border-subtle, radius 6–8px, 16px padding/gap
```
No shadows, no glassmorphism, no gradients.

**Panel header:**
```
┌─────────────────────────────────────────────┐
│ PANEL TITLE                         ⋮  ↗  ⟳ │
├─────────────────────────────────────────────┤
│                 CONTENT                      │
└─────────────────────────────────────────────┘
```
Title (h2) + optional description, with a toolbar (more-actions menu, expand-to-fullscreen, refresh) that appears on hover where the panel is data-driven (charts, tables, heatmaps) — static content panels (e.g. scope text) don't need it.

### Stat panel
Large numeral (h1-scale, mono for the number itself), label above, small sparkline beneath, optional trend delta vs. previous period. Color of the numeral follows the semantic mapping for what it represents (e.g. Open Critical Findings numeral in Signal Red).

### Status / severity badge
`--radius-sm`, 4/10px padding, `--text-small` weight 600. Background = dim token, text = solid token of the same accent (unchanged concept from design.md).

### Detection verdict chip
Same pill shape as the badge, paired with a small icon (check / x / clock / dash), using the verdict color mapping.

### Compact status indicator `(replaces "Connection status chip" — less badge, more inline telemetry)`
```
● CONNECTED     ● DETECTED     ● NOT DETECTED     ● DEGRADED     ● UNTESTED
```
8px dot + label, `--text-small`, no pill background — this sits directly on the panel surface like a log line, not a decorative badge. Teal = healthy, Amber = degraded, Signal Red = disconnected/critical, Gray = untested/inactive. **Never omit the trailing timestamp** ("Connected — last sync 30s ago") — silence is what makes a stale connection look healthy by accident.

### Table `(dense, Grafana-style — replaces the plainer table spec in design.md)`
Header: `--bg-panel-raised`, sticky, uppercase `--text-h3` styling. Rows: **no zebra striping** — separation via 1px `--border-subtle` row dividers only. Hover: slight panel-raise (`--bg-panel-hover`), not a color highlight. Technical columns (IP, hash, technique ID) in JetBrains Mono. Supports sort, filter, search, pagination, and row-expand for detail without navigating away.

### Buttons
- Primary: Signal Red fill, white text — reserved for the single most consequential action per view.
- Secondary: transparent, 1px `--border-strong`.
- Ghost/icon: no border, `--text-secondary`, hover → `--bg-panel-hover`.
- Danger: Signal Red outline, fills solid on hover.
- Radius 4–6px — deliberately smaller than a typical SaaS button, consistent with the panel radius.

### Drawers `(replace most modals from design.md)`
Slide-in from the right, used for: ATT&CK technique detail, finding detail, detection-gap investigation, rule request, evidence viewer. Drawers preserve dashboard context behind them — the operator never loses their place on the canvas. Reserve true modal dialogs only for short confirmations (e.g. "Delete this finding?").

### Charts — global rules
Thin lines, minimal gridlines, dark canvas, compact legends/labels, tooltip + crosshair on hover, threshold lines and annotations where relevant (e.g. a detection-coverage target line). **Never:** 3D, heavy gradients, glow/neon effects, decorative chart types chosen for looks over legibility.

### Sparklines
Small, subton-toned line inside a stat panel — supporting detail, never the headline element of the panel.

---

## 6. Pages

Every page below keeps its original scope/functionality from design.md; only the layout mentality changes from cards-in-a-stack to panels-on-a-dashboard-canvas.

### 6.1 Dashboard (Overview)

**Row 1 — Stat panels** (4, each with sparkline + trend):
`Active Engagements` (3) · `Open Critical Findings` (7, Signal Red numeral) · `Detection Coverage` (62%, Teal numeral, mini time-series) · `Detection Gaps` (11, Signal Red or Amber depending on severity mix)

**Row 2 — Analytics** (two panels side by side):
- *Detection Coverage Over Time* — Grafana-style time-series: x=time, y=%, Teal line, threshold line for target coverage, Signal Red annotations marking when a gap was found, crosshair + tooltip on hover.
- *Severity Distribution* — donut or horizontal stacked bar, using the severity color mapping.

**Row 3 — ATT&CK Coverage** (full-width panel): mini heatmap teaser linking to the full ATT&CK Matrix page.

**Row 4 — State Timeline** (recent activity, dense event rows):
```
09:31:44  T1003   APP-02   Credential Access   NOT DETECTED
09:18:02  T1059   WEB-01   PowerShell           DETECTED
08:52:17  T1046   EDGE-01  Network Discovery   PARTIAL
```
Row color follows verdict mapping; clicking a row opens the relevant timeline-entry drawer.

**Row 5 — Integration Health** (three compact status panels): Vanguard → Sentinel, Sentinel → Wazuh (read-only, informational — reinforces there's no direct link), AI Provider (`Model: DeepSeek V4 Pro/Flash`). Each uses the compact status indicator, each keeps its last-sync/last-push timestamp visible always.

*Empty state:* if no engagements exist yet, Row 1–4 collapse into a single centered panel: "No engagement data yet — create your first engagement to populate this dashboard," with a primary button. *Loading state:* skeleton panels, same grid, no spinner overlay. *Error state (e.g. Sentinel unreachable):* Row 5's Sentinel panel shows Signal Red status inline; other rows keep working with locally-available data — one integration failing never blanks the whole dashboard.

### 6.2 Engagements — List
Dense table: Name (mono ID + bold name), Type, Status badge, Phase (mini rail), Open Findings (severity-colored count chips), Start/End date, Owner. Filter bar above (status, type, date range) using the same compact filter controls as the ATT&CK Matrix toolbar (6.5) for consistency. "New Engagement" primary button top-right.

### 6.3 Engagement Detail
Header panel: `ENG-026 — Acme External Assessment`, status, compact phase-tracker rail, coverage %, risk indicator, open-findings count — all as inline stat chips rather than a paragraph of text.
Tabs (unchanged from design.md): **Overview | Assets | Findings | Attack Path | Timeline | Purple Team Sync | Report** — every tab's content is now composed of panels instead of cards, per the same logic as the rest of the app. Each tab's origin tag (Ghostwriter-restyled vs. native) carries over unchanged from design.md section 5.4.

### 6.4 Findings Page
This page becomes a full investigation dashboard:
- Panels: *Critical Findings* (stat) · *Severity Distribution* (donut/bar) · *CVSS Distribution* (histogram) · *Findings Over Time* (time-series) · *Top Affected Assets* (ranked bar list)
- Below: the dense findings table (5's table spec), filterable by severity/status/asset.
- Row click → Finding Detail drawer (not a full-page nav): title, severity badge, status, CVSS chip, description, affected assets, reproduction steps, evidence thumbnails, remediation fields, retest history — same content as design.md's Finding Detail, now in a drawer instead of a modal/page.

### 6.5 ATT&CK Matrix (Purple Team View)
Full-screen analytical layout, three zones:
- **Top toolbar:** engagement selector, time range, verdict filter (Detected/Not Detected/Partial/Untested), technique search.
- **Main:** the tactic-by-technique heatmap. Tile fill = verdict color (Detected=Teal, Partial=Amber, Not Detected=Signal Red, Untested=Gray). Hover shows technique name/ID, engagement, last tested, verdict, occurrence count. Click opens the technique detail drawer on the right.
- **Bottom:** *Detection Gap Analytics* panel — gap count, gap frequency, most-successful-undetected techniques, related assets/engagements, and the dense Detection Gap table (columns: Technique, Asset, Engagement, Verdict, Attempts, Last Tested, SOC Match, Rule Request) with sort/filter/search/pagination and a "Send to Sentinel backlog" row action.
- Secondary read-only panel **"Long-term Coverage (DeTT&CT)"** stays below the gap table exactly as in design.md — snapshot data from the scheduled external job, `Last updated: [timestamp]` always visible, visually distinct from the live panels above it.
- **Rule request drawer**, same fields and status-tracker footer as design.md, opened from a gap row's action.

### 6.6 Timeline Page
Replaces the vertical timeline concept with a **Grafana-style State Timeline visualization**: horizontal time axis, technique/asset rows, colored state segments per verdict, SOC-correlation markers, evidence markers as small icons on the relevant segment. This is a genuine change from design.md's vertical timeline component — chosen because the same information (sequence + duration + verdict) reads faster as a horizontal state timeline than as a scrolling list, which matters once an engagement has hundreds of entries. Filter by technique/asset/engagement in the same toolbar pattern as 6.5.

### 6.7 Knowledge Base (Second Brain)
Same three-pane structure as design.md, restyled: left = note tree/search/tags, center = markdown editor (or graph-view toggle), right = Backlinks / AI Ask toggle. Framed here as **"Grafana Explore" crossed with Obsidian** — the graph view in particular behaves like an Explore-style data view rather than a decorative node map: nodes are clickable, filterable by type, and zoomable. AI Ask panel keeps the `Model: DeepSeek V4 Pro/Flash` label in `--text-muted`, unchanged from design.md.

### 6.8 Reports (library)
Compact dashboard/library hybrid rather than a pure card grid: each report is a small panel showing engagement, version, template, status, generated date, with export/history actions — denser than the original card-grid spec, consistent with the rest of the app's information density.

### 6.9 Settings
Grafana Administration-style layout: left mini-nav (Account & MFA, Notifications, Sentinel Integration, AI Provider, Data Retention, Audit Log, Users & Roles), right-hand configuration panels. The **Sentinel Integration** sub-page keeps its architecture diagram from design.md exactly as specified — Vanguard → Sentinel → Wazuh, with the Sentinel→Wazuh card always read-only — now rendered as a status panel row (see 6.1 Row 5's visual language) rather than plain ASCII-style boxes, with each connection's compact status indicator, credentials fields, and the alert-match webhook toggle unchanged in function.

---

## 7. Accessibility & Responsiveness

- All semantic color meaning is paired with text, icon, and/or shape — never color alone.
- Minimum contrast ratio 4.5:1 for all token pairings above.
- Focus outline: 2px `--accent-blue` (intentionally not Signal Red, which is reserved for danger/critical semantics) on every interactive element; drawers trap focus and close on Esc.
- Respect `prefers-reduced-motion`: disable heatmap/graph hover animations and panel-expand transitions, keep only opacity fades.
- **Responsive grid:** 12-column desktop → 8-column tablet → single-column mobile. Sidebar: 240px desktop → 64px icon-only tablet → compact overlay nav mobile. Tables collapse to stacked information rows below 768px. The ATT&CK heatmap scrolls horizontally rather than reflowing, since compressing technique columns further would destroy legibility.
