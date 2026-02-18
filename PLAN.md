# FinOps Autopilot — Gap Assessment, Testing & Code Quality Plan

## Phase 1: Gap Assessment (Expansion Spec vs Implementation)

### 1A. Schema/Data Model Gap Analysis
Compare `shared/schema.ts` against the expansion spec's schema requirements:
- Resource type enum coverage (spec lists 11 types — verify all present)
- Recommendation type enum coverage (spec lists termination, migration, cleanup, configuration — verify mapping)
- `resourceMetrics` table (spec calls for dedicated metrics table — check if exists or folded into JSONB)
- Metadata JSONB typing (spec defines EC2Metadata, EBSVolumeMetadata, etc. — check type safety)
- Tags JSONB column presence on resources
- Index coverage per spec

### 1B. Detection Engine Gap Analysis
Compare `server/services/scheduler.ts` heuristic engine against spec's 30+ detection patterns:
- **EC2**: idle (<5% CPU 14d), oversized (CPU<20% AND mem<20% 7d), old-gen (m4/c4/r4/t2), Spot candidates, stopped+EBS
- **EBS**: unattached, gp2→gp3, oversized (<20% used), old snapshots (>90d), orphaned snapshots
- **RDS**: idle (0 connections 7d), oversized (CPU<20% 14d), single-AZ prod, old-gen (db.m4/r4/t2), unencrypted
- **Network**: unattached EIPs, idle NAT (<1GB/day 7d), idle LBs (0 requests 7d), oversized NAT
- **S3**: no lifecycle, Standard→Intelligent Tiering, incomplete multipart, empty buckets
- **Lambda**: over-provisioned memory (<50%), unused (0 invocations 30d), x86→ARM
- **Redshift**: idle (0 connections 7d), oversized (CPU<20%), no pause schedule

For each: does detection exist? Is the threshold correct? Is savings calculation accurate?

### 1C. Simulation Data Gap Analysis
Compare `server/services/data-generator.ts` and `synthetic-data.ts` against spec requirements:
- 2 unattached EBS volumes (waste)
- 3 gp2 volumes (migration candidates)
- 5 old snapshots > 90 days
- 2 unattached Elastic IPs
- 1 idle NAT gateway
- 2 Lambda functions (1 over-provisioned, 1 unused)
- 1 S3 bucket without lifecycle policy
- Realistic naming (vol-0a1b2c3d format)
- Realistic costs ($3.65 EIP, $50-500 volumes)

### 1D. Risk Classification Gap Analysis
Compare HITL router against spec:
- Low (auto): unattached EBS, old snapshots, Elastic IPs, gp2→gp3
- Medium (HITL recommended): rightsizing, NAT changes, idle LBs
- High (always HITL): RDS, Redshift, production-tagged
- Info (no action): compliance flags, suggestions

### 1E. Frontend Gap Analysis
Check dashboard against user stories:
- Resource panel shows all 11+ types
- Recommendation cards show new types (EBS, snapshot, EIP, etc.)
- KPI cards reflect expanded data
- Filters work for new resource/recommendation types

---

## Phase 2: Functional Testing Against User Stories

Build a self-running test harness (no HITL) that validates each story programmatically.

### Story 1: "New Resource Types Appear in Dashboard"
- **Test**: Hit `GET /api/aws-resources`, verify count >= 20
- **Test**: Verify resource types include EBS, EBS_Snapshot, ElasticIP, NATGateway, LoadBalancer, S3, Lambda
- **Test**: Hit dashboard metrics endpoint, verify resource counts

### Story 2: "More Savings Identified"
- **Test**: Hit `GET /api/recommendations`, verify recommendations exist for new types
- **Test**: Verify recommendation types include delete-unattached, release-eip, snapshot-cleanup, volume-rightsizing, lambda-rightsizing, storage-tiering, nat-consolidation, lb-consolidation
- **Test**: Verify projectedMonthlySavings > 0 for each

### Story 3: "Low-Risk Items Auto-Execute"
- **Test**: Enable autonomous mode via `POST /api/agent-config/autonomous-mode`
- **Test**: Wait for heuristic cycle (3 seconds)
- **Test**: Verify recommendations with risk <= 5 have status='executed'
- **Test**: Verify optimizationHistory records created
- **Test**: Verify "Realized Savings" in metrics > 0

### Story 4: "High-Risk Items Wait for Approval"
- **Test**: Verify recommendations with risk > 5 have executionMode='hitl'
- **Test**: Verify approvalRequests created for HITL recommendations
- **Test**: Test approve flow: PATCH approval → verify recommendation status changes
- **Test**: Test reject flow: PATCH rejection → verify recommendation status changes

### Story 5: "Waste Percentage Improves Over Time"
- **Test**: Record initial waste % from metrics
- **Test**: Wait for autonomous execution cycle
- **Test**: Re-check waste % — should be lower (or realized savings higher)

### Story 6: "Simulation Creates Realistic Waste Patterns"
- **Test**: Verify resource IDs match AWS naming patterns (vol-, snap-, eipalloc-, nat-, etc.)
- **Test**: Verify cost values are realistic per resource type
- **Test**: Verify mix of healthy and wasteful resources
- **Test**: Verify date math on snapshots (>90 days old actually computes to >90)

---

## Phase 3: Code Quality Review

Systematic review of every significant file for:

### 3A. Monoliths
- `scheduler.ts` — 1150+ lines, mixes scheduling, detection, execution, and data generation
- `routes.ts` — all endpoints in one file
- `storage.ts` — all database operations in one file
- `gemini-ai.ts` — AI analysis + parsing + validation in one class

### 3B. Tech Debt
- Hardcoded magic numbers (thresholds, timeouts, intervals)
- Duplicate logic (autonomous checks in multiple places)
- Missing type safety (`any` types in recommendation configs)
- Configuration that should be database-driven but is in code

### 3C. Silent Killer Fallbacks
- Pinecone circuit breaker returns empty array silently
- AWS service returns empty on credential failures (no distinction)
- Error swallowing in async operations

### 3D. Hardcoded Shortcuts
- Risk level mapping dict in scheduler
- Savings percentage ranges in scheduler
- 5-minute prod mode auto-revert
- 2-hour session timeout
- 3-second simulation interval

### 3E. Missing Safety
- No rollback for failed autonomous execution
- No upper bound on recommendations per cycle
- No server-side session revocation
- No inactivity timeout
- Transaction retry limit (3) may be too tight

### 3F. Performance
- N+1 query patterns
- 12-month cost history regeneration on every sync
- No query result caching beyond configService
- RAG context cache only 5 minutes

---

## Execution Order

1. **Phase 1** (gap assessment) — read all files, document gaps in a structured report
2. **Phase 2** (testing) — build and run test harness, document pass/fail per story
3. **Phase 3** (code quality) — systematic review, document findings
4. **Deliverable** — comprehensive report with: gaps found, test results, code quality issues, prioritized fix recommendations

All findings will be programmatically verified — no subjective assessments without evidence.
