# Vanguard ↔ Sentinel Integration Contract

**Version**: 1.0  
**Scope**: Service-to-service API for Red Team operations dashboard (Vanguard) to communicate with SOC middleware (Sentinel).  
**Auth**: 2 scoped Bearer tokens — READ (`soc/*`), WRITE (`redteam/*`).  
**Transport**: HTTPS, JSON request/response.  
**Idempotency**: All `POST` endpoints **must** accept `Idempotency-Key` header (UUID v4) and deduplicate within 24h.

---

## 1. Authentication

| Key Name | Scope | Endpoints |
|---|---|---|
| `SENTINEL_API_KEY_READ` | `soc:*` | `GET /api/v1/soc/alerts`, `GET /api/v1/soc/assets/{id}`, `GET /api/v1/soc/rule-requests/{id}/status` |
| `SENTINEL_API_KEY_WRITE` | `redteam:*` | `POST /api/v1/redteam/actions`, `POST /api/v1/redteam/findings`, `POST/PATCH /api/v1/redteam/engagements`, `POST /api/v1/redteam/rule-requests`, `POST /api/v1/redteam/rule-requests/{id}/retest` |

**Header**: `Authorization: Bearer <key>`  
**Key format**: 32+ char random string (Vanguard generates, stores in Settings → Integrations).  
**Rotation**: Support multiple active keys per scope (comma-separated in env) for zero-downtime rotation.

---

## 2. Error Envelope (All Endpoints)

```json
{
  "error": "string",        // machine-readable code
  "message": "string",      // human-readable
  "detail": {}              // optional structured detail
}
```

| HTTP | Error Code | When |
|---|---|---|
| 400 | `validation_error` | Request body invalid (Pydantic detail in `detail`) |
| 401 | `unauthorized` | Missing/invalid Bearer token |
| 403 | `forbidden` | Valid token but wrong scope |
| 404 | `not_found` | Resource doesn't exist |
| 409 | `conflict` | Idempotency key already processed with different payload |
| 422 | `unprocessable` | Business rule violation (e.g., rule request not in `pending_review`) |
| 429 | `rate_limited` | Too many requests (include `Retry-After` header) |
| 500 | `internal_error` | Unexpected server error |
| 503 | `service_unavailable` | Downstream dependency down (ES, DB) |

---

## 3. Endpoint Specifications

### 3.1 GET /api/v1/health
**Scope**: None (public)  
**Purpose**: Liveness/readiness probe for Vanguard connection status indicator.

**Response 200**:
```json
{
  "status": "ok",
  "service": "sentinel",
  "version: "2.1.0",
  "checks": {
    "database": "ok",
    "elasticsearch": "ok"
  }
}
```
**Implementation**: Reuse existing `/health/ready` logic but strip auth requirement. Return 503 if DB or ES unhealthy.

---

### 3.2 POST /api/v1/redteam/actions
**Scope**: `redteam:write`  
**Purpose**: Push timeline entry from Vanguard engagement to Sentinel for correlation/alerting.

**Request**:
```json
{
  "engagement_id": "uuid",
  "asset_id": "uuid",
  "technique_id": "T1059.001",
  "timestamp": "2026-08-26T15:30:00Z",
  "action_description": "Executed PowerShell command",
  "outcome": "success",
  "metadata": { "command": "Get-Process", "pid": 1234 }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `engagement_id` | UUID | yes | Vanguard engagement UUID |
| `asset_id` | UUID | yes | Vanguard asset UUID (maps to Sentinel asset) |
| `technique_id` | string | yes | MITRE ATT&CK technique (e.g., `T1059.001`) |
| `timestamp` | ISO8601 | yes | When action executed |
| `action_description` | string | yes | Free text |
| `outcome` | enum | yes | `success` \| `failed` \| `partial` |
| `metadata` | object | no | Arbitrary JSON for context |

**Response 201**:
```json
{
  "id": "uuid",
  "accepted": true,
  "correlation_id": "uuid"
}
```

**Idempotency**: Dedupe on `(engagement_id, technique_id, timestamp)` — if duplicate key with same payload → return 200 with existing `id`. If different payload → 409.

**Sentinel Action**: Store in `sentinel_actions` table. Trigger async correlation job (background) that queries ES for matching alerts within ±5min window. Update `correlation_id` when done.

---

### 3.3 POST /api/v1/redteam/findings
**Scope**: `redteam:write`  
**Purpose**: Push finding from Vanguard to Sentinel for tracking/alert correlation.

**Request**:
```json
{
  "engagement_id": "uuid",
  "asset_id": "uuid",
  "severity": "high",
  "title": "Credential Dumping via LSASS",
  "description": "Mimikatz executed on DC01",
  "status": "open",
  "technique_ids": ["T1003.001"],
  "evidence": { "screenshot": "url", "logs": "..." }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `engagement_id` | UUID | yes | |
| `asset_id` | UUID | yes | |
| `severity` | enum | yes | `critical` \| `high` \| `medium` \| `low` \| `info` |
| `title` | string | yes | ≤200 chars |
| `description` | string | no | Markdown allowed |
| `status` | enum | yes | `open` \| `in_progress` \| `resolved` \| `false_positive` |
| `technique_ids` | string[] | no | MITRE IDs |
| `evidence` | object | no | Arbitrary |

**Response 201**:
```json
{
  "id": "uuid",
  "accepted": true
}
```

**Idempotency**: Dedupe on `(engagement_id, title, asset_id)`.

**Sentinel Action**: Store in `sentinel_findings` table. Link to asset for enrichment queries.

---

### 3.4 POST /api/v1/redteam/engagements  
### 3.5 PATCH /api/v1/redteam/engagements/{id}
**Scope**: `redteam:write`  
**Purpose**: Sync engagement scope (create or update).

**Request (POST body / PATCH body)**:
```json
{
  "name": "Internal Network Assessment",
  "description": "Q3 2026 red team engagement",
  "start_date": "2026-07-01",
  "end_date": "2026-09-30",
  "scope_assets": ["10.0.0.0/8", "192.168.1.0/24"],
  "scope_exclusions": ["10.0.1.0/24"],
  "status": "active",
  "team_members": ["operator1", "operator2"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes (POST) | ≤100 chars |
| `description` | string | no | |
| `start_date` | date | no | ISO date |
| `end_date` | date | no | ISO date |
| `scope_assets` | string[] | no | CIDR or hostname list |
| `scope_exclusions` | string[] | no | CIDR or hostname list |
| `status` | enum | no | `planning` \| `active` \| `paused` \| `completed` |
| `team_members` | string[] | no | Usernames |

**Response 201 (POST) / 200 (PATCH)**:
```json
{
  "id": "uuid",
  "synced": true
}
```

**Idempotency (POST)**: Dedupe on `name` — if exists, return 200 with existing UUID (upsert behavior).  
**Sentinel Action**: Upsert into `sentinel_engagements`. Used for alert filtering in `/soc/alerts`.

---

### 3.6 GET /api/v1/soc/alerts
**Scope**: `soc:read`  
**Purpose**: Vanguard polls for alerts matching an asset/technique/time window to correlate with timeline entries (verdict).

**Query Parameters**:

| Param | Type | Required | Default | Notes |
|---|---|---|---|---|
| `asset` | string | yes | — | IP, hostname, or asset UUID |
| `from` | ISO8601 | no | 24h ago | Inclusive start |
| `to` | ISO8601 | no | now | Inclusive end |
| `severity` | enum | no | all | `critical`\|`high`\|`medium`\|`low`\|`info` |
| `technique_id` | string | no | — | MITRE ID filter |
| `limit` | int | no | 100 | Max 500 |
| `offset` | int | no | 0 | Pagination |

**Response 200**:
```json
{
  "alerts": [
    {
      "id": "uuid",
      "wazuh_id": "123456",
      "rule_id": "100001",
      "rule_name": "Suspicious PowerShell Execution",
      "severity": "high",
      "timestamp": "2026-08-26T15:30:05Z",
      "source_ip": "10.0.5.12",
      "destination_ip": "10.0.1.50",
      "technique_ids": ["T1059.001"],
      "matched_asset_id": "uuid",
      "ai_summary": "Alert triggered by encoded PowerShell command...",
      "detection_delay_seconds": 5
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

**Sentinel Action**: Query ES `wazuh-alerts-*` index. Join with `sentinel_engagements` for scope filtering. Enrich with AI summary if analysis exists. Map Wazuh level → severity. Extract MITRE IDs from rule tags or AI analysis.

---

### 3.7 GET /api/v1/soc/assets/{id}
**Scope**: `soc:read`  
**Purpose**: Asset enrichment for Vanguard asset detail panel.

**Path Param**: `id` = UUID (Sentinel asset UUID — Vanguard stores `sentinelAssetId` on its Asset model)

**Response 200**:
```json
{
  "id": "uuid",
  "name": "DC01",
  "ip_addresses": ["10.0.1.50"],
  "hostnames": ["dc01.corp.local"],
  "os": "Windows Server 2022",
  "criticality": "critical",
  "tags": ["domain-controller", "tier-0"],
  "last_seen": "2026-08-26T14:00:00Z",
  "open_alerts_count": 3,
  "vulnerabilities": [
    { "cve": "CVE-2021-42287", "severity": "high" }
  ]
}
```

**404** if not found.

**Sentinel Action**: Query internal asset registry (or ES if assets indexed there). Return latest known state.

---

### 3.8 POST /api/v1/redteam/rule-requests
**Scope**: `redteam:write`  
**Purpose**: Submit draft Wazuh rule from Vanguard Gap Report for SOC review.

**Request**:
```json
{
  "engagement_id": "uuid",
  "finding_id": "uuid",
  "technique_id": "T1003.001",
  "rule_json": {
    "rule": {
      "id": 100999,
      "level": 12,
      "description": "Credential Dumping - LSASS Memory Access",
      "group": "attack_credential_access",
      "mitre": { "id": "T1003.001", "tactic": "credential-access" }
    }
  },
  "rationale": "Observed Mimikatz in engagement XYZ. No existing rule covers this variant.",
  "priority": "high"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `engagement_id` | UUID | yes | |
| `finding_id` | UUID | yes | Links to Vanguard finding |
| `technique_id` | string | yes | MITRE ID |
| `rule_json` | object | yes | Full Wazuh rule definition (passthrough) |
| `rationale` | string | yes | Why this rule is needed |
| `priority` | enum | no | `critical` \| `high` \| `medium` \| `low` |

**Response 201**:
```json
{
  "id": "uuid",
  "status": "pending_review",
  "submitted_at": "2026-08-26T15:30:00Z"
}
```

**Idempotency**: Dedupe on `(engagement_id, finding_id, technique_id)` — return existing if duplicate.

**Sentinel Action**: 
1. Insert into `sentinel_rule_requests` with status `pending_review`.
2. Create audit log entry.
3. (Optional) Notify SOC via email/Slack.

---

### 3.9 GET /api/v1/soc/rule-requests/{id}/status
**Scope**: `soc:read`  
**Purpose**: Vanguard polls this to update local rule request status.

**Path Param**: `id` = UUID (rule request ID from POST response)

**Response 200**:
```json
{
  "id": "uuid",
  "status": "approved",
  "status_changed_at": "2026-08-27T10:00:00Z",
  "approved_by": "soc-analyst-1",
  "deployed_at": "2026-08-27T10:15:00Z",
  "deployed_by": "soc-admin-1",
  "wazuh_rule_id": 100999,
  "rejection_reason": null,
  "verification_status": null
}
```

| Status | Meaning |
|---|---|
| `pending_review` | Awaiting SOC triage |
| `approved` | SOC approved, not yet deployed |
| `deployed` | Rule deployed to Wazuh |
| `rejected` | SOC rejected (see `rejection_reason`) |
| `verified` | Vanguard retested → detection confirmed |
| `verify_failed` | Vanguard retested → still not detected |

**404** if not found.

---

### 3.10 POST /api/v1/redteam/rule-requests/{id}/retest
**Scope**: `redteam:write`  
**Purpose**: Vanguard submits retest result after rule deployed.

**Path Param**: `id` = UUID (rule request ID)

**Request**:
```json
{
  "verdict": "verified",
  "tested_at": "2026-08-28T09:00:00Z",
  "test_details": "Executed Mimikatz on DC01. Alert ALT-ABC123 generated within 30s.",
  "alert_id": "ALT-ABC123"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `verdict` | enum | yes | `verified` \| `verify_failed` |
| `tested_at` | ISO8601 | yes | When retest executed |
| `test_details` | string | yes | What was tested, outcome |
| `alert_id` | string | no | Wazuh alert ID if detected |

**Response 200**:
```json
{
  "id": "uuid",
  "status": "verified",
  "verified_at": "2026-08-28T09:05:00Z"
}
```

**Business Rule**: Only allowed if current status is `deployed`. Otherwise 422 `unprocessable`.

**Sentinel Action**: Update `sentinel_rule_requests` status to `verified` or `verify_failed`. Audit log.

---

## 4. Rule Request Lifecycle

```
draft (Vanguard) 
  → submit → pending_review (Sentinel)
    → approve → approved (Sentinel)
      → deploy → deployed (Sentinel)
        → retest verified → verified (Vanguard + Sentinel)
        → retest verify_failed → verify_failed (Vanguard + Sentinel) → back to draft in Vanguard
    → reject → rejected (Sentinel) → terminal
```

**Sentinel-owned transitions**: `pending_review → approved`, `approved → deployed`, `pending_review → rejected`  
**Vanguard-owned transitions**: `draft → pending_review` (submit), `deployed → verified/verify_failed` (retest)

**Audit fields on `sentinel_rule_requests`**:
- `submitted_by` (Vanguard key fingerprint)
- `approved_by` (Sentinel user)
- `deployed_by` (Sentinel user)
- `rejection_reason` (text, nullable)
- `verified_at`, `verify_failed_at` (timestamps)

---

## 5. Database Schema (New Tables)

### 5.1 `sentinel_actions`
```sql
CREATE TABLE sentinel_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    technique_id VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    action_description TEXT NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    metadata JSONB DEFAULT '{}',
    correlation_id UUID,
    idempotency_key VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sentinel_actions_engagement ON sentinel_actions(engagement_id);
CREATE INDEX idx_sentinel_actions_asset_time ON sentinel_actions(asset_id, timestamp);
```

### 5.2 `sentinel_findings`
```sql
CREATE TABLE sentinel_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    technique_ids TEXT[] DEFAULT '{}',
    evidence JSONB DEFAULT '{}',
    idempotency_key VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sentinel_findings_engagement ON sentinel_findings(engagement_id);
```

### 5.3 `sentinel_engagements`
```sql
CREATE TABLE sentinel_engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vanguard_id UUID UNIQUE,  -- Vanguard's engagement UUID
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    scope_assets TEXT[] DEFAULT '{}',
    scope_exclusions TEXT[] DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'planning',
    team_members TEXT[] DEFAULT '{}',
    idempotency_key VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.4 `sentinel_rule_requests`
```sql
CREATE TABLE sentinel_rule_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL,
    finding_id UUID NOT NULL,
    technique_id VARCHAR(20) NOT NULL,
    rule_json JSONB NOT NULL,
    rationale TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
    submitted_by VARCHAR(64),      -- key fingerprint
    approved_by VARCHAR(100),
    deployed_by VARCHAR(100),
    rejection_reason TEXT,
    wazuh_rule_id INTEGER,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verify_failed_at TIMESTAMPTZ,
    idempotency_key VARCHAR(64) UNIQUE
);
CREATE INDEX idx_sentinel_rr_engagement ON sentinel_rule_requests(engagement_id);
CREATE INDEX idx_sentinel_rr_status ON sentinel_rule_requests(status);
```

### 5.5 `sentinel_audit_log` (append-only for rule request lifecycle)
```sql
CREATE TABLE sentinel_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_request_id UUID NOT NULL REFERENCES sentinel_rule_requests(id),
    action VARCHAR(50) NOT NULL,  -- approved, deployed, rejected, verified, verify_failed
    actor VARCHAR(100) NOT NULL,  -- user or key fingerprint
    detail JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Idempotency Implementation Guide

**Header**: `Idempotency-Key: <uuid>` (required on all POST)

**Server behavior**:
1. On POST, check if `idempotency_key` exists in target table.
2. If exists:
   - Compare request body hash (SHA256 of canonical JSON).
   - Same hash → return 200/201 with stored response.
   - Different hash → return 409 `conflict`.
3. If not exists:
   - Process request.
   - Store `idempotency_key` + request hash + response.
   - Return response.
4. TTL: 24 hours (cleanup job).

**Vanguard retry policy**: Exponential backoff (1s, 2s, 4s, 8s, max 30s) + jitter. Retry on 429, 5xx, network error. Max 5 attempts.

---

## 7. Environment Variables (Add to Sentinel `.env`)

```bash
# Vanguard Integration Keys (comma-separated for rotation)
SENTINEL_API_KEY_READ=sk-read-abc123...,sk-read-def456...
SENTINEL_API_KEY_WRITE=sk-write-xyz789...,sk-write-uvw012...

# Optional: Vanguard callback base URL (for future webhooks)
VANGUARD_BASE_URL=https://vanguard.internal
```

**Key generation** (run once):
```bash
openssl rand -hex 32  # produces 64-char key
```

---

## 8. Implementation Checklist (Priority Order)

### Phase 1 — Foundation (do first)
- [ ] Add env vars + validation in `app/core/config.py`
- [ ] Create 4 new SQLAlchemy models + Alembic migration
- [ ] Add API key auth dependency (`get_api_key(scope: str)`) in `app/api/deps.py`
- [ ] Add `Idempotency-Key` middleware/dependency

### Phase 2 — Read Endpoints (unblock Vanguard polling)
- [ ] `GET /api/v1/health` (strip auth from existing `/health/ready`)
- [ ] `GET /api/v1/soc/alerts` — ES query with filters, join engagements
- [ ] `GET /api/v1/soc/assets/{id}` — asset registry query
- [ ] `GET /api/v1/soc/rule-requests/{id}/status` — simple lookup

### Phase 3 — Write Endpoints (unblock Vanguard push)
- [ ] `POST /api/v1/redteam/engagements` (upsert by name)
- [ ] `PATCH /api/v1/redteam/engagements/{id}`
- [ ] `POST /api/v1/redteam/actions` + background correlation job
- [ ] `POST /api/v1/redteam/findings`
- [ ] `POST /api/v1/redteam/rule-requests` + audit log
- [ ] `POST /api/v1/redteam/rule-requests/{id}/retest` + status transition guard

### Phase 4 — Polish
- [ ] Rate limiting per key (different limits read vs write)
- [ ] Request/response logging (structured)
- [ ] OpenAPI tags: `vanguard-read`, `vanguard-write`
- [ ] Integration test suite (pytest) covering all 9 endpoints + idempotency

---

## 9. Testing Quick Reference

**Health probe**:
```bash
curl -s https://sentinel.internal/api/v1/health | jq .status
# → "ok"
```

**Read alerts (READ key)**:
```bash
curl -H "Authorization: Bearer $SENTINEL_API_KEY_READ" \
  "https://sentinel.internal/api/v1/soc/alerts?asset=10.0.1.50&from=2026-08-25T00:00:00Z" | jq
```

**Push action (WRITE key)**:
```bash
curl -X POST -H "Authorization: Bearer $SENTINEL_API_KEY_WRITE" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"engagement_id":"...","asset_id":"...","technique_id":"T1059.001","timestamp":"2026-08-26T15:30:00Z","action_description":"test","outcome":"success"}' \
  https://sentinel.internal/api/v1/redteam/actions | jq
```

---

## 10. Vanguard Configuration (Reference)

Vanguard Settings → Integrations will store:
- `base_url` (e.g., `https://sentinel.internal`)
- `read_key` (maps to `SENTINEL_API_KEY_READ`)
- `write_key` (maps to `SENTINEL_API_KEY_WRITE`)

Vanguard will call "Test Connection" → `GET /api/v1/health` (no auth) → then `GET /api/v1/soc/alerts?asset=...` with read key to verify scoped auth works.

---

**End of Contract** — This document is the single source of truth for Vanguard↔Sentinel integration. Any changes require updating both this file and Vanguard's integration client in lockstep.