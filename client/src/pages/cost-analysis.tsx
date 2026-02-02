import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { useAgentConfig } from "@/hooks/use-agent-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChartLine, DollarSign, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrencyK } from "@/lib/currency";
import { useQuery } from "@tanstack/react-query";
import type { AwsResource } from "@shared/schema";
import { useState } from "react";

interface DashboardMetrics {
  monthlySpend: number;
  identifiedSavings: number;
  realizedSavings: number;
  resourcesAnalyzed: number;
  wastePercentage: number;
}

interface MetricsSummary {
  monthlySpend: number;
  ytdSpend: number;
  autonomousSavingsPending: number;
  hitlSavingsAwaiting: number;
  realizedSavingsYTD: number;
  wastePercentOptimizedYTD: number;
  monthlySpendChange: number;
  ytdSpendChange: number;
  pendingApprovalCount: number;
  lastActionTimestamp: string | null;
  projectedAnnualSpend: number;
  totalIdentifiedSavings: number;
  priorYearSpend: number;
  forecastVariance: number;
}

interface CostTrend {
  month: string;
  totalCost: number;
}

export default function CostAnalysis() {
  const { agentConfig, updateProdMode } = useAgentConfig();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery<DashboardMetrics>({
    queryKey: ['/api/dashboard/metrics'],
    refetchInterval: 60000,
    retry: false,
  });

  const { data: metricsSummary, isLoading: summaryLoading } = useQuery<MetricsSummary>({
    queryKey: ['/api/metrics/summary'],
    refetchInterval: 30000,
    retry: false,
  });

  const { data: trends, isLoading: trendsLoading, error: trendsError } = useQuery<CostTrend[]>({
    queryKey: ['/api/dashboard/cost-trends'],
    refetchInterval: 300000,
    retry: false,
  });

  const { data: resources, isLoading: resourcesLoading, error: resourcesError } = useQuery<AwsResource[]>({
    queryKey: ['/api/aws-resources'],
    refetchInterval: 300000,
    retry: false,
  });

  // Calculate cost variance from trends
  const costVariance = trends && trends.length >= 2 
    ? ((trends[trends.length - 1].totalCost - trends[trends.length - 2].totalCost) / trends[trends.length - 2].totalCost) * 100
    : 0;

  // Calculate service breakdown from resources
  const serviceBreakdown = resources?.reduce((acc, resource) => {
    const service = resource.resourceType;
    const cost = Number(resource.monthlyCost) || 0;
    acc[service] = (acc[service] || 0) + cost;
    return acc;
  }, {} as Record<string, number>) || {};

  const sortedServices = Object.entries(serviceBreakdown)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5); // Top 5 services

  const isLoading = metricsLoading || trendsLoading || resourcesLoading || summaryLoading;
  const error = metricsError || trendsError || resourcesError;

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav 
          lastSync="Error"
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
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Loading Data</AlertTitle>
                <AlertDescription>
                  {error instanceof Error ? error.message : 'Failed to load cost analysis data. Please try again.'}
                </AlertDescription>
              </Alert>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav 
          lastSync="Loading..."
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
                <h1 className="text-3xl font-bold tracking-tight">Cost Analysis</h1>
                <p className="text-muted-foreground">Loading cost analysis...</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-20 bg-muted rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </main>
        </div>
      </div>
    );
  }

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
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Cost Analysis</h1>
              <p className="text-muted-foreground">
                Detailed analysis of your AWS spending patterns and cost trends
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="monthly-spend">
                    {formatCurrencyK(metrics?.monthlySpend || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current month spending
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cost Variance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="cost-variance">
                    {costVariance > 0 ? '+' : ''}{costVariance.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    vs. previous month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Projected Annual Spend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="forecast">
                    {formatCurrencyK(metricsSummary?.projectedAnnualSpend || 0)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {(metricsSummary?.forecastVariance || 0) < 0 ? (
                      <TrendingDown className="w-3 h-3 text-green-500" />
                    ) : (
                      <TrendingUp className="w-3 h-3 text-red-500" />
                    )}
                    <span className={`text-xs ${(metricsSummary?.forecastVariance || 0) < 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {Math.abs(metricsSummary?.forecastVariance || 0).toFixed(1)}% vs prior year
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    With {formatCurrencyK(metricsSummary?.totalIdentifiedSavings || 0)} potential savings
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="potential-savings">
                    {formatCurrencyK(metrics?.identifiedSavings || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Available optimizations
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Realized Savings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-accent" data-testid="realized-savings">
                    {formatCurrencyK(metrics?.realizedSavings || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From approved optimizations
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Service Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4" data-testid="service-breakdown">
                    {sortedServices.length > 0 ? (
                      sortedServices.map(([service, cost]) => (
                        <div key={service} className="flex justify-between items-center">
                          <div className="flex items-center space-x-3">
                            <div className="w-3 h-3 bg-primary rounded-full"></div>
                            <span className="text-sm font-medium">{service}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">{formatCurrencyK(cost)}/mo</div>
                            <div className="text-xs text-muted-foreground">
                              {((cost / (metrics?.monthlySpend || 1)) * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <ChartLine className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No cost data available</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Cost breakdown will appear here once resources are analyzed
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}