# Setup Guide — Building Vanguard

**Purpose:** step-by-step build guide, structured so each section can be handed to an AI coding assistant (Claude Code or similar) as a self-contained task. Do not skip ahead — later steps assume earlier ones are done and tested.

**Read first:** `PRD.md` (features), `design.md` (UI/design tokens). Feed both into the coding session before Step 3 — the assistant needs them to restyle correctly and to know which modules are native vs. inherited from Ghostwriter.

---

## Implementation Status

Current state of the build, tracked against the steps below (last updated 2026-08-22).

| Step | Status | Notes |
|---|---|---|
| 0–4 (fork, bring-up, rebrand) | ✅ Done | Fork baseline + full rebrand to Vanguard |
| 5 (core modules) | ✅ Done | Dashboard, Assets, Findings, Reports |
| 6 (Knowledge Base) | ✅ Done | Notes, backlinks, graph, embeddings, RAG polish (v0 `rag_answer` + citation chips) |
| 7 (Purple Team Sync) | ✅ Done | `TimelineEntry`/`DetectionVerdict`/`RuleRequest`, ATT&CK Matrix (heatmap + gap report + embedded DeTT&CT panel), timeline CRUD, mock alert correlation |
| 8 (Rule Request workflow) | ✅ Done | `draft → pending_review` from UI, `verified` by operator after retest, `simulate_sentinel_rule_response` command + admin actions for the Sentinel side |
| 9 (Sentinel integration) | ⏸ Deferred | Stub/mock still in place (`services.mock_sentinel_alerts`); live client blocked until Sentinel's API is ready (SETUP.md 9) |
| 10 (wire rule requests to Sentinel) | ⏸ Deferred | Depends on Step 9 |
| 11 (DeTT&CT scheduled job) | ✅ Done | `import_dettct` command reads output YAML; read-only "Long-term Coverage" panel with `Last updated` |

Commits: `8eccc293` (DeTT&CT), `94d3da64` (Purple Team + RAG), `fea24180` (DeTT&CT panel embed), `f2f1af9d` (rule request lifecycle).

---

## 0. Prerequisites

- Git
- Docker + Docker Compose
- Python 3.11+ (match whatever Ghostwriter's current release targets — check their `pyproject.toml`/`Pipfile` at fork time)
- Node.js (for frontend asset build, version per Ghostwriter's `package.json`)
- PostgreSQL 15+ with the `pgvector` extension available (needed later for Knowledge Base — confirm your Docker Postgres image supports it, e.g. `pgvector/pgvector:pg15`)
- A GitHub account with permission to fork `GhostManager/Ghostwriter`

### Recommended MCP servers (if coding this with Claude Code)

- **Postgres MCP** — query/inspect schema directly, check migrations, debug `pgvector` data without a separate DB client. Highest value during Steps 5–8.
- **Playwright MCP** (or Puppeteer MCP) — drive the checkpoint clicks in Steps 3–11 from the coding session itself: navigate, screenshot, confirm a restyle or a new page actually renders before moving on.
- **GitHub MCP** — if the branch strategy in section 2 is managed via PRs, create/review PRs directly from the session.
- Filesystem MCP is usually already built into Claude Code — no need to add separately.

Priority order: Postgres + Playwright first — those two cover the two things every checkpoint in this guide actually verifies (DB state, UI state).

---

## 1. Fork and Local Bring-Up

1. Fork `github.com/GhostManager/Ghostwriter` into your own org/account. Pin the commit/tag you fork from and record it — this becomes the answer to the open question in PRD.md section 10 ("confirm Ghostwriter version/commit to fork").
2. Clone your fork locally.
3. Follow Ghostwriter's own `README`/docs to bring it up via Docker Compose. Do not customize anything yet — the goal of this step is only to confirm the unmodified fork runs, so you have a known-good baseline before you start changing things.
4. Log in, create a dummy engagement/finding, generate a report. If this works, your baseline is solid — commit this state as your `main` branch starting point before any Vanguard-specific work begins.

---

## 2. Branching Strategy

Use a dedicated branch per major change so you can roll back cleanly if a vibe-coding session goes sideways:

- `rebrand/ui` — Step 3
- `strip/consulting-features` — Step 4
- `feature/knowledge-base` — Step 6
- `feature/purple-team-sync` — Step 7–8
- `feature/sentinel-integration` — Step 9
- `feature/rule-requests` — Step 10
- `feature/dettct-import` — Step 11

Merge each into `main` only after it runs and you've manually clicked through it once. Don't stack unmerged branches on top of each other — coding assistants lose track of state fast when the diff base keeps moving.

---

## 3. Rebrand & Restyle Pass

Goal: replace Ghostwriter's visual identity with the Vanguard design system, without touching business logic yet.

1. Global find/replace of product name/branding strings (templates, `<title>` tags, email templates, PDF/report headers).
2. Add the design tokens from `design.md` section 1–3 as CSS custom properties in the base stylesheet (`--bg-base`, `--accent-signal`, etc.) — replace Ghostwriter's default theme variables with these.
3. Swap typography: Inter Tight / Inter / JetBrains Mono per `design.md` section 2. Update font imports and base `font-family` rules.
4. Update the sidebar nav structure to match `design.md` section 4 (Dashboard, Engagements, Assets, Findings, ATT&CK Matrix, Knowledge Base, Reports, Tasks, Settings) — at this stage, some of these are placeholder links since the underlying pages don't exist yet.
5. Restyle the core components Ghostwriter already has (tables, buttons, cards, modals) to match `design.md` section 4's specs, one component at a time. Check each against real data before moving to the next — a restyle that silently breaks a table's sort/filter JS is worse than an ugly table that works.

**Checkpoint:** click through every existing Ghostwriter page. It should look like Vanguard now, and every feature that worked in Step 1 should still work identically.

---

## 4. Strip Non-Applicable Features

Per PRD.md section 1.1 and 3 (Non-goals): remove multi-client management, billing/contract tracking, and consultancy-specific workflows.

1. Inventory every model, view, and template tied to client/billing before deleting anything — list them out first, don't delete-as-you-go blind.
2. Decide per item: hard delete vs. hide-behind-a-flag. Recommendation: hide behind a feature flag first (faster, reversible), hard-delete later once you're confident nothing else depends on it.
3. Simplify the Engagement model where it references client/contract fields you no longer need — but keep the underlying engagement/scope/RoE structure, since PRD.md 5.1 keeps that part.
4. Re-run through every page again after stripping — deleting a model field can silently break a template that still references it.

---

## 5. Database Extensions

Before building Knowledge Base (Step 6):

1. Enable `pgvector` on the Postgres instance: `CREATE EXTENSION IF NOT EXISTS vector;`
2. Confirm your Docker Compose Postgres image includes the extension binary — if using stock `postgres:15`, switch to `pgvector/pgvector:pg15` or install the extension into the existing image.
3. Add a Django migration that creates the extension (`django.contrib.postgres` + a raw SQL migration, or the `django-pgvector` / `pgvector-python` package's Django integration).

---

## 6. Knowledge Base Module (PRD 5.14, design.md 5.9)

New Django app, e.g. `knowledge_base/`.

1. **Models:** `Note` (title, body markdown, engagement FK nullable, tags M2M, created/updated), `NoteLink` (source note, target note — for backlinks), `NoteEmbedding` (note FK, chunk text, `pgvector` field, chunk index).
2. **Markdown editor:** server-rendered or a JS editor component with `[[link]]` autocomplete — query existing note titles as the user types `[[`.
3. **Backlink resolution:** on note save, parse `[[links]]`, create/update `NoteLink` rows, resolve broken links (link to a note that doesn't exist yet) gracefully rather than erroring.
4. **Graph view:** a JSON endpoint returning nodes (notes, findings, assets — color-coded per `design.md`) and edges (links, finding↔asset associations), rendered client-side (e.g. force-directed graph library).
5. **Embedding pipeline:** on note create/update, chunk the body (simple paragraph/heading-based chunking is fine to start), call the embedding model, store vectors in `NoteEmbedding`. Run this as a background task (Celery, which Ghostwriter likely already has for report generation) — don't block the save request on an API call.
6. **RAG query endpoint:** given a question, embed it, run a `pgvector` cosine-similarity query against `NoteEmbedding`, take top-N chunks, build a prompt with those chunks as context, call the LLM, return the answer plus the source note IDs so the UI can show citation chips.
7. **Model wiring:** build this against an interface, not a hardcoded provider — PRD.md section 10 flags DeepSeek V4 Pro/Flash as pending approval, so the actual model/endpoint should be a config value, not baked into the code. If Sentinel's LiteLLM proxy is reused (recommended), point at that proxy's OpenAI-compatible endpoint rather than calling a provider SDK directly.
8. **Sensitive-field exclusion:** before embedding, exclude or mask content pulled from the Credential Tracker (5.11) — don't let secrets end up in a vector store searchable by a chat prompt.

**Checkpoint:** create a handful of real notes, confirm backlinks resolve, confirm graph view renders, confirm a RAG query returns an answer that actually cites the right note.

---

## 7. Purple Team Sync Module (PRD 5.7)

New Django app, e.g. `purple_team/`.

1. **Models:** `TimelineEntry` (engagement FK, asset, technique ID, timestamp, description), `DetectionVerdict` (timeline entry FK, matched Sentinel alert ID nullable, verdict enum: detected / not_detected / detected_not_escalated / detected_late, confirmed_by_operator bool).
2. Build the Timeline tab UI (design.md 5.4) before wiring Sentinel — you need somewhere to create `TimelineEntry` rows manually first, so this module is testable standalone before Step 9 connects it to live alert data.
3. Build the ATT&CK Matrix page (design.md 5.6) reading from `DetectionVerdict` — heatmap tile coloring per verdict, detection gap report query (group by technique, filter `not_detected`, order by count).
4. Leave the actual Sentinel alert lookup as a stub/mock at this stage (return fake data) — this lets you build and test the whole UI before Step 9's real integration exists.

**Checkpoint:** manually create timeline entries and mock verdicts, confirm the heatmap and gap report render correctly with realistic data volume (dozens of entries, not just one or two).

---

## 8. Rule Request Workflow (PRD 6.5)

Extends `purple_team/` app.

1. **Model:** `RuleRequest` (gap reference, technique ID, draft rule text, test log sample file, justification, status enum: draft / pending_review / approved / deployed / rejected / verified, timestamps per status change).
2. Build the Rule request drawer UI (design.md ATT&CK Matrix section) and the status tracker component.
3. Status transitions: only `draft → pending_review` is triggerable from Vanguard's UI directly. All transitions past that (`approved`, `deployed`, `rejected`) are driven by Sentinel's response (Step 9) — don't build a way for Vanguard's own UI to self-approve, even for testing; use a Django admin action or management command to simulate Sentinel's response instead, so the real permission boundary isn't accidentally built with a bypass.
4. `verified` is set by the operator after a manual retest, from Vanguard's side.

**Checkpoint:** submit a rule request, simulate approval via admin/management command, confirm status tracker updates correctly through all states including a rejected path.

---

## 9. Sentinel Integration (PRD section 6)

This is the step that turns the stubs from Steps 7–8 into live data. Coordinate timing with whoever is extending Sentinel's API (even if that's also you) — Sentinel needs new endpoints before this step can be tested end-to-end.

1. **Credentials:** create two separate service-account credentials — one scoped only to `redteam/*` push endpoints, one scoped only to `soc/alerts` and `soc/assets` read endpoints (per PRD 6.4's separation-of-credentials requirement). Store both in environment variables / secrets manager, never in code.
2. **Outbound client:** build a small internal client module wrapping the Sentinel API calls (POST actions/findings, GET alerts/assets) — one place to change base URL, retry/backoff, and auth headers.
3. Replace Step 7's mock alert lookup with a real call to `GET /api/v1/soc/alerts?asset=...&from=...&to=...`.
4. Wire `TimelineEntry` creation to also push to `POST /api/v1/redteam/actions` (per PRD 6.1) — decide sync (blocking) vs. async (Celery task); async is safer so a Sentinel outage doesn't block red team work.
5. Add the **Connection status chip** (design.md) to a Settings sub-page, backed by a periodic health-check task hitting a lightweight Sentinel endpoint.
6. Implement idempotency keys on the push endpoints (PRD 6.4) to survive retries without duplicate rows.

**Checkpoint:** run a real engagement action, confirm it appears as a `TimelineEntry` in Vanguard AND is visible on Sentinel's side (or in Sentinel's logs if no UI for it yet). Confirm a real alert lookup returns a real verdict.

---

## 10. Wire Rule Requests to Sentinel

1. `POST /api/v1/redteam/rule-requests` on submit (Step 8's `draft → pending_review` transition).
2. Poll or webhook-receive `GET /api/v1/soc/rule-requests/{id}/status` to update local status.
3. `POST /api/v1/redteam/rule-requests/{id}/retest` when the operator confirms a retest in Vanguard.

**Checkpoint:** full loop test — submit a request, approve it on the Sentinel side (real approval this time, not simulated), confirm it deploys, run a retest, confirm `verified` status and that it's reflected in the Detection Gap Report (the gap should disappear or move to resolved).

---

## 11. DeTT&CT Scheduled Job

1. Install DeTT&CT as a standalone tool on the server (or a sidecar container) — not as a Python dependency inside the Django app, per PRD 1.1/5.4's "runs externally" decision.
2. Set up a scheduled job (cron, or Celery beat if already using Celery from Step 6) to run DeTT&CT and write its YAML/JSON output to a known path or object storage location.
3. Build a small Django management command or Celery task that reads that output file and populates the read-only "Long-term Coverage (DeTT&CT)" panel (design.md 5.6), stamping it with the job's run timestamp.

**Checkpoint:** run the job manually once, confirm the panel populates and shows the correct "Last updated" timestamp, not a stale/default one.

---

## 12. Rollout Order Summary (maps to PRD.md Phased Roadmap)

| Phase | Steps here |
|---|---|
| MVP | 0–4 |
| Phase 2 | 5, 6 (partial — notes/graph without heavy AI polish), 11 |
| Phase 3 | 6 (AI/RAG polish), 7, 8, 9, 10 |

Don't build Phase 3 pieces before Phase 1/2 are stable and actually in daily use — Purple Team Sync and Rule Requests are only useful once there's real engagement/timeline data flowing through the MVP.

---

## 13. Working With an AI Coding Assistant (Vibe-Coding Notes)

- Paste the relevant PRD.md section and design.md section for the step you're on into the session — don't paste the whole document every time; scope it to what's being built right now.
- Ask for one checkpoint at a time and actually run it before moving on. A coding assistant will keep building on top of broken state if you don't verify.
- When something in Ghostwriter's existing code conflicts with a PRD/design requirement, tell the assistant explicitly which one wins (usually: keep Ghostwriter's data model, override the UI/styling) rather than letting it guess.
- Keep this guide open alongside the two spec docs — if a step's checkpoint fails, that's the point to stop and debug, not push forward to the next step.
