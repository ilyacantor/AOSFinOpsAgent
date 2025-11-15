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

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM)
- **ORM**: Drizzle ORM
- **API**: RESTful with WebSocket support
- **Session Management**: Express sessions (PostgreSQL store)
- **Background Processing**: Node-cron for scheduled tasks

### Data Storage
- **Primary Database**: PostgreSQL (Neon serverless)
- **Schema Management**: Drizzle migrations
- **Models**: Users, AWS resources, cost reports, recommendations, approval workflows

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
- **Neon Database**: Serverless PostgreSQL hosting
- **AWS Cost Explorer**: Cost analysis
- **AWS CloudWatch**: Utilization metrics
- **AWS Trusted Advisor**: Optimization recommendations

### Third-party Integrations
- **Pinecone**: Vector database for RAG
- **Slack Web API**: Notifications
- **AWS Support API**: Enhanced recommendation data

### Development
- **Replit Platform**: Development environment