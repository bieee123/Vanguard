# PRD — Red Team Dashboard

**Product:** Internal Red Team Operations Dashboard
**Companion system:** SOC Dashboard (Wazuh + AI summarization) — already in production
**Owner / primary user:** Solo cyber operator (blue + red team, all-role)
**Status:** Draft v1.0
**Last updated:** 2026-08-15

---

## 1. Overview

The company already runs a SOC Dashboard fed by Wazuh with AI-generated alert summaries. The next phase is a **Red Team Dashboard** — a workspace to plan, run, and document offensive security engagements (internal pentests, red team exercises, adversary simulation), and to **close the loop with the SOC side** so every offensive action can be checked against what the blue side actually detected.

Because one person runs both sides, the dashboard's real value isn't just record-keeping — it's turning solo red/blue work into a repeatable **purple team feedback loop**: attack → detect (or not) → fix detection gap → re-test.

### 1.1 Build Strategy — Fork Ghostwriter as Foundation

**Decision: Vanguard is built as a fork of Ghostwriter (SpecterOps), not built from scratch and not run as a wrapper around multiple third-party tools.**

Ghostwriter (BSD-3-Clause, Python/Django, GraphQL API) already covers the bulk of Fase 1–2 scope — engagement management, findings library, evidence handling, and a Jinja2-based reporting engine — battle-tested by other red teams. Building that from zero would spend solo-operator time re-solving problems that are already solved, instead of on the parts that are actually unique to this company.

**What this means concretely:**
1. **Fork Ghostwriter's codebase** as the starting point, rebrand as Vanguard, and restyle the UI using the tokens/components already defined in `design.md`.
2. **Strip features that don't apply**: Ghostwriter is built for consulting red teams (multi-client management, client billing/contract tracking, multi-tenant workflows). Since this is single-company, internal use, those modules are removed rather than adapted — less surface area to maintain.
3. **Build the two truly custom pieces natively inside the fork, rather than running extra third-party services alongside it:**
   - **Purple Team Sync** (5.7) — **VECTR's source code is never taken, forked, or run.** Only its *data model concept* is reused — a test case with a Red side (action taken) and a Blue side (was it detected) — reimplemented from scratch as new Django models, views, and API endpoints native to the Vanguard codebase. This keeps it in one application, one login, one database — and VECTR's own license terms (Community Edition tagging suggests a paid Enterprise tier exists) don't need to be evaluated for this use case at all, since no VECTR code or instance is involved.
   - **Rule Request workflow** (6.5) — entirely new, no open-source equivalent exists for this because it's specific to the Sentinel/Wazuh integration.
4. **DeTT&CT is handled differently from VECTR — it's a CLI tool, not a concept to reimplement, so it's run as-is rather than rewritten.** It stays a standalone third-party process (scheduled job, e.g. weekly cron) that produces gap-analysis YAML/JSON. Vanguard's ATT&CK Matrix page (5.4) only **reads that output file** — no DeTT&CT source code is merged into the Ghostwriter fork, and no DeTT&CT logic is reimplemented in Django.

**Summary of the distinction:**

| | VECTR | DeTT&CT |
|---|---|---|
| Source code taken into the fork? | No | No |
| What's actually reused | The data-model *concept* only (Red/Blue verdict per test case) | The tool itself, run as an external process |
| Result | 100% original code, written natively in Vanguard's Django app | Ghostwriter fork only reads DeTT&CT's output file — the tool keeps running standalone |
| Why the difference | VECTR is a full web app — merging its functionality into one unified UI requires rewriting it as part of Vanguard | DeTT&CT is a simple CLI/YAML tool — rewriting it natively would add risk and effort for no benefit over just running it |

**Why not run Ghostwriter + VECTR as two separate services behind a unified frontend (the federation pattern considered earlier):** feasible, but adds a second application to patch/maintain/host for a solo operator, and a second license to track, for a feature (purple team verdicts) that's small enough to build natively once the timeline/finding data model already exists in the fork.

## 2. Goals

1. Give a single place to plan and track engagements from scope to report, replacing scattered notes/spreadsheets.
2. Centralize findings (vulnerabilities, misconfigurations, weak creds) with consistent severity scoring and remediation status.
3. Map every offensive action to **MITRE ATT&CK** so detection coverage can be measured objectively.
4. Connect to the SOC Dashboard's alert data so each red team action shows a **Detected / Not Detected / Partially Detected** verdict.
5. Produce client/board-ready reports without manual reformatting.
6. Keep an auditable, timestamped activity log for deconfliction and OPSEC (important even solo — if the SOC dashboard alerts fire, you need to know "was that me?").

## 3. Non-goals (out of scope for v1)

- Does not replace dedicated exploitation tooling (Metasploit, Cobalt Strike, Burp, Nuclei) — the dashboard **imports/tracks results**, it does not execute attacks itself.
- Not a multi-tenant SaaS product — single-org, internal use only for v1.
- No automated exploitation or "auto-attack" features.
- **Multi-client management, client billing/contract tracking, and consultancy-oriented workflows are explicitly stripped from the Ghostwriter fork** (see 1.1) — not needed for a single-company internal tool and not maintained going forward.
- No standalone VECTR instance — purple team correlation is native to Vanguard (see 1.1), not a separate service.

## 4. Users

| Role | Description | v1 |
|---|---|---|
| Operator (you) | Full access: create engagements, log findings, run purple-team correlation, generate reports | ✅ |
| Future red team member | Same as operator, scoped to assigned engagements | Phase 2 |
| Read-only stakeholder (founder/management) | View dashboard summaries and reports only | Phase 2 |

## 5. Core Modules & Features

### 5.1 Engagement Management *(from Ghostwriter fork — consultant/client fields stripped, single-org fields kept)*
The top-level container for any offensive activity.
- Create engagement: name, type (internal pentest / red team exercise / purple team drill / bug bounty triage / ad-hoc assessment), start/end date, status (Planned / Active / Paused / Completed / Reported).
- **Scope definition**: in-scope assets (IP ranges, domains, apps), explicitly out-of-scope items, rules of engagement (allowed techniques, blackout windows, escalation contact).
- **Objectives**: goal-based (e.g. "reach domain admin," "test EDR evasion," "validate patch of CVE-XXXX").
- Engagement dashboard: progress bar (recon → exploitation → post-ex → reporting), open findings count by severity, days remaining.
- Archive/close engagement (locks data, keeps it for historical trend reporting).

### 5.2 Asset & Target Inventory (Recon)
- Add assets manually or import from recon tool output (Nmap XML, Amass/Subfinder JSON, Nuclei JSON).
- Asset record: hostname/IP, OS/service fingerprint, open ports, owning business unit, criticality tag, discovered-by (tool/manual).
- Asset status tags: Unverified / In Scope / Out of Scope / Compromised / Not Compromised.
- Cross-link asset → findings → SOC asset criticality (pulled from SOC dashboard if the same asset exists there).
- Network map view (simple node graph of hosts/subnets discovered).

### 5.3 Findings / Vulnerability Management *(from Ghostwriter fork — findings library reused as-is)*
The core record type.
- Fields: title, description, affected asset(s), category (e.g. misconfig, weak credential, injection, privilege escalation, exposed service), CVE/CWE reference, CVSS score (calculator built in), custom severity override, status (Open / Retest / Fixed / Accepted Risk / False Positive), discovered date, discoverer.
- **Evidence attachments**: screenshots, terminal output, request/response captures, PoC scripts (stored as attachments, not executed).
- **Reproduction steps** field (structured step list, not raw exploit payload sharing outside the tool).
- Remediation recommendation + owner + due date.
- Retest workflow: mark "ready for retest" → re-verify → close.
- Bulk import from scanner output (Nessus/OpenVAS/Nuclei CSV/JSON) with de-duplication against existing findings.
- Severity distribution chart per engagement (Critical/High/Med/Low/Info).

### 5.4 Attack Path & MITRE ATT&CK Mapping *(new module, built native; cumulative coverage view supplemented by a scheduled DeTT&CT job run externally — Vanguard only reads its output file, no DeTT&CT code is merged in — see 1.1)*
- Every logged action (recon step, exploit attempt, lateral move, persistence action) is tagged with one or more **ATT&CK Technique IDs**.
- **Attack path / kill-chain builder**: visual node-to-node flow (Initial Access → Execution → Persistence → Priv Esc → Lateral Movement → Exfil/Objective) built from logged actions in order.
- **ATT&CK Navigator-style heatmap**: techniques used this engagement, colored by whether SOC detected them (see 5.7).
- Cumulative coverage view across all past engagements — shows which techniques have **never once been tested**, which is itself a gap to flag.

### 5.5 Activity / Action Timeline (OPSEC Log)
- Chronological, timestamped log of every action taken during an engagement: command run (high-level description, not necessarily full payload), target, technique tag, outcome, operator note.
- Purpose: deconfliction ("did that SOC alert at 14:32 come from me?") and audit trail for the final report.
- Filter by engagement, technique, asset, time range.
- Manual "note" entries allowed for context (e.g. "paused — client requested blackout window").

### 5.6 Evidence & Artifact Repository *(from Ghostwriter fork — evidence handling extended with encryption-at-rest and retention rules)*
- Central, engagement-scoped file store for screenshots, logs, PoC scripts, loot (structure only — sensitive material like captured credentials/hashes should be stored **encrypted at rest** and access-logged, never displayed in plaintext by default — see 5.11).
- Tag artifacts to findings and/or timeline entries.
- Retention/expiry policy configurable per engagement (auto-purge sensitive artifacts N days after report delivery).

### 5.7 Purple Team Sync — SOC Dashboard Integration *(new module, built native inside the Ghostwriter fork — see 1.1; the Red/Blue verdict concept is inspired by VECTR, but no VECTR source code, instance, or dependency is used — this is 100% original Django code)*
This is the feature that connects both dashboards and is the highest-value addition.
- **Time-correlated lookup**: for each timeline entry (5.5), query the SOC dashboard's alert data (via API) for alerts on the same asset within a configurable time window.
- Auto-suggest a match; operator confirms/rejects the link (avoid false correlation).
- Verdict per action: **Detected**, **Not Detected**, **Detected but not alerted/escalated**, **Detected late** (with delta time shown).
- Roll up to the ATT&CK heatmap (5.4): color-code each technique tile by detection outcome.
- **Detection Gap Report**: auto-generated list of techniques that succeeded and were *not* detected — this becomes direct input for Wazuh rule-tuning work on the SOC side.
- Optional: push a "detection gap" ticket/task back into the SOC dashboard's backlog automatically.

### 5.8 Reporting & Export *(from Ghostwriter fork — Jinja2 reporting engine reused, templates adapted to Executive/Technical formats)*
- Auto-generate a structured report from engagement data: executive summary, scope, methodology, findings table (sorted by severity), attack narrative (from timeline), ATT&CK coverage heatmap, detection gap summary, remediation roadmap.
- Export to PDF and DOCX.
- Two report templates: **Executive** (short, non-technical, for founder/leadership) and **Technical** (full detail, for remediation owners).
- Report versioning (draft → reviewed → final, with change history).

### 5.9 Task / Kanban Workflow
- Personal-use kanban for engagement work: To Do / In Progress / Blocked / Done.
- Task types: recon task, exploitation task, finding write-up, retest, report section.
- Optional due dates and reminders.

### 5.10 Tool Integrations (Import Layer)
v1 supports **file import**, not live agent execution, to keep the dashboard passive and low-risk:
- Nmap (XML)
- Nuclei (JSON)
- Amass / Subfinder (JSON/txt)
- Burp Suite (XML export)
- Nessus / OpenVAS (XML/CSV)
- Generic CSV/JSON import mapper for anything else.
- Each import creates/updates Asset and/or Finding records with a "source tool" tag and de-duplication check.

### 5.11 Credential & Access Tracker
- Tracks credentials/access obtained during engagements **for engagement purposes only** (e.g. "local admin on HOST-12 via Kerberoasting").
- Sensitive values (passwords, hashes) stored encrypted, masked by default, revealed on explicit action + logged.
- Auto-expire/purge reminder after engagement closes.
- Access level tag (User / Local Admin / Domain Admin / Cloud Admin / Service Account) used to build the attack path privilege-escalation view.

### 5.12 Notifications
- Telegram/Slack/email alert on: new critical finding logged, retest due, report deadline approaching, detection-gap sync completed.
- Daily/weekly digest option (useful since it's solo — no need to babysit the dashboard).

### 5.13 Access Control & Audit
- Auth: SSO or local account + MFA (mandatory, since this stores sensitive offensive data).
- Role-based access (Operator / Viewer) — ready for when the team grows beyond one person.
- Full audit log: who viewed/edited/exported what, when.
- Engagement-level data isolation (client A's data never visible when working client B's, if this ever becomes multi-client).

### 5.14 Knowledge Base / Second Brain *(new module, built native — Obsidian-style notes + RAG search)*
- Markdown notes per engagement or standalone (methodology, cheatsheets, technique writeups). Bidirectional `[[links]]` + auto backlinks. Graph view of notes/findings/assets. Tags + templates.
- Notes link to structured records (finding, asset, engagement) — not just freeform text.
- **AI layer (RAG):** notes chunked + embedded, vectors stored in the same PostgreSQL via `pgvector` (no separate vector DB needed — Ghostwriter already runs Postgres). Query → similarity search → relevant chunks fed as context to the LLM → answer grounded in past engagements.
- **Planned model: DeepSeek V4 Pro/Flash** — under discussion with management, not finalized. Ideally routed through the same AI proxy/governance path Sentinel already uses (LiteLLM), so both dashboards share one AI policy instead of two.
- Sensitive fields (5.11 credentials) excluded from embedding by default, or flagged so they don't surface in AI answers.
- RBAC-aware retrieval once multi-user (5.13) lands — notes stay scoped to engagement access.

## 6. Integration Architecture — Red Team Dashboard ↔ Sentinel (SOC) ↔ Wazuh

Three applications, **not** a direct three-way mesh. **Sentinel is the single gateway to Wazuh.** Red Team Dashboard never talks to Wazuh directly.

```
Red Team Dashboard  <── REST API ──>  Sentinel (SOC dashboard)  <── REST API ──>  Wazuh
   (findings, timeline)                 (gateway + AI summary)     (Indexer/API, unchanged)
```

**Why gateway-only, not direct:**
- Wazuh Indexer/API keeps exactly one authenticated consumer (Sentinel), reducing attack surface and credential sprawl.
- Sentinel's AI enrichment layer is reused automatically — Red Team never has to re-implement alert parsing/summarization.
- A Wazuh schema/version change only requires updating Sentinel's integration, not two separate integrations.
- Each hop gets its own service-account credentials, so a leak on one connection doesn't expose the other.

### 6.1 Connection 1 — Red Team Dashboard → Sentinel (push)
Red Team pushes engagement data so Sentinel's AI has red-team context when triaging alerts, and so Sentinel can serve as the correlation source for Purple Team Sync.

| Endpoint | Method | Payload | Purpose |
|---|---|---|---|
| `/api/v1/redteam/actions` | POST | `{engagement_id, asset, technique_id, timestamp, action_desc}` | Push a timeline entry as it's logged |
| `/api/v1/redteam/findings` | POST | `{engagement_id, asset, severity, title, status}` | Push new/updated findings |
| `/api/v1/redteam/engagements` | POST/PATCH | `{id, name, status, scope, start_end}` | Sync engagement scope so Sentinel knows which assets are "active red team target" (helps its AI avoid false "real incident" escalation) |

### 6.2 Connection 2 — Sentinel → Wazuh (existing, unchanged)
Sentinel continues querying the Wazuh Indexer (OpenSearch REST API) exactly as it does today. No new work required here.

### 6.3 Connection 3 — Sentinel → Red Team Dashboard (pull, for Purple Team Sync)
When Red Team Dashboard needs to check whether an action was detected, it calls Sentinel — never Wazuh directly. Sentinel translates this into a Wazuh Indexer query internally and returns the (optionally AI-summarized) result.

| Endpoint | Method | Query params | Returns |
|---|---|---|---|
| `/api/v1/soc/alerts` | GET | `asset, from, to` | Matching alerts in the time window, with rule/technique, severity, AI summary |
| `/api/v1/soc/assets/{id}` | GET | — | Asset criticality + metadata, to enrich Red Team's asset inventory (5.2) |

Optional real-time push instead of polling: **`/api/v1/redteam/webhooks/alert-match`** — Sentinel calls this on Red Team Dashboard when a new alert matches an asset currently in scope for an active engagement.

### 6.4 Cross-cutting requirements
- **Separate credentials per hop** — a Red Team↔Sentinel API key/OAuth2 client is distinct from Sentinel↔Wazuh credentials. Compromise of one does not expose the other.
- **Service-to-service auth only** — API key or OAuth2 client-credentials grant, never user session tokens, on both connections.
- **Network segmentation** — all three apps stay on an internal-only network segment; Wazuh's API/Indexer is never exposed outside that segment, and Red Team Dashboard has no network path to it at all (enforced at the firewall/VLAN level, not just application logic).
### 6.5 Write-path — Detection Gap → Wazuh Rule Update (via Sentinel only)

All connections above are read/informational. This one **writes** to Wazuh (new/updated detection rule), so it carries more risk and needs a stricter path. The rule stays the same: **Vanguard never talks to Wazuh — not even to write.** Everything routes through Sentinel, and a write requires explicit human approval before it reaches Wazuh Manager.

```
Vanguard  ──POST rule-request──>  Sentinel  ──(after approval) write──>  Wazuh Manager
   (draft rule, gap context)      (review + audit)                        (rules.xml, reload)
```

**Why this needs its own path, not the existing read connection:**
- Reading alerts (6.2/6.3) hits the Wazuh **Indexer** (OpenSearch API). Writing a rule hits the Wazuh **Manager** API (`local_rules.xml` / decoders) — a different service, different credential, different blast radius if misused (a bad write can silence real detections, not just miss them).
- Because of that, this connection uses **separate, narrower-scoped credentials** from the alert-read connection, and is **never auto-applied** — always `pending_review` until a human approves.

**Workflow:**
1. **Identified** — Purple Team Sync (5.7) flags a technique that succeeded but wasn't detected → appears in the Detection Gap Report.
2. **Draft** — operator drafts a candidate rule/decoder in Vanguard, informed by the gap's technique and a sample log line.
3. **Local test** — validate with `wazuh-logtest` against staging before it goes anywhere near Sentinel.
4. **Submit** — Vanguard pushes the draft to Sentinel as a `rule-request` (status: `pending_review`).
5. **Review & deploy** — an admin reviews inside Sentinel and approves; only then does Sentinel write the rule to Wazuh Manager and trigger a reload. Rejections go back to Vanguard as `rejected` with a reason.
6. **Verify** — Vanguard re-runs the same technique (retest) to confirm it's now detected; status moves to `verified` or back to `draft` if still missed.
7. Every step (submit, approve/reject, deploy, verify) is recorded in Sentinel's existing **Audit Trail** — who approved what rule, when, and the before/after.

**Endpoints:**

| Endpoint | Direction | Payload / purpose |
|---|---|---|
| `/api/v1/redteam/rule-requests` | Vanguard → Sentinel (POST) | `{gap_id, technique_id, draft_rule_xml, test_log_sample, justification}` |
| `/api/v1/soc/rule-requests/{id}/status` | Sentinel → Vanguard (GET) | `pending_review \| approved \| deployed \| rejected \| verified` |
| `/api/v1/redteam/rule-requests/{id}/retest` | Vanguard → Sentinel (POST) | `{result, evidence}` — closes the loop after a successful retest |

**Guardrails:**
- Credentials for this path are scoped only to the rule-request endpoints — cannot read alerts or touch anything else.
- No status ever skips `pending_review` — even an operator with admin rights on Vanguard cannot force a Wazuh write without going through Sentinel's approval step.
- A rejected or failed-verify request stays visible in Vanguard's Detection Gap Report until resolved, so gaps can't silently disappear.
- **Rate limiting + retry/backoff** on all API connections (read and write), since this is operated solo with no dedicated on-call.
- **Idempotency keys** on POST endpoints (action/finding pushes, rule-requests) to avoid duplicate entries on retry.

## 7. Non-Functional Requirements

- All sensitive data (credentials, PoCs, client scope) encrypted at rest.
- Dashboard itself must not become an attack surface: strict auth, MFA, no default creds, dependency scanning on the dashboard's own stack.
- Full audit logging (see 5.13).
- Works fully self-hosted (no dependency on external SaaS storing client engagement data), consistent with the SOC dashboard's custom-build philosophy.
- Reasonable performance target: dashboard usable with up to ~50 concurrent engagements and tens of thousands of findings without noticeable lag.

## 8. Success Metrics

- % of ATT&CK techniques tested that have a confirmed detection verdict (goal: increasing over time).
- Time from finding discovery → report delivery (should shrink vs. manual process).
- Number of detection gaps identified and subsequently closed on the SOC side (the real purple-team KPI).
- Reduction in time spent on manual report formatting.

## 9. Phased Roadmap

**Phase 1 (MVP)**
Fork Ghostwriter, strip consultant/multi-client features, rebrand + restyle UI per `design.md`. Engagement Management, Asset Inventory, Findings Management, basic Timeline, manual reporting export — largely reused from the fork with light adaptation (5.1–5.3, 5.5, 5.8 basic). Expect this phase to move faster than a from-scratch build since the data model and UI scaffolding already exist.

**Phase 2**
ATT&CK mapping + heatmap (native build, DeTT&CT scheduled job wired in), Tool import layer, Kanban, Notifications (5.4, 5.10, 5.9, 5.12).

**Phase 3**
Purple Team Sync built natively (5.7), Rule Request workflow to Sentinel/Wazuh (6.5), Detection Gap Report, Credential Tracker, full RBAC/audit (5.11, 5.13). This is the phase with no open-source shortcut — budget the most solo-operator time here.

## 10. Open Questions

- Confirm the Ghostwriter version/commit to fork, and produce a concrete list of modules/fields to strip (multi-client, billing) before the rebrand pass begins.
- **AI model for Knowledge Base (5.14): DeepSeek V4 Pro/Flash proposed, pending approval from management.** Confirm before build starts — affects cost model, data-residency review, and whether it routes through the same LiteLLM proxy as Sentinel.
- Confirm integration method with SOC dashboard: shared API vs. shared database vs. message queue.
- Decide artifact storage backend (local encrypted disk vs. self-hosted object storage e.g. MinIO) — check whether Ghostwriter's existing evidence storage can be reused as-is or needs replacing.
- Decide whether AI summarization (already used in SOC) should also assist here — e.g. auto-drafting finding descriptions from raw scanner output, or auto-drafting the attack narrative from the timeline log. Recommended for Phase 2/3, not MVP.
