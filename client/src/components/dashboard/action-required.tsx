import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle2, ArrowRight, Activity } from "lucide-react";
import { formatCurrencyCompact, formatCurrencyK } from "@/lib/currency";
import { Link } from "wouter";
import type { Recommendation } from "@shared/schema";

interface MetricsSummary {
  monthlySpend: number;
  ytdSpend: number;
  hitlSavingsAwaiting: number;
  autonomousSavingsPending: number;
  realizedSavingsYTD: number;
  wastePercentOptimizedYTD: number;
  monthlySpendChange: number;
  ytdSpendChange: number;
  pendingApprovalCount: number;
  lastActionTimestamp: string | null;
}

export function ActionRequired() {
  const { data: recommendations = [] } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations'],
    refetchInterval: 30000,
  });

  const { data: metrics } = useQuery<MetricsSummary>({
    queryKey: ['/api/metrics/summary'],
    refetchInterval: 3000,
  });

  // Get pending HITL recommendations that need approval
  const pendingHITL = recommendations.filter(
    r => r.status === 'pending' && r.executionMode === 'hitl'
  );

  // Calculate total pending savings from the queue
  const pendingSavings = pendingHITL.reduce(
    (sum, r) => sum + r.projectedMonthlySavings,
    0
  );

  // Format last action time
  const formatLastAction = (timestamp: string | null) => {
    if (!timestamp) return 'No actions yet';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
      {/* Action Required Section */}
      <Card className="lg:col-span-2 border-l-4 border-l-amber-500" data-testid="action-required-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-foreground">
              Action Required
              {pendingHITL.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {pendingHITL.length}
                </Badge>
              )}
            </h3>
          </div>

          {pendingHITL.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div>
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Clock className="w-4 h-4" />
                    <span className="font-semibold">{pendingHITL.length} pending approval</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Est. savings: <span className="font-bold text-accent">{formatCurrencyK(pendingSavings)}/mo</span>
                  </p>
                </div>
                <Link href="/recommendations">
                  <Button variant="default" size="sm" className="gap-1" data-testid="review-queue-button">
                    Review Queue
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>

              {/* Quick preview of top pending items */}
              <div className="space-y-2">
                {pendingHITL.slice(0, 3).map((rec, idx) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border hover:border-accent/50 transition-colors"
                    data-testid={`pending-item-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={rec.priority === 'critical' || rec.priority === 'high' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {rec.priority.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-medium truncate max-w-[200px]">{rec.title}</span>
                    </div>
                    <span className="text-sm font-bold text-accent">
                      {formatCurrencyK(rec.projectedMonthlySavings)}/mo
                    </span>
                  </div>
                ))}
                {pendingHITL.length > 3 && (
                  <Link href="/recommendations" className="block">
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground">
                      View all {pendingHITL.length} pending
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium text-green-600 dark:text-green-400">All caught up!</p>
                <p className="text-sm text-muted-foreground">No recommendations pending approval</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* This Month Summary */}
      <Card data-testid="this-month-card">
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            This Month
          </h3>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">AWS Spend</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrencyCompact(metrics?.monthlySpend || 0)}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Realized Savings</p>
              <p className="text-2xl font-bold text-green-500">
                {formatCurrencyCompact(metrics?.realizedSavingsYTD || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Year to date</p>
            </div>

            <div className="pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Agent Performance</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Auto-executed:</span>
                  <span className="ml-1 font-medium">{recommendations.filter(r => r.executionMode === 'autonomous' && r.status === 'executed').length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Reviewed:</span>
                  <span className="ml-1 font-medium">{recommendations.filter(r => r.executionMode === 'hitl' && r.status !== 'pending').length}</span>
                </div>
              </div>
            </div>

            {/* Last Action Timestamp */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              <Activity className="w-3 h-3" />
              <span>Last action: {formatLastAction(metrics?.lastActionTimestamp || null)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
