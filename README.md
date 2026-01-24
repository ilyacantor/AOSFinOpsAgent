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
- **Authentication**: Session-based
- **Authorization**: Role-based access (admin, user, CFO)
- **Workflows**: Multi-stage approval for high-impact optimizations

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
- **AI/RAG**: Gemini 2.5 Flash, Pinecone vector database for RAG, 5-minute TTL cache, Gemini text-embedding-004.
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
