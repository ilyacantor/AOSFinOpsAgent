import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { useAgentConfig } from "@/hooks/use-agent-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, CheckCircle, Users, DollarSign } from "lucide-react";
import { useState } from "react";

export default function Governance() {
  const { agentConfig, updateProdMode } = useAgentConfig();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const policies = [
    {
      id: 1,
      name: "Budget Alerts",
      description: "Alert when spending exceeds 80% of budget",
      compliance: 95,
      status: "Active",
      violations: 2
    },
    {
      id: 2,
      name: "Resource Tagging",
      description: "All resources must have cost center and environment tags",
      compliance: 78,
      status: "Active",
      violations: 12
    },
    {
      id: 3,
      name: "Instance Size Limits",
      description: "Prevent provisioning of instances larger than 2xlarge without approval",
      compliance: 100,
      status: "Active", 
      violations: 0
    },
    {
      id: 4,
      name: "Dev Environment Shutdown",
      description: "Development resources must be stopped outside business hours",
      compliance: 85,
      status: "Active",
      violations: 5
    }
  ];

  const approvalRequests = [
    {
      id: 1,
      type: "Budget Increase",
      requestor: "Engineering Team",
      amount: "$2,500",
      reason: "Q4 traffic spike preparation",
      status: "Pending"
    },
    {
      id: 2,
      type: "Exception Request",
      requestor: "DevOps Team",
      amount: "$800",
      reason: "Large instance for ML training",
      status: "Pending"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav 
        lastSync="3 min ago"
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
            <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Governance & Compliance</h1>
          <p className="text-muted-foreground">
            Cost governance policies and approval workflows
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">4</div>
              <p className="text-xs text-muted-foreground">
                Currently enforced
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89%</div>
              <p className="text-xs text-muted-foreground">
                Overall compliance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Policy Violations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">19</div>
              <p className="text-xs text-muted-foreground">
                Needs attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">2</div>
              <p className="text-xs text-muted-foreground">
                Awaiting review
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Governance Policies</CardTitle>
                <Button>Create Policy</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {policies.map((policy) => (
                  <div key={policy.id} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{policy.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={policy.status === 'Active' ? 'default' : 'secondary'}>
                          {policy.status}
                        </Badge>
                        {policy.violations > 0 && (
                          <Badge variant="destructive">{policy.violations} violations</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{policy.description}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Compliance</span>
                        <span>{policy.compliance}%</span>
                      </div>
                      <Progress value={policy.compliance} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {approvalRequests.map((request) => (
                  <div key={request.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{request.type}</h3>
                        <p className="text-sm text-muted-foreground">by {request.requestor}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 font-medium">
                          <DollarSign className="w-4 h-4" />
                          {request.amount}
                        </div>
                        <Badge variant="outline">{request.status}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{request.reason}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="default">Approve</Button>
                      <Button size="sm" variant="outline">Reject</Button>
                      <Button size="sm" variant="ghost">Details</Button>
                    </div>
                  </div>
                ))}
                {approvalRequests.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending approvals</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent Governance Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-muted-foreground">1 hour ago</span>
                <span>Policy violation: Untagged EC2 instance i-1234567890</span>
                <Badge variant="destructive" className="ml-auto">High</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">3 hours ago</span>
                <span>Approved budget increase for Engineering team</span>
                <Badge variant="outline" className="ml-auto">$2,500</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-muted-foreground">5 hours ago</span>
                <span>Budget alert: Marketing team at 85% of monthly budget</span>
                <Badge variant="outline" className="ml-auto">Warning</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}