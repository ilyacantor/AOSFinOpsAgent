import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, CheckCircle2, ArrowRight, Activity, RotateCcw, AlertTriangle } from "lucide-react";
import { formatCurrencyCompact, formatCurrencyK } from "@/lib/currency";
import { Link } from "wouter";
import type { Recommendation } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface SessionStatus {
  session: { id: string; startedAt: string; resourcesOptimized: number; totalSavingsRealized: number } | null;
  resourcesOptimizedInSession: number;
  totalOptimizableResources: number;
  remainingOptimizations: number;
  isExhausted: boolean;
  sessionRealizedSavings: number;
  potentialSavings: number;
}

export function ActionRequired() {
  const [showResetDialog, setShowResetDialog] = useState(false);
  
  const { data: recommendations = [] } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations'],
    refetchInterval: 30000,
  });

  const { data: metrics } = useQuery<MetricsSummary>({
    queryKey: ['/api/metrics/summary'],
    refetchInterval: 3000,
  });

  const { data: sessionStatus } = useQuery<SessionStatus>({
    queryKey: ['/api/session/status'],
    refetchInterval: 3000,
  });

  const resetSession = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/session/reset');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/session/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/metrics/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/optimization-history'] });
      setShowResetDialog(false);
    },
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

  // Check if optimizations are exhausted
  const isExhausted = sessionStatus?.isExhausted || false;

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
          ) : isExhausted ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <div className="flex-1">
                  <p className="font-medium text-amber-600 dark:text-amber-400">Optimizations Exhausted</p>
                  <p className="text-sm text-muted-foreground">
                    All available optimizations have been executed for this session.
                    Reset to start a new optimization cycle.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1 border-amber-500 text-amber-600 hover:bg-amber-500/10"
                  onClick={() => setShowResetDialog(true)}
                  data-testid="reset-session-button"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Session
                </Button>
              </div>
              {sessionStatus && (
                <div className="text-xs text-muted-foreground">
                  Session optimized {sessionStatus.resourcesOptimizedInSession} of {sessionStatus.totalOptimizableResources} resources
                  • Session savings: {formatCurrencyCompact(sessionStatus.sessionRealizedSavings)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div className="flex-1">
                <p className="font-medium text-green-600 dark:text-green-400">All caught up!</p>
                <p className="text-sm text-muted-foreground">No recommendations pending approval</p>
              </div>
              {sessionStatus && sessionStatus.resourcesOptimizedInSession > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-1"
                  onClick={() => setShowResetDialog(true)}
                  data-testid="reset-session-small-button"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </Button>
              )}
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
              <p className="text-sm text-muted-foreground">Session Savings</p>
              <p className="text-2xl font-bold text-green-500">
                {formatCurrencyCompact(sessionStatus?.sessionRealizedSavings || 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {sessionStatus?.resourcesOptimizedInSession || 0} optimizations this session
              </p>
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

            {/* Reset Session Button - Always visible */}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full gap-2 mt-2"
              onClick={() => setShowResetDialog(true)}
              disabled={resetSession.isPending}
              data-testid="reset-session-button"
            >
              <RotateCcw className="w-4 h-4" />
              {resetSession.isPending ? "Resetting..." : "Reset Session"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset Session Confirmation Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Optimization Session?</DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>This will start a fresh optimization cycle:</p>
              <ul className="list-disc list-inside text-sm space-y-1 pl-2">
                <li>All executed optimizations will be restored to pending</li>
                <li>Session savings will reset to $0</li>
                <li>Monthly AWS spend is <strong>not affected</strong></li>
              </ul>
              <p className="pt-2 text-amber-600 dark:text-amber-400">
                This allows you to run through the optimization cycle again.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowResetDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => resetSession.mutate()}
              disabled={resetSession.isPending}
              className="gap-2"
              data-testid="confirm-reset-button"
            >
              {resetSession.isPending ? (
                <>Resetting...</>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Reset Session
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
