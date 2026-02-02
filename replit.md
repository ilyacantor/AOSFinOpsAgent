# FinOps Autopilot

**Enterprise Cloud Cost Optimization Platform**

## Overview

FinOps Autopilot is an intelligent platform designed to automatically identify and act on cloud cost-saving opportunities within AWS environments. Its primary purpose is to reduce AWS cloud spending by 20-40% through continuous monitoring, intelligent recommendations, and automated or human-approved execution of optimizations. It serves as an operational tool for FinOps practitioners, prioritizing quick approval and action on cost-saving measures. The project aims to provide comprehensive cloud cost management, balancing automation efficiency with necessary human oversight for high-risk changes.

## User Preferences

- **Communication Style**: Simple, everyday language
- **Documentation**: Focus on functional capabilities over technical details
- **Error Messages**: Clear, actionable guidance

## System Architecture

FinOps Autopilot uses a modern full-stack architecture.

**UI/UX Decisions:**
The user interface features a consolidated dashboard with an "Action Required" hero section highlighting pending approvals and estimated savings. It includes priority recommendation panels, system status visualization, and a navigation sidebar with a red badge indicating pending actions. Real-time updates via WebSockets ensure data freshness.

**Technical Implementations:**
- **Automated Cost Analysis:** Continuously scans AWS resources (EC2, RDS, Redshift) for underutilization and waste detection, tracking spending trends.
- **Intelligent Recommendations:** Generates actionable suggestions for rightsizing, scheduling, and storage tiering, prioritized by potential savings.
- **Dual Execution Mode:** Supports both autonomous execution for low-risk changes and Human-in-the-Loop (HITL) for high-risk changes, requiring manual approval.
- **Approval Workflows:** Manages review, approval, and execution stages for HITL recommendations, including approval history and Slack notifications.
- **AI-Powered Analysis (Optional):** Utilizes Gemini 2.0 Flash and RAG (Retrieval-Augmented Generation) with Pinecone to identify advanced optimization opportunities and provide calculation transparency.
- **Simulation Mode:** Allows full platform functionality with synthetic data for demos, development, and testing without AWS credentials.
- **Real-Time Updates:** Employs WebSocket for instant dashboard updates and notification broadcasting.
- **Multi-Tenant Support:** Ensures secure data isolation between different organizations/teams using JWT-based identification.
- **Security Features:** Implements JWT-based authentication, secure password hashing, role-based access control, enterprise security headers, API rate limiting, audit logging, and encrypted connections.

**Frontend Stack:**
- React 18 with TypeScript (Vite)
- Shadcn/ui (Radix UI + Tailwind CSS)
- TanStack Query for data fetching
- Wouter for routing

**Backend Stack:**
- Node.js with Express.js
- TypeScript (ESM modules)
- Drizzle ORM for database operations
- Node-cron for scheduled tasks

**Database:**
- PostgreSQL (Replit's built-in, Supabase, or Neon serverless)
- Automatic driver selection based on environment variables.

## External Dependencies

- **AWS SDK v2:** For integration with AWS services (Cost Explorer, CloudWatch, Trusted Advisor).
- **PostgreSQL:** Primary database (can be Replit's built-in, Supabase, or Neon).
- **Gemini 2.0 Flash:** Google's AI model for intelligent analysis and recommendation generation.
- **Pinecone:** Vector database for Retrieval-Augmented Generation (RAG).
- **Slack:** For sending notifications regarding new recommendations, approvals, and status updates.