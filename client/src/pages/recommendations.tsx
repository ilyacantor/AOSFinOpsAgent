import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { useAgentConfig } from "@/hooks/use-agent-config";
import { RecommendationsPanel } from "@/components/dashboard/recommendations-panel";
import { ApprovalModal } from "@/components/modals/approval-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Recommendation } from "@shared/schema";
import { AlertCircle, CheckCircle, Info, Lightbulb, AlertTriangle } from "lucide-react";
import { formatCurrencyK } from "@/lib/currency";

export default function Recommendations() {
  const { agentConfig, updateProdMode, updateSimulationMode } = useAgentConfig();
  const { data: recommendations, isLoading, error } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations'],
    refetchInterval: 30000,
    retry: false,
  });

  const getStatusStats = () => {
    if (!recommendations) return { pending: 0, approved: 0, executed: 0, rejected: 0 };
    
    return recommendations.reduce((acc, rec) => {
      acc[rec.status as keyof typeof acc] = (acc[rec.status as keyof typeof acc] || 0) + 1;
      return acc;
    }, { pending: 0, approved: 0, executed: 0, rejected: 0 });
  };

  const stats = getStatusStats();

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav 
          lastSync="Error"
          prodMode={agentConfig?.prodMode || false}
          syntheticData={agentConfig?.simulationMode || false}
          onProdModeChange={updateProdMode}
          onSyntheticDataChange={updateSimulationMode}
        />
        <div className="flex-1 flex pt-[60px]">
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            <div className="p-6 h-full overflow-y-auto">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Data</AlertTitle>
                <AlertDescription>
                  {error instanceof Error ? error.message : 'Failed to load recommendations. Please try again.'}
                </AlertDescription>
              </Alert>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav 
        lastSync="2 min ago"
        prodMode={agentConfig?.prodMode || false}
        syntheticData={agentConfig?.simulationMode || false}
        onProdModeChange={updateProdMode}
        onSyntheticDataChange={updateSimulationMode}
      />
      <div className="flex-1 flex pt-[60px]">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
        
        <div className="p-6 h-full overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cost Optimization Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered recommendations to reduce your AWS costs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">
                Ready for execution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Executed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.executed}</div>
              <p className="text-xs text-muted-foreground">
                Successfully applied
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">
                Not implemented
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          <RecommendationsPanel />
        </div>

        {recommendations && recommendations.length > 3 && (
          <Card>
            <CardHeader>
              <CardTitle>All Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.slice(3).map((rec, index) => (
                  <div key={rec.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4" />
                        <h3 className="font-medium">{rec.title}</h3>
                        <Badge variant={rec.priority === 'high' || rec.priority === 'critical' ? 'destructive' : 'secondary'}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      <p className="text-sm font-medium mt-1">
                        Projected savings: {formatCurrencyK(rec.projectedMonthlySavings)}/month
                      </p>
                    </div>
                    <Badge variant="outline">{rec.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
          </div>
        </div>
      </main>
      </div>
      
      <ApprovalModal />
    </div>
  );
}