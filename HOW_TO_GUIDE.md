# FinOps Autopilot - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Managing Recommendations](#managing-recommendations)
5. [Approval Workflows](#approval-workflows)
6. [Cost Analysis](#cost-analysis)
7. [Automation & Rules](#automation--rules)
8. [AI Analysis Modes](#ai-analysis-modes)
9. [Real-Time Monitoring](#real-time-monitoring)
10. [API Reference](#api-reference)
11. [Troubleshooting](#troubleshooting)

---

## Overview

FinOps Autopilot is an enterprise cloud cost optimization platform that automatically analyzes your AWS infrastructure, identifies cost-saving opportunities, and provides actionable recommendations to reduce cloud spending.

### Who Is This For?

**FinOps practitioners** who need to:
- Review and approve cost optimization recommendations
- Monitor AWS spending and savings
- Execute optimizations quickly with confidence

This is an **operational tool**, not an executive reporting tool. It's designed to help you take action fast.

### Key Benefits

- **Automated Cost Analysis**: Continuous monitoring of AWS resources
- **AI-Powered Recommendations**: Advanced analysis using Google Gemini 2.0 Flash
- **Dual-Mode Operation**: Autonomous (auto-execute) and HITL (human approval)
- **Real-Time Insights**: Live dashboard with instant updates
- **Slack Integration**: Notifications for team collaboration

---

## Getting Started

### For Demo/Evaluation

1. **Open the application** in your browser
2. **Register an account** (admin role recommended for full access)
3. **Login** to see the main Dashboard
4. **Watch recommendations** generate automatically (in simulation mode)
5. **Try approving** a recommendation from the Action Required section

### For Production Use

1. Set `SIMULATION_MODE=false` in environment
2. Configure AWS credentials:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (optional, defaults to us-east-1)
3. Configure Slack integration (optional)
4. Enable Production Mode for AI-powered analysis

---

## Dashboard Overview

The dashboard is your command center. It's organized to show you **what needs your attention** first.

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  FinOps Autopilot                          [Prod Mode ○]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ACTION REQUIRED              │  This Month                 │
│  ┌────────────────────────┐   │  ─────────────────────      │
│  │ N pending approval     │   │  AWS Spend: $XXX            │
│  │ Est. savings: $XX/mo   │   │  Realized Savings: $XXX     │
│  │ [Review Queue →]       │   │                             │
│  └────────────────────────┘   │  Agent Performance          │
│  ┌────────────────────────┐   │  ─────────────────────      │
│  │ Top pending items...   │   │  Auto-executed: XX          │
│  └────────────────────────┘   │  Reviewed: XX               │
│                               │  Last action: Xm ago        │
├─────────────────────────────────────────────────────────────┤
│  PRIORITY RECOMMENDATIONS                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CRITICAL  RDS Right-Sizing      $52K/mo  [Review]    │   │
│  │ HIGH      Reduce EC2 Capacity   $4K/mo   [Review]    │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  SYSTEM STATUS                                              │
│  Input Sources → AI Processing → Output Results             │
└─────────────────────────────────────────────────────────────┘
```

### Action Required Section

This is the **hero section** at the top. It shows:

- **Pending approval count**: How many recommendations need your review
- **Estimated savings**: Total monthly savings if you approve all pending items
- **Quick preview**: Top 3 pending items for fast action
- **Review Queue button**: Takes you to the full recommendations page

When there's nothing pending, you'll see "All caught up!" with a green checkmark.

### This Month Summary

On the right side, you'll see:

- **AWS Spend**: Current month's total cloud costs
- **Realized Savings**: Actual savings from executed optimizations (YTD)
- **Agent Performance**: Counts of auto-executed and reviewed items
- **Last action**: When the agent last did something (e.g., "5m ago")

### Priority Recommendations

Below the hero section, you'll see the full **approval queue** with:

- Filter buttons: All, Autonomous, HITL, Pending
- Priority badges: CRITICAL, HIGH, MEDIUM, LOW
- Execution mode badges: Auto-Optimized, Needs Approval, Awaiting Execution
- Savings amount for each recommendation
- "Review & Approve" button for each item
- "Approve All" button for bulk approval

### System Status

Shows the data flow pipeline:
- **Input Sources**: EC2 instances, RDS databases, S3 buckets, CloudWatch
- **AI Processing**: FinOps AI Agent doing analysis
- **Output Results**: Recommendations, savings, optimizations

---

## Managing Recommendations

### Recommendation Types

| Type | What it does | Example |
|------|--------------|---------|
| **Rightsizing** | Suggests smaller instance types | "Downsize from m5.xlarge to m5.large" |
| **Scheduling** | Stop resources during off-hours | "Stop dev DB outside business hours" |
| **Storage Tiering** | Move to cheaper storage classes | "Convert gp2 volume to gp3" |
| **Termination** | Remove unused resources | "Terminate idle EC2 instance" |

### Priority Levels

| Priority | Risk | Action Timeline |
|----------|------|-----------------|
| **CRITICAL** | Very Low (0-5%) | Implement immediately |
| **HIGH** | Low (5-15%) | Review within 1 week |
| **MEDIUM** | Medium (15-25%) | Assess and plan |
| **LOW** | Higher (25%+) | Consider for future |

### Execution Modes

**Autonomous Mode** (green badge):
- Low-risk recommendations
- Execute automatically without approval
- Example: Storage class optimization

**HITL Mode** (amber badge):
- Higher-risk or high-impact changes
- Require your approval before execution
- Example: Resizing production database

### Reviewing a Recommendation

1. Click **"Review & Approve"** on any recommendation
2. Review the modal showing:
   - Current configuration
   - Recommended configuration
   - Impact analysis (monthly/annual savings, risk level)
3. Click **"Approve Optimization"** or **"Reject"**
4. The recommendation moves to the appropriate status

### Bulk Approval

For trusted low-risk items:
1. Review the pending list
2. Click **"Approve All (X)"** button
3. All pending items are approved at once
4. See the toast notification with total savings

---

## Approval Workflows

### Workflow Stages

1. **Pending** → Awaiting your review
2. **Approved** → Ready for execution
3. **Executed** → Successfully implemented
4. **Rejected** → Declined (won't be implemented)

### What Happens After Approval

1. System records the approval with your user ID
2. Creates optimization history for audit trail
3. Updates dashboard metrics immediately
4. Sends Slack notification (if configured)
5. For autonomous items: executes the optimization

---

## Cost Analysis

Navigate to **Cost Analysis** from the sidebar to see:

### Cost Breakdown by Service

- EC2 (Compute)
- RDS (Database)
- S3 (Storage)
- Redshift (Data Warehouse)
- Other services

### Monthly Trends

- 6-month historical chart
- Spend vs. savings visualization
- Month-over-month comparison

### Service Details

Click into any service category to see:
- Individual resource costs
- Utilization metrics
- Optimization opportunities

---

## Automation & Rules

Navigate to **Rules** from the sidebar to configure:

### Autonomous Execution Settings

- **Enable/disable autonomous mode**: Toggle auto-execution
- **Max risk level**: Set threshold for auto-approval (e.g., 15%)
- **Minimum savings threshold**: Only auto-execute above certain savings
- **Auto-execute types**: Select which recommendation types can auto-execute

### Governance

Navigate to **Governance** to set:

- Approval chains for high-value optimizations
- Compliance policies
- Audit requirements

---

## AI Analysis Modes

### Production Mode (AI + RAG)

**Technology**: Google Gemini 2.0 Flash with Pinecone vector database

**When to use**:
- Production environments
- Complex infrastructure
- When AWS credentials are available

**Features**:
- Scheduled analysis every 6 hours
- Manual trigger via "Run AI Analysis Now"
- Higher accuracy than rule-based

**How to enable**:
1. Go to **Agent Config** (admin only)
2. Toggle **Production Mode** ON

### Simulation Mode (Demo)

**Technology**: Rule-based heuristic engine

**When to use**:
- Demos and testing
- No AWS credentials available
- Learning the platform

**Features**:
- Generates synthetic AWS data
- Creates 2-5 recommendations every 3 seconds
- All features work identically to production

---

## Real-Time Monitoring

### WebSocket Updates

The dashboard updates automatically via WebSocket:
- New recommendations appear instantly
- Metrics refresh in real-time
- No manual page refresh needed

### Notification Types

- **new_recommendation**: New optimization found
- **optimization_executed**: Optimization completed
- **bulk_approval**: Multiple items approved

### Last Action Timestamp

The "Last action" indicator shows when the agent last acted:
- "Just now" - within the last minute
- "5m ago" - 5 minutes ago
- "2h ago" - 2 hours ago
- "1d ago" - 1 day ago

---

## API Reference

### Core Endpoints

#### Get Metrics Summary
```http
GET /api/metrics/summary
```
Returns: monthlySpend, ytdSpend, pendingApprovalCount, realizedSavingsYTD, lastActionTimestamp

#### Get Recommendations
```http
GET /api/recommendations
```
Returns: Array of all recommendations with status, priority, savings

#### Bulk Approve
```http
POST /api/approve-all-recommendations
```
Body: `{ approvedBy, comments }`
Returns: approvedCount, totalAnnualSavings

#### Get Optimization Mix
```http
GET /api/metrics/optimization-mix
```
Returns: autonomousCount, hitlCount, percentages

### Authentication

All endpoints require JWT authentication. Token is passed via:
- HTTP header: `Authorization: Bearer <token>`
- WebSocket: Query parameter `?token=<token>`

---

## Troubleshooting

### No Recommendations Appearing

**Check**:
1. Is simulation mode enabled? (should generate automatically)
2. Are AWS credentials configured? (for production mode)
3. Has the analysis run? (check last action timestamp)

**Fix**: Go to Agent Config and click "Run AI Analysis Now"

### Dashboard Not Updating

**Check**:
1. WebSocket connection (browser dev tools → Network → WS)
2. Browser console for errors
3. Network connectivity

**Fix**: Refresh the page; check if WebSocket reconnects

### Approval Not Working

**Check**:
1. Your user role (admin required for some actions)
2. Recommendation status (must be "pending")
3. Network request in dev tools

**Fix**: Check browser console for error messages; verify login session

### Metrics Showing Wrong Numbers

**Check**:
1. Data refresh interval (every 3 seconds)
2. Filter settings on recommendations panel
3. Time range for cost data

**Fix**: Clear browser cache; logout and login again

---

## Navigation Reference

```
OPERATIONS
├── Dashboard          ← Main view (start here)
├── Cost Analysis      ← Detailed cost breakdown
└── Recommendations    ← Full history/search (red badge shows pending count)

AUTOMATION
├── Rules              ← Configure automation
└── Governance         ← Compliance policies

AI CONFIGURATION (Admin only)
└── Agent Config       ← AI model settings

HELP
├── FAQ               ← Common questions
└── User Guide        ← This guide (in-app)
```

---

*For additional help, check the FAQ page or contact your FinOps team administrator.*
