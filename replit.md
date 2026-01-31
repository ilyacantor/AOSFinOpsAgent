# FinOps Autopilot

**Enterprise Cloud Cost Optimization Platform**

Last Updated: January 2026

---

## What is FinOps Autopilot?

FinOps Autopilot is an intelligent platform that automatically finds ways to reduce your AWS cloud spending. It monitors your cloud resources 24/7, identifies waste, and either fixes problems automatically or asks for your approval before making changes.

**The core value proposition**: Reduce cloud costs by 20-40% through automated analysis and intelligent recommendations, while maintaining full control over high-risk changes.

**Target User**: FinOps practitioners who need to approve actions fast. This is an operational tool, not an executive reporting tool.

---

## Key Capabilities

### 1. Automated Cost Analysis

**What it does**: Continuously scans your AWS environment to find cost-saving opportunities.

- **Resource Monitoring**: Tracks EC2 instances, RDS databases, and Redshift clusters
- **Utilization Analysis**: Identifies underutilized resources (CPU, memory, storage)
- **Cost Tracking**: Monitors monthly and year-to-date spending trends
- **Waste Detection**: Calculates percentage of spend that could be optimized

**How it works**: Every 3 seconds (in simulation mode) or on configurable schedules (in production), the system analyzes resource utilization and generates optimization recommendations.

---

### 2. Intelligent Recommendations

**What it does**: Generates actionable recommendations to reduce costs.

**Three types of recommendations**:

| Type | What it does | Example |
|------|--------------|---------|
| **Rightsizing** | Suggests smaller instance types for underutilized resources | "Downsize i-abc123 from m5.xlarge to m5.large - saves $150/month" |
| **Scheduling** | Recommends stopping resources during off-hours | "Stop dev database outside business hours - saves $200/month" |
| **Storage Tiering** | Suggests moving data to cheaper storage classes | "Convert gp2 volume to gp3 - saves $50/month" |

**Smart prioritization**: Recommendations are ranked by estimated savings, making it easy to focus on high-impact changes first.

---

### 3. Dual Execution Mode (Autonomous vs Human-in-the-Loop)

**What it does**: Balances automation speed with human oversight for risky changes.

**Two execution modes**:

| Mode | Risk Level | Behavior | Example |
|------|------------|----------|---------|
| **Autonomous** | Low | Executes automatically without approval | Rightsizing a dev instance |
| **HITL (Human-in-the-Loop)** | High | Requires manual approval before execution | Modifying production database |

**Default distribution**: 80% autonomous / 20% HITL

**Why it matters**: Low-risk savings happen immediately, while high-risk changes get human review. You get the benefits of automation without sacrificing control.

---

### 4. Consolidated Dashboard

**What it does**: Provides a single action-focused view for FinOps practitioners.

**Dashboard Structure**:

```
┌─────────────────────────────────────────────────────────────┐
│  FinOps Autopilot                          [Prod Mode ○]    │
├─────────────────────────────────────────────────────────────┤
│  ACTION REQUIRED (N)          │  This Month                 │
│  ┌────────────────────────┐   │  ──────────────────────     │
│  │ 🔴 N pending approval  │   │  AWS Spend: $XXX            │
│  │    Est. savings: $XX/mo│   │  Realized Savings: $XXX     │
│  │    [Review Queue →]    │   │                             │
│  └────────────────────────┘   │  Agent Performance          │
│  ┌────────────────────────┐   │  ──────────────────────     │
│  │ Top pending items...   │   │  Auto-executed: XX          │
│  └────────────────────────┘   │  Reviewed: XX               │
│                               │  Last action: Xm ago        │
├─────────────────────────────────────────────────────────────┤
│  APPROVAL QUEUE (Priority Recommendations)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🔴 CRITICAL  RDS Right-Sizing      $52K/mo  [Review] │   │
│  │ 🟡 HIGH      Reduce EC2 Capacity   $4K/mo   [Review] │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  SYSTEM STATUS (Data Flow Pipeline)                         │
│  Input Sources → AI Processing → Output Results             │
└─────────────────────────────────────────────────────────────┘
```

**Key metrics displayed**:
- **Monthly Spend**: Current month's cloud costs
- **Realized Savings**: Actual savings from executed optimizations (YTD)
- **Pending Approval**: Count + sum of HITL recommendations awaiting approval
- **Agent Performance**: Auto-executed count, reviewed count
- **Last Action**: Timestamp showing when the agent last acted

**Dashboard features**:
- Auto-refreshes every 3 seconds
- Action Required hero section with pending queue preview
- Priority recommendations panel with filters
- Execution mode filters (All, Autonomous, HITL, Pending)
- System Status showing data flow pipeline
- Last action timestamp to show agent is working

---

### 5. Approval Workflows

**What it does**: Manages the review and approval process for HITL recommendations.

**Workflow stages**:
1. **Pending**: Recommendation awaiting review
2. **Approved**: Human approved, ready for execution
3. **Executed**: Change successfully applied
4. **Rejected**: Human declined the recommendation

**Features**:
- Multi-stage approval for high-impact changes
- Approval history tracking
- Execution status monitoring
- Slack notifications for new recommendations and completions
- Bulk approval button ("Approve All")

---

### 6. AI-Powered Analysis (Optional)

**What it does**: Uses advanced AI to find optimization opportunities that rule-based systems miss.

**Capabilities**:
- **Gemini 2.0 Flash**: Google's AI model for intelligent analysis
- **RAG (Retrieval-Augmented Generation)**: Combines AI with your historical data
- **Pattern Recognition**: Identifies usage patterns and trends
- **Calculation Transparency**: Shows exactly how savings were calculated

**When to use**: Enable "Production Mode" in settings for AI-powered recommendations instead of heuristic rules.

---

### 7. Simulation Mode (Demo/Development)

**What it does**: Runs the full platform with synthetic data - no AWS credentials required.

**Perfect for**:
- Demos and presentations
- Development and testing
- Training new users
- Evaluating the platform before production deployment

**How it works**:
- Generates 6 synthetic AWS resources
- Creates 6 months of historical cost data
- Produces 2-5 new recommendations every 3 seconds
- Auto-executes autonomous recommendations
- All features work identically to production mode

---

### 8. Real-Time Updates

**What it does**: Keeps all users in sync with live data updates.

- **WebSocket Connection**: Instant updates without page refresh
- **Dashboard Sync**: Metrics update automatically
- **Notification Broadcasting**: All users see new recommendations immediately
- **Query Invalidation**: Frontend data stays fresh

---

### 9. Slack Integration

**What it does**: Sends notifications to your Slack workspace for key events.

**Notification types**:
- New high-priority recommendations
- Optimization completions
- Approval requests
- Status updates

---

### 10. Multi-Tenant Support

**What it does**: Securely isolates data between different organizations/teams.

- Each tenant sees only their own resources and recommendations
- Complete data isolation at database level
- JWT-based tenant identification
- No cross-tenant data leakage possible

---

## Navigation Structure

```
OPERATIONS
├── Dashboard          ← Consolidated main view (Action Required + Queue)
├── Cost Analysis      ← Detailed cost breakdown
└── Recommendations    ← Full recommendation history/search

AUTOMATION
├── Rules              ← Automation configuration
└── Governance         ← Compliance policies

AI CONFIGURATION (Admin only)
└── Agent Config       ← AI model settings

HELP
└── FAQ
```

**Note**: The navigation shows a red badge with pending count on "Recommendations" when items need approval.

---

## Operating Modes

### Simulation Mode (Default)
- Uses synthetic data
- No AWS credentials required
- 3-second recommendation cycles
- Perfect for demos and development

### Production Mode
- Connects to real AWS account
- Requires AWS credentials
- Uses AI-powered analysis (Gemini + RAG)
- Configurable analysis schedules

**Toggle between modes** via the Settings page in the UI.

---

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: view, approve, execute, configure |
| **User** | View recommendations, limited approvals |

---

## Security Features

### Authentication
- JWT-based authentication with 2-hour sessions
- Secure password hashing (bcrypt)
- Automatic session expiration
- Role-based access control

### Enterprise Security
- Security headers (HSTS, CSP, X-Frame-Options)
- CORS protection (fail-closed in production)
- API rate limiting (prevents abuse)
- Audit logging (tracks all critical actions)
- Database transactions with rollback

### Data Protection
- Multi-tenant isolation
- Encrypted connections (TLS)
- No credential storage in code
- Environment variable secrets management

---

## Getting Started

### For Demo/Evaluation
1. Open the application
2. Register an account (admin role recommended)
3. Login to see the Dashboard
4. Watch recommendations generate automatically
5. Try approving/rejecting HITL recommendations in the Action Required section

### For Production Use
1. Set `SIMULATION_MODE=false` in environment
2. Configure AWS credentials:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (optional, defaults to us-east-1)
3. Configure Slack integration (optional)
4. Set up AI integration for advanced analysis (optional)

---

## User Preferences

- **Communication Style**: Simple, everyday language
- **Documentation**: Focus on functional capabilities over technical details
- **Error Messages**: Clear, actionable guidance

---

## Technical Architecture

### Frontend Stack
- React 18 with TypeScript (Vite bundler)
- Shadcn/ui component library (Radix UI + Tailwind CSS)
- TanStack Query for data fetching
- Wouter for routing
- WebSocket for real-time updates

### Backend Stack
- Node.js with Express.js
- TypeScript (ESM modules)
- Drizzle ORM for database operations
- Node-cron for scheduled tasks

### Database
- PostgreSQL (Replit's built-in database or Supabase)
- Connection priority: `DATABASE_URL` (Replit) > `SUPABASE_DATABASE_URL` (external)
- Automatic driver selection: Standard pg for Replit/Supabase, Neon serverless for neon.tech
- All environments share single database instance

### AWS Integration
- AWS SDK v2 (real integration available)
- Cost Explorer for cost data
- CloudWatch for utilization metrics
- Trusted Advisor for optimization checks
- Graceful fallback when credentials unavailable

### AI/ML Stack (Production Mode)
- Gemini 2.0 Flash for analysis
- Pinecone for vector database (RAG)
- text-embedding-004 for embeddings
- 5-minute TTL cache for performance

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `server/services/scheduler.ts` | Background job scheduling |
| `server/services/aws.ts` | AWS SDK integration |
| `server/services/config.ts` | Configuration management |
| `server/services/heuristic-engine.ts` | Rule-based recommendations |
| `server/storage.ts` | Database operations + metrics calculation |
| `shared/schema.ts` | Data models and types |
| `client/src/pages/dashboard.tsx` | Main dashboard UI |
| `client/src/components/dashboard/action-required.tsx` | Action Required hero section |
| `client/src/components/dashboard/recommendations-panel.tsx` | Approval queue panel |
| `client/src/components/data-flow-viz.tsx` | System Status visualization |
| `client/src/components/layout/sidebar.tsx` | Navigation with pending badge |
| `client/src/lib/queryClient.ts` | API client and caching |

---

## Environment Variables

### Required
| Variable | Purpose |
|----------|---------|
| `SUPABASE_DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Authentication token signing (32+ chars) |

### Optional - AWS Integration
| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | AWS region (default: us-east-1) |

### Optional - Features
| Variable | Purpose |
|----------|---------|
| `SIMULATION_MODE` | Enable synthetic data mode |
| `PINECONE_API_KEY` | Vector database for AI/RAG |
| `ALLOWED_ORIGINS` | CORS origins (production) |

---

## Recent Updates (January 2026)

### UX Overhaul
1. **Consolidated Dashboard**: Removed separate Executive Dashboard, merged into single action-focused view
2. **Action Required Hero**: New hero section showing pending approval count + savings with queue preview
3. **Pending Badge**: Navigation shows red badge with pending count on Recommendations
4. **Last Action Timestamp**: Shows when agent last acted (e.g., "5m ago")
5. **Fixed KPI Metrics**: Shows actual pending count from queue, not misleading aggregate totals
6. **Navigation Cleanup**: Renamed "Automation & Governance" to "Automation", "Automation" to "Rules"
7. **System Status**: Renamed "Data Flow Pipeline" to "System Status"

### Previous Updates (November 2025)
1. **Supabase Migration**: Moved from Neon to Supabase PostgreSQL
2. **HTTP 304 Fix**: Resolved caching issue causing false error messages
3. **Three-Layer AWS Defense**: Reliable operation without AWS credentials
4. **AI Drill-Down**: Click AI history cards for detailed breakdowns
5. **Execution Mode Badges**: Visual indicators for autonomous vs HITL
6. **Config Status Banner**: Warning when autonomous mode disabled

---

## Known Limitations

- AWS only (no Azure/GCP support yet)
- Limited to EC2, RDS, Redshift resources
- No reserved instance analysis
- No custom report exports
- Slack is only notification channel

See `roadmap_finops.md` for planned improvements.

---

## API Endpoints Reference

### Metrics
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/metrics/summary` | GET | Dashboard metrics (spend, savings, pending counts) |
| `/api/metrics/optimization-mix` | GET | Autonomous vs HITL distribution |

### Recommendations
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/recommendations` | GET | List all recommendations |
| `/api/recommendations/:id` | GET | Get single recommendation |
| `/api/approve-all-recommendations` | POST | Bulk approve pending (admin) |

### Approvals
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/approval-requests` | POST | Create approval request |
| `/api/approval-requests/:id` | PATCH | Update approval status |

---

## Support

For issues or questions:
- Check workflow logs for errors
- Review browser console for frontend issues
- Verify environment variables are set correctly
- Ensure database connection is active
