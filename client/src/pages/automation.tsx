import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { useAgentConfig } from "@/hooks/use-agent-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Cog, PlayCircle, PauseCircle, Clock, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function Automation() {
  const { agentConfig, updateProdMode } = useAgentConfig();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const automationRules = [
    {
      id: 1,
      name: "Auto-scale EC2 instances",
      description: "Automatically resize EC2 instances based on utilization",
      enabled: true,
      schedule: "Hourly",
      lastRun: "2 hours ago",
      status: "Active"
    },
    {
      id: 2,
      name: "Shutdown dev environments",
      description: "Automatically stop development resources after hours",
      enabled: true,
      schedule: "Daily at 6 PM",
      lastRun: "Yesterday",
      status: "Active"
    },
    {
      id: 3,
      name: "RDS backup optimization",
      description: "Optimize backup retention for non-production databases",
      enabled: false,
      schedule: "Weekly",
      lastRun: "Never",
      status: "Disabled"
    },
    {
      id: 4,
      name: "S3 lifecycle policies",
      description: "Move objects to cheaper storage classes automatically",
      enabled: true,
      schedule: "Daily",
      lastRun: "4 hours ago",
      status: "Active"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav 
        lastSync="5 min ago"
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
          <h1 className="text-3xl font-bold tracking-tight">Automation</h1>
          <p className="text-muted-foreground">
            Automated cost optimization rules and policies
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">
                Currently running
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Disabled Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1</div>
              <p className="text-xs text-muted-foreground">
                Needs attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Executions Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">
                Automated actions
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Automation Rules</CardTitle>
              <Button>
                <Cog className="w-4 h-4 mr-2" />
                Create Rule
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {automationRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{rule.name}</h3>
                      <Badge variant={rule.status === 'Active' ? 'default' : 'secondary'}>
                        {rule.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {rule.schedule}
                      </div>
                      <div>Last run: {rule.lastRun}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={rule.enabled}
                      data-testid={`toggle-automation-${rule.id}`}
                    />
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">2 hours ago</span>
                <span>Scaled down 3 EC2 instances (t3.medium → t3.small)</span>
                <Badge variant="outline" className="ml-auto">$45/month saved</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-muted-foreground">4 hours ago</span>
                <span>Applied S3 lifecycle policy to 15 buckets</span>
                <Badge variant="outline" className="ml-auto">$120/month saved</Badge>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-muted-foreground">Yesterday</span>
                <span>Stopped 8 development resources after hours</span>
                <Badge variant="outline" className="ml-auto">$200/month saved</Badge>
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