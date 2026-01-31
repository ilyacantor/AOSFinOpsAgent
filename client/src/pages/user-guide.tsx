import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { useAgentConfig } from "@/hooks/use-agent-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Eye,
  MousePointer,
  Settings,
  HelpCircle,
  ArrowRight,
  Shield,
  Bot
} from "lucide-react";
import { useState } from "react";

export default function UserGuide() {
  const { agentConfig, updateProdMode } = useAgentConfig();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav
        lastSync="Just now"
        prodMode={agentConfig?.prodMode || false}
        onProdModeChange={updateProdMode}
        onMenuClick={() => setIsMobileSidebarOpen(true)}
      />
      <div className="flex-1 flex pt-[60px]">
        <Sidebar
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <main className="flex-1 overflow-hidden w-full">
          <div className="p-4 sm:p-6 h-full overflow-y-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">User Guide</h1>
              <p className="text-muted-foreground">
                Everything you need to know to use FinOps Autopilot effectively.
              </p>
            </div>

            {/* Quick Start */}
            <Card className="mb-6 border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  FinOps Autopilot finds ways to reduce your AWS spending. It monitors your cloud 24/7,
                  spots waste, and either fixes it automatically or asks for your approval first.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">1</div>
                    <div>
                      <p className="font-medium">Check Action Required</p>
                      <p className="text-sm text-muted-foreground">See what needs your attention</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">2</div>
                    <div>
                      <p className="font-medium">Review & Approve</p>
                      <p className="text-sm text-muted-foreground">Approve savings opportunities</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-secondary/50">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">3</div>
                    <div>
                      <p className="font-medium">Watch Savings Grow</p>
                      <p className="text-sm text-muted-foreground">Track your cost reductions</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dashboard Overview */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Understanding the Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Action Required */}
                <div className="border-b border-border pb-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Action Required (Top Section)
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    This is your command center. It shows what needs your attention right now.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Badge variant="destructive" className="mt-0.5">N</Badge>
                      <span>Number of items waiting for your approval</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-accent font-bold">$X/mo</span>
                      <span>Total savings if you approve everything pending</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                      <span>"All caught up!" means nothing needs your review</span>
                    </li>
                  </ul>
                </div>

                {/* This Month */}
                <div className="border-b border-border pb-4">
                  <h4 className="font-semibold mb-2">This Month Summary (Right Side)</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li><strong className="text-foreground">AWS Spend:</strong> Your current month's cloud costs</li>
                    <li><strong className="text-foreground">Realized Savings:</strong> Actual money saved from executed optimizations</li>
                    <li><strong className="text-foreground">Auto-executed:</strong> Low-risk optimizations done automatically</li>
                    <li><strong className="text-foreground">Reviewed:</strong> Items you've approved or rejected</li>
                    <li><strong className="text-foreground">Last action:</strong> When the system last did something (e.g., "5m ago")</li>
                  </ul>
                </div>

                {/* Priority Recommendations */}
                <div>
                  <h4 className="font-semibold mb-2">Priority Recommendations (Main Queue)</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    The full list of optimization opportunities, sorted by impact.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="destructive">CRITICAL</Badge>
                    <Badge className="bg-orange-500">HIGH</Badge>
                    <Badge variant="secondary">MEDIUM</Badge>
                    <Badge variant="outline">LOW</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Critical and High items are safe to approve quickly. Medium and Low may need more consideration.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* How Approval Works */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MousePointer className="w-5 h-5" />
                  How to Approve Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <p className="font-medium">Click "Review & Approve" on any recommendation</p>
                      <p className="text-sm text-muted-foreground">A modal opens with full details</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <p className="font-medium">Review the change</p>
                      <p className="text-sm text-muted-foreground">See current vs. recommended configuration, savings, and risk level</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <p className="font-medium">Click "Approve" or "Reject"</p>
                      <p className="text-sm text-muted-foreground">Approved items are queued for execution</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-accent/10 border border-accent/30">
                  <p className="text-sm font-medium text-accent mb-1">Bulk Approval</p>
                  <p className="text-sm text-muted-foreground">
                    Use the "Approve All" button to approve multiple low-risk items at once.
                    Great for clearing a backlog of safe optimizations.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Autonomous vs HITL */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Two Types of Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-600">Autonomous</Badge>
                    </div>
                    <p className="text-sm font-medium mb-1">Auto-executed (no approval needed)</p>
                    <p className="text-sm text-muted-foreground">
                      Low-risk changes like storage optimization. The system handles these automatically.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-600">Needs Approval</Badge>
                    </div>
                    <p className="text-sm font-medium mb-1">Human-in-the-Loop (HITL)</p>
                    <p className="text-sm text-muted-foreground">
                      Higher-impact changes like resizing production databases. These wait for your approval.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="w-5 h-5" />
                  Where to Find Things
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <span className="font-medium w-32">Dashboard</span>
                    <span className="text-sm text-muted-foreground">Your main view - start here every day</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <span className="font-medium w-32">Cost Analysis</span>
                    <span className="text-sm text-muted-foreground">Detailed breakdown of where money goes</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-2 w-32">
                      <span className="font-medium">Recommendations</span>
                      <Badge variant="destructive" className="text-xs">N</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">Full history and search (badge shows pending count)</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <span className="font-medium w-32">Rules</span>
                    <span className="text-sm text-muted-foreground">Configure automation settings</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                    <span className="font-medium w-32">Agent Config</span>
                    <span className="text-sm text-muted-foreground">AI settings (admin only)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="mb-6 border-l-4 border-l-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-accent" />
                  Tips for Success
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent mt-1" />
                    <span className="text-sm"><strong>Check daily:</strong> Spend 5 minutes reviewing pending items each morning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent mt-1" />
                    <span className="text-sm"><strong>Trust CRITICAL items:</strong> These have very low risk (0-5%) and high savings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent mt-1" />
                    <span className="text-sm"><strong>Use bulk approve:</strong> Clear multiple safe items quickly with "Approve All"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent mt-1" />
                    <span className="text-sm"><strong>Watch "Last action":</strong> If it says "1d ago" or more, check if the system is running</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent mt-1" />
                    <span className="text-sm"><strong>Review before rejecting:</strong> Understand why a recommendation was made before dismissing it</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Troubleshooting */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Common Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium mb-1">No recommendations appearing?</p>
                  <p className="text-sm text-muted-foreground">
                    Check if simulation mode is enabled (should generate automatically).
                    In production, verify AWS credentials are configured.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-1">Dashboard not updating?</p>
                  <p className="text-sm text-muted-foreground">
                    Try refreshing the page. The dashboard auto-updates every 3 seconds via WebSocket.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-1">Approval button not working?</p>
                  <p className="text-sm text-muted-foreground">
                    Check if you have admin permissions. Some actions require elevated access.
                  </p>
                </div>
                <div>
                  <p className="font-medium mb-1">What's the difference between Simulation and Production mode?</p>
                  <p className="text-sm text-muted-foreground">
                    Simulation uses synthetic data for demos. Production connects to real AWS and uses AI analysis.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="text-center text-sm text-muted-foreground py-6">
              <p>For additional help, check the FAQ page or contact your FinOps team administrator.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
