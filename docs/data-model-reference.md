# Database Schema — Vanguard

PostgreSQL 15+, `pgvector` extension required (Knowledge Base module). Grouped by PRD.md module number. Written as reference DDL — adapt to Django ORM migrations rather than running raw, since you're building inside the Ghostwriter fork and should reuse its existing `users`/auth tables (5.13) instead of creating new ones if Ghostwriter already has them.

> **Status (2026-08-22):** `notes`/`note_links`/`note_embeddings` (5.14), `timeline_entries`/`detection_verdicts`/`rule_requests` (5.7/6.5), and `dettct_runs` (DeTT&CT) are implemented as Django ORM models/migrations. `sentinel_connections` (PRD section 6) is spec'd here but **not yet built** — deferred with Steps 9–10 until Sentinel's API is available. DDL below remains the target.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 5.13 Users & Roles
*(likely already exists in Ghostwriter — extend, don't recreate)*

```sql
CREATE TYPE user_role AS ENUM ('admin', 'operator', 'manager');

ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'operator';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false;
```

---

## 5.1 Engagement Management

```sql
CREATE TYPE engagement_type AS ENUM ('internal_pentest', 'red_team_exercise', 'purple_team_drill', 'bug_bounty_triage', 'ad_hoc');
CREATE TYPE engagement_status AS ENUM ('planned', 'active', 'paused', 'completed', 'reported');

CREATE TABLE engagements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type engagement_type NOT NULL,
    status engagement_status NOT NULL DEFAULT 'planned',
    objectives TEXT,
    scope_in JSONB DEFAULT '[]',
    scope_out JSONB DEFAULT '[]',
    rules_of_engagement TEXT,
    start_date DATE,
    end_date DATE,
    owner_id INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);
```

---

## 5.2 Asset & Target Inventory

```sql
CREATE TYPE asset_criticality AS ENUM ('critical', 'high', 'medium', 'low', 'unknown');
CREATE TYPE asset_status AS ENUM ('unverified', 'in_scope', 'out_of_scope', 'compromised', 'not_compromised');

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname VARCHAR(255),
    ip_address INET,
    os_fingerprint VARCHAR(255),
    open_ports JSONB DEFAULT '[]',
    business_unit VARCHAR(255),
    criticality asset_criticality NOT NULL DEFAULT 'unknown',
    status asset_status NOT NULL DEFAULT 'unverified',
    discovered_by VARCHAR(255),          -- tool name or "manual"
    source_tool VARCHAR(100),
    sentinel_asset_id VARCHAR(255),      -- link to Sentinel's App Inventory record, nullable
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- asset can appear across multiple engagements (cross-engagement inventory)
CREATE TABLE engagement_assets (
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (engagement_id, asset_id)
);

CREATE INDEX idx_assets_criticality ON assets(criticality);
CREATE INDEX idx_assets_status ON assets(status);
```

---

## 5.3 Findings / Vulnerability Management

```sql
CREATE TYPE finding_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE finding_status AS ENUM ('open', 'retest', 'fixed', 'accepted_risk', 'false_positive');

CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),               -- misconfig, weak_credential, injection, priv_esc, ...
    cve VARCHAR(20),
    cwe VARCHAR(20),
    cvss_score NUMERIC(3,1),
    severity finding_severity NOT NULL,
    status finding_status NOT NULL DEFAULT 'open',
    reproduction_steps JSONB DEFAULT '[]', -- ordered list of steps
    remediation_recommendation TEXT,
    remediation_owner VARCHAR(255),
    remediation_due_date DATE,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    discoverer_id INTEGER REFERENCES users(id),
    source_tool VARCHAR(100),            -- for bulk-imported findings
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finding_assets (
    finding_id UUID REFERENCES findings(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    PRIMARY KEY (finding_id, asset_id)
);

CREATE TABLE finding_attack_techniques (
    finding_id UUID REFERENCES findings(id) ON DELETE CASCADE,
    technique_id VARCHAR(20) NOT NULL,   -- e.g. "T1059.001"
    PRIMARY KEY (finding_id, technique_id)
);

CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_status ON findings(status);
CREATE INDEX idx_findings_engagement ON findings(engagement_id);
```

---

## 5.4 Attack Path & ATT&CK Mapping / 5.5 Timeline (OPSEC log)

```sql
CREATE TABLE timeline_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id),
    technique_id VARCHAR(20),            -- MITRE ATT&CK technique ID
    tactic VARCHAR(50),                  -- e.g. "initial-access", "persistence"
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    action_description TEXT NOT NULL,
    outcome VARCHAR(50),                 -- success / failed / blocked
    operator_id INTEGER REFERENCES users(id),
    note TEXT,
    sequence_order INTEGER,              -- for attack-path ordering within an engagement
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_timeline_engagement ON timeline_entries(engagement_id);
CREATE INDEX idx_timeline_technique ON timeline_entries(technique_id);
CREATE INDEX idx_timeline_timestamp ON timeline_entries(timestamp);
```

---

## 5.6 Evidence & Artifact Repository

```sql
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,
    timeline_entry_id UUID REFERENCES timeline_entries(id) ON DELETE SET NULL,
    file_path VARCHAR(500) NOT NULL,     -- path in encrypted storage / object storage key
    file_type VARCHAR(50),               -- screenshot, log, poc_script, other
    encrypted BOOLEAN NOT NULL DEFAULT true,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ                -- for auto-purge policy
);

CREATE INDEX idx_evidence_engagement ON evidence(engagement_id);
```

---

## 5.7 Purple Team Sync

```sql
CREATE TYPE detection_verdict_type AS ENUM ('detected', 'not_detected', 'detected_not_escalated', 'detected_late', 'untested');

CREATE TABLE detection_verdicts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timeline_entry_id UUID NOT NULL UNIQUE REFERENCES timeline_entries(id) ON DELETE CASCADE,
    matched_sentinel_alert_id VARCHAR(255),  -- nullable, populated once matched
    verdict detection_verdict_type NOT NULL DEFAULT 'untested',
    detection_delay_seconds INTEGER,         -- for "detected_late" verdicts
    confirmed_by_operator BOOLEAN NOT NULL DEFAULT false,
    confirmed_by INTEGER REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verdicts_verdict ON detection_verdicts(verdict);
```

---

## 5.8 Reporting

```sql
CREATE TYPE report_template_type AS ENUM ('executive', 'technical');
CREATE TYPE report_status AS ENUM ('draft', 'reviewed', 'final');

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    template_type report_template_type NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status report_status NOT NULL DEFAULT 'draft',
    file_path VARCHAR(500),
    generated_by INTEGER REFERENCES users(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_engagement ON reports(engagement_id);
```

---

## 5.9 Tasks (Kanban)

```sql
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
CREATE TYPE task_type AS ENUM ('recon', 'exploitation', 'finding_writeup', 'retest', 'report_section');

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    task_type task_type,
    assignee_id INTEGER REFERENCES users(id),
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_engagement ON tasks(engagement_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

---

## 5.11 Credential & Access Tracker

```sql
CREATE TYPE access_level AS ENUM ('user', 'local_admin', 'domain_admin', 'cloud_admin', 'service_account');

CREATE TABLE credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id),
    username VARCHAR(255),
    secret_encrypted BYTEA NOT NULL,       -- application-layer encrypted, not plaintext
    access_level access_level NOT NULL,
    obtained_via TEXT,                     -- e.g. "Kerberoasting"
    obtained_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,                -- auto-purge reminder target
    purged BOOLEAN NOT NULL DEFAULT false,
    revealed_count INTEGER NOT NULL DEFAULT 0  -- incremented + audit-logged on each reveal
);

CREATE INDEX idx_credentials_engagement ON credentials(engagement_id);
```

---

## 5.14 Knowledge Base (Second Brain)

```sql
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    body_markdown TEXT NOT NULL DEFAULT '',
    engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,  -- nullable: standalone notes allowed
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE note_tags (
    note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    PRIMARY KEY (note_id, tag)
);

CREATE TABLE note_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_note_id UUID REFERENCES notes(id) ON DELETE CASCADE,  -- nullable: unresolved link target
    target_title_raw VARCHAR(255),        -- raw [[text]] before resolution, for broken-link display
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_links_source ON note_links(source_note_id);
CREATE INDEX idx_note_links_target ON note_links(target_note_id);

-- embedding dimension depends on the chosen model; adjust vector(N) accordingly
CREATE TABLE note_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536),               -- placeholder dimension, set per DeepSeek embedding model spec
    excluded_from_rag BOOLEAN NOT NULL DEFAULT false,  -- for sensitive-content exclusion (5.11 overlap)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_embeddings_note ON note_embeddings(note_id);
CREATE INDEX idx_note_embeddings_vector ON note_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 6.5 Rule Request Workflow

```sql
CREATE TYPE rule_request_status AS ENUM ('draft', 'pending_review', 'approved', 'deployed', 'rejected', 'verified');

CREATE TABLE rule_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    technique_id VARCHAR(20) NOT NULL,
    timeline_entry_id UUID REFERENCES timeline_entries(id),
    draft_rule_xml TEXT NOT NULL,
    test_log_sample_path VARCHAR(500),
    justification TEXT,
    status rule_request_status NOT NULL DEFAULT 'draft',
    requested_by INTEGER REFERENCES users(id),
    requested_at TIMESTAMPTZ,
    approved_by VARCHAR(255),             -- Sentinel-side identity, not necessarily a local user row
    approved_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rule_requests_status ON rule_requests(status);
```

---

## Sentinel Integration (config + health, PRD section 6 / design.md 5.11)

```sql
CREATE TYPE api_connection_scope AS ENUM ('read', 'write');
CREATE TYPE connection_status AS ENUM ('connected', 'degraded', 'disconnected');

CREATE TABLE sentinel_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope api_connection_scope NOT NULL,   -- separate credential rows for read vs write, per PRD 6.4
    api_base_url VARCHAR(500) NOT NULL,
    api_key_encrypted BYTEA NOT NULL,
    status connection_status NOT NULL DEFAULT 'disconnected',
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rotated_at TIMESTAMPTZ
);
```

---

## 5.10/5.12 Notifications

```sql
CREATE TYPE notification_channel AS ENUM ('telegram', 'slack', 'email');

CREATE TABLE notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    config JSONB DEFAULT '{}',            -- webhook URL, chat ID, etc.
    UNIQUE (user_id, channel)
);
```

---

## 5.13 Audit Trail

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,          -- e.g. "view", "create", "update", "delete", "export", "reveal_credential"
    resource_type VARCHAR(100) NOT NULL,   -- e.g. "finding", "engagement", "credential"
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
```

---

## DeTT&CT Ingestion (5.4 external job output)

```sql
CREATE TABLE dettct_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    output_file_path VARCHAR(500) NOT NULL,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    imported_at TIMESTAMPTZ
);
```

---

## Notes

- All `UUID` PKs assume Ghostwriter's own tables (users, and any it already has for evidence/reporting if reused) may use integer PKs — reconcile FK types against whatever Ghostwriter actually uses before migrating; don't assume UUID everywhere without checking.
- `credentials.secret_encrypted` and `sentinel_connections.api_key_encrypted` should use application-layer encryption (e.g. Django's `django-cryptography` or a KMS-backed field), not rely on `pgcrypto` alone.
- `note_embeddings.embedding` dimension (`1536` here) is a placeholder — set it to match whatever embedding model ships with the DeepSeek V4 integration once that's finalized (PRD open question).
- Run `EXPLAIN ANALYZE` on the `ivfflat` vector index once you have a realistic number of notes (a few hundred+) — index tuning (`lists` parameter) matters more as the vault grows.
