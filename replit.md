# FinOps Autopilot - Enterprise Cloud Cost Optimization Platform

## Overview
FinOps Autopilot is a comprehensive cloud cost optimization platform for enterprises. It automates AWS resource analysis, identifies cost-saving opportunities, and provides actionable recommendations. The platform features real-time monitoring, automated analysis, executive dashboards with approval workflows, and integrates FinOps best practices to reduce cloud spending through automated insights and human oversight.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript (Vite)
- **UI**: Shadcn/ui (Radix UI), Tailwind CSS
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Real-time**: WebSocket connection
- **HTTP Caching**: Properly handles HTTP 304 (Not Modified) responses as success (November 2025 fix)
  - Frontend error handler treats 304 status codes as valid cache hits
  - Prevents false "Server error" messages on cached API responses

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM)
- **ORM**: Drizzle ORM
- **API**: RESTful with WebSocket support
- **Session Management**: Express sessions (PostgreSQL store)
- **Background Processing**: Node-cron for scheduled tasks

### Data Storage
- **Primary Database**: PostgreSQL (Supabase - migrated November 2025)
- **Connection**: Uses SUPABASE_DATABASE_URL environment variable (pooled connection on port 5432)
- **Schema Management**: Drizzle migrations
- **Models**: Users, AWS resources, cost reports, recommendations, approval workflows
- **Migration Notes**:
  - Migrated from Replit's Neon database to Supabase (November 2025)
  - All environments (development, preview, production) use single Supabase database
  - Schema fixes applied: optimization_history table columns (execution_date, before_config, after_config, slack_message_id)

### Authentication & Authorization
- **Authentication**: JWT-based with localStorage persistence
- **JWT TTL**: 2 hours with automatic expiration
- **Authorization**: Role-based access control (admin, user)
- **Registration**: Secure registration with role selection (admin/user)
- **Login UI**: Dedicated authentication page with tabbed login/register interface
- **Auth Guard**: Frontend route protection with automatic redirect to login
- **Workflows**: Multi-stage approval for high-impact optimizations

### Enterprise Security (Phase 2 Complete)
- **Security Headers**: 
  - Strict-Transport-Security (HSTS) with max-age 1 year, includeSubDomains
  - X-Frame-Options: DENY (clickjacking protection)
  - X-Content-Type-Options: nosniff (MIME sniffing protection)
  - Content-Security-Policy (CSP) with strict directives
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control
- **CORS Hardening**: 
  - Production fail-closed (requires ALLOWED_ORIGINS env var)
  - Rejects wildcard origins (*) in production
  - Startup validation fails-fast if misconfigured
  - Development mode allows localhost origins only
- **Session Timeout Enforcement**:
  - 2-hour maximum session age (iat-based)
  - Hard JWT expiration validation (exp check)
  - Applied to both REST API and WebSocket connections
  - Warning headers when token expiring <15 min (X-Token-Expiring-Soon, X-Token-Expires-In)
  - Middleware ordering: authenticateToken → enforceSessionTimeout → audit → handler
- **Audit Logging**:
  - 13+ critical endpoints logged (auth, recommendations, approvals, system config)
  - Imperative logging in 4 complex workflows (approval, optimization, batch operations)
  - Captures: userId, action, resourceType, resourceId, metadata, IP, user agent
  - Asynchronous non-blocking writes (does not impact request latency)
  - Only logs successful operations (2xx responses)
- **Database Transactions**:
  - Atomic operations for recommendation approval and optimization execution
  - Retry logic with exponential backoff (3 retries)
  - Automatic rollback on failure
  - Transaction helpers: handleApprovalTransaction, handleOptimizationExecutionTransaction
- **API Rate Limiting**:
  - Auth endpoints: 5 requests/min (login, register)
  - General API: 100 requests/min
  - Write operations: 30 requests/min
  - Read operations: 60 requests/min
  - Per-IP enforcement with memory store
- **WebSocket Security**:
  - JWT authentication via query parameter
  - Session age validation (2-hour limit)
  - Token expiration check during connection
  - Rejects stale sessions with code 1008 (Policy Violation)
  - Connection refused for expired/invalid tokens
- **Production Safety**:
  - JWT_SECRET required at startup (32+ chars minimum)
  - Fail-fast validation for missing/weak secrets
  - Password hashing with bcrypt (10 rounds)
  - Multi-tenant isolation via tenantId (COMPLETE)
  - Circuit breakers and health check endpoints
- **AWS Credential Safety** (November 2025):
  - Lazy initialization - AWS SDK clients only instantiated when credentials available
  - Credential validation before SDK initialization (checks AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
  - All AWS methods guarded with initializeClients() including helper methods
  - Preview/dev deployments without AWS credentials run error-free in simulation mode
  - Clear error messages when AWS methods called without proper credentials

### Multi-Tenancy Architecture (Complete)
- **Database Layer**:
  - tenantId column on all 9 user-scoped tables (NOT NULL, no defaults)
  - Composite indexes for tenant-scoped queries (tenantId + createdAt/status/reportDate)
  - Default tenant: 'default-tenant' for system operations
- **Storage Layer**:
  - All create/read/update/delete methods require tenantId parameter
  - All queries filter by tenantId using WHERE clauses
  - Pattern: `where(and(eq(table.id, id), eq(table.tenantId, tenantId)))`
- **API Layer**:
  - All authenticated endpoints extract tenantId from JWT (req.user?.tenantId)
  - Fail with 401 if tenantId missing (except login/register)
  - No 'default-tenant' fallbacks in authenticated routes
- **Background Services**:
  - SYSTEM_TENANT_ID = 'default-tenant' constant
  - All storage calls explicitly pass SYSTEM_TENANT_ID
  - scheduler.ts and data-generator.ts properly scoped
- **Security Impact**:
  - Complete tenant data isolation enforced
  - No cross-tenant data leakage possible
  - Both READ and WRITE paths secured
  - JWT payload includes tenantId for all requests

### Real-time Communication
- **WebSocket Server**: Integrated for dashboard updates
- **Event Broadcasting**: Notifications for recommendations and optimization completions
- **Client Synchronization**: Automatic UI updates via query invalidation

### autonomOS Platform Integration
- **Client**: `aosClient.ts` for platform interactions
- **APIs**: `getView()` for data, `postIntent()` for actions
- **Task Polling**: Automatic status polling
- **Feature Flag**: `VITE_USE_PLATFORM` for enabling/disabling
- **HITL Safety**: Recommendations map to `explain_only: true, dry_run: true`
- **Idempotency**: Unique keys for intent executions
- **Approval Integration**: Platform intents sent on recommendation approval

### Dashboard Structure
- **Executive Dashboard**: Comprehensive financial overview (Monthly/YTD Spend, Identified/Realized Savings, Waste Optimized %). Auto-refreshes every 10 seconds.
- **Operations Dashboard**: Integrates metrics into a Data Flow Pipeline visualization, combining financial KPIs and operational telemetry. Auto-refreshes every 3 seconds.

### AI History Drill-Down & Execution Mode Transparency (November 2025)
- **Database Schema**:
  - Added `aiModeHistoryId` field to recommendations table (nullable, links recommendations to AI analysis runs)
  - Added `calculationMetadata` jsonb field for calculation transparency (resourceMonthlyCost, savingsPercentage, methodology)
  - Composite index on tenantId + aiModeHistoryId for efficient drill-down queries
- **Drill-Down Modal**:
  - AI history cards on Executive Dashboard are now clickable
  - Opens detailed modal with three tabs: Overview, Recommendations, Calculations
  - Overview tab: Shows run status, timestamps, total savings, execution mode distribution (autonomous % vs HITL %)
  - Recommendations tab: Lists all recommendations from that AI run with execution mode badges
  - Calculations tab: Displays savings breakdown by type (rightsizing, scheduling, storage-tiering) and methodology transparency
- **Execution Mode Filters**:
  - Filter chips on Dashboard Recommendations Panel: All, Autonomous, HITL, Pending
  - Active filter highlighted with accent color
  - Filters top 6 priority recommendations by execution mode and status
- **Enhanced Execution Mode Badges**:
  - ✅ Auto-Executed (emerald) - autonomous recommendations that were executed
  - ✅ Auto-Optimized (emerald) - autonomous recommendations pending execution
  - 🕒 Needs Approval (amber) - HITL recommendations requiring approval
  - ⏳ Awaiting Execution (indigo) - HITL recommendations approved and awaiting execution
- **Config Status Banner**:
  - Warning banner appears when autonomous mode is disabled
  - Shows: "⚠️ Autonomous Mode Disabled - All recommendations require manual approval"
  - Only displays when autonomousMode=false AND pending recommendations exist
- **Backend API Enhancement**:
  - GET /api/ai-mode-history/:id - Returns complete drill-down data (AI run, recommendations, savings breakdown, execution mode counts)
  - Storage computes savings aggregations: totalSavings, averageSavings, savingsByType, executionModeCounts
  - All AI-generated recommendations include calculation metadata for full transparency

### Automatic Initialization & Production Deployment (November 2025)
- **Configuration**:
  - Database default: `agent.simulation_mode='true'` in system_config table
  - Code default: `simulationMode: true` in ConfigService initialization (server/services/config.ts line 125)
  - No environment variable required - uses database configuration as single source of truth
- **Fresh Deployment Behavior**:
  - On startup with empty database, automatically generates:
    - 6 synthetic AWS resources (EC2, RDS, Redshift clusters)
    - 6 months of historical cost data (cost_reports table)
    - Initial recommendation dataset with 80/20 autonomous/HITL distribution
  - Starts continuous 3-second simulation loop
  - Generates 2-5 new recommendations per cycle
  - Auto-executes autonomous recommendations in background
- **Production Safety**:
  - Only generates data when `cost_reports.length === 0` (prevents duplicate data)
  - Preserves existing data on restarts
  - Simulation mode can be toggled via database config UI (Settings page)
  - **Three-Layer Defense Against CredentialsError** (November 2025):
    - **Layer 1 - Initialization Order**: Scheduler cron jobs deferred until after config initialization completes (prevents race condition during bootstrap)
    - **Layer 2 - Environment Variable Failsafe**: All cron callbacks check `SIMULATION_MODE` env var synchronously before calling AWS APIs (bootstrap protection)
    - **Layer 3 - AWS Service Centralized Guard**: `isReady()` method validates client availability across ALL AWS methods (never throws on read operations)
    - All AWS service methods use centralized `isReady()` guard - returns safe fallbacks when clients unavailable
    - Helper methods can safely call other helpers without re-throwing initialization errors
    - Mutating operations (resize, delete) throw descriptive errors when clients unavailable
    - Preview deployments work reliably without AWS credentials when `SIMULATION_MODE=true`

### Performance Optimizations
- **AI/RAG**: Gemini 2.0 Flash, Pinecone vector database for RAG, 5-minute TTL cache, Gemini text-embedding-004.
- **Continuous Simulation**: High-velocity demo mode (3-second cycles), random resource utilization adjustments, 10x monetary multiplier for enterprise scale.
- **Heuristic Recommendation Engine**: Runs every 3 seconds, generates 2-5 recommendations (Rightsizing, scheduling, storage-tiering), 80% autonomous / 20% HITL risk distribution.
- **HITL vs Autonomous Labeling**: Recommendations tagged with `executionMode` ("autonomous" or "hitl"), visual badges, and dashboard widget showing 80/20 execution split.
- **Currency Formatting**: Hybrid `formatCurrencyK` utility for smart, whole-number display (e.g., "$71", "$260 K").
- **Database**: BIGINT for monetary fields, vector-based RAG, PostgreSQL for core data, optimized queries with indexing and minimal data transfer.

## External Dependencies

### Cloud Services
- **AWS SDK v2**: AWS service integration
- **Supabase**: PostgreSQL database hosting (migrated from Neon November 2025)
- **AWS Cost Explorer**: Cost analysis
- **AWS CloudWatch**: Utilization metrics
- **AWS Trusted Advisor**: Optimization recommendations

### Third-party Integrations
- **Pinecone**: Vector database for RAG
- **Slack Web API**: Notifications
- **AWS Support API**: Enhanced recommendation data

### Development
- **Replit Platform**: Development environment