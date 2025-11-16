import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { X, CheckCircle2, XCircle, Clock, Zap, TrendingUp, Activity } from "lucide-react";
import { formatCurrencyK } from "@/lib/currency";
import type { AiModeHistory, Recommendation } from "@shared/schema";

interface AiHistoryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiHistoryId: string | null;
}

interface AiHistoryDetailsData {
  aiRun: AiModeHistory;
  recommendations: Recommendation[];
  savingsBreakdown: {
    totalSavings: number;
    averageSavings: number;
    savingsByType: Record<string, number>;
  };
  executionModeCounts: {
    autonomous: number;
    hitl: number;
    autonomousPercentage: number;
    hitlPercentage: number;
  };
}

export function AiHistoryDetailsModal({ isOpen, onClose, aiHistoryId }: AiHistoryDetailsModalProps) {
  const { data, isLoading, isError } = useQuery<AiHistoryDetailsData>({
    queryKey: ['/api/ai-mode-history', aiHistoryId],
    enabled: !!aiHistoryId && isOpen,
  });

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDuration = (start: string | Date, end: string | Date | null | undefined) => {
    if (!end) return 'In progress...';
    const duration = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
    return `${duration.toFixed(1)}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Clock className="w-5 h-5 text-cyan-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: 'default',
      failed: 'destructive',
      running: 'outline'
    } as const;
    
    const bgColors = {
      success: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
      failed: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
      running: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
    };
    
    return (
      <Badge variant="outline" className={bgColors[status as keyof typeof bgColors] || ''}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getExecutionModeBadge = (recommendation: Recommendation) => {
    if (recommendation.executionMode === 'autonomous' && recommendation.status === 'executed') {
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
          ✅ Auto-Executed
        </Badge>
      );
    } else if (recommendation.executionMode === 'hitl' && recommendation.status === 'pending') {
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
          🕒 Needs Approval
        </Badge>
      );
    } else if (recommendation.executionMode === 'hitl' && recommendation.status === 'approved') {
      return (
        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
          ⏳ Awaiting Execution
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline">
          {recommendation.executionMode === 'autonomous' ? 'Autonomous' : 'HITL'}
        </Badge>
      );
    }
  };

  if (!aiHistoryId) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#1B1E23] border-gray-800" data-testid="ai-history-details-modal">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-cyan-400" />
              AI Analysis Run Details
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-modal">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-gray-400" data-testid="loading-state">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
              <p>Loading AI run details...</p>
            </div>
          </div>
        ) : isError ? (
          <div className="py-8 text-center text-red-400" data-testid="error-state">
            <div className="flex flex-col items-center gap-3">
              <XCircle className="w-12 h-12" />
              <p>Failed to load AI run details</p>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : !data || !data.aiRun ? (
          <div className="py-8 text-center text-gray-400" data-testid="not-found-state">
            <div className="flex flex-col items-center gap-3">
              <XCircle className="w-12 h-12" />
              <p>AI run not found</p>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-800/50">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="recommendations" data-testid="tab-recommendations">
                Recommendations ({data.recommendations?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="calculations" data-testid="tab-calculations">Calculations</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card className="bg-gray-800/30 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Run Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Status</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(data.aiRun.status)}
                        {getStatusBadge(data.aiRun.status)}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Triggered By</p>
                      <p className="text-white mt-1 capitalize">{data.aiRun.triggeredBy || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Start Time</p>
                      <p className="text-white mt-1">{formatDate(data.aiRun.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Duration</p>
                      <p className="text-white mt-1">
                        {formatDuration(data.aiRun.startTime, data.aiRun.endTime)}
                      </p>
                    </div>
                  </div>

                  {data.aiRun.summary && (
                    <div>
                      <p className="text-sm text-gray-400">Summary</p>
                      <p className="text-white mt-1">{data.aiRun.summary}</p>
                    </div>
                  )}

                  {data.aiRun.errorMessage && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-sm text-gray-400">Error Message</p>
                      <p className="text-red-400 mt-1">{data.aiRun.errorMessage}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      Savings Identified
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-400">Total Annual Savings</p>
                        <p className="text-2xl font-bold text-green-400 mt-1" data-testid="total-savings">
                          {formatCurrencyK(data.aiRun?.totalSavingsIdentified || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Recommendations Generated</p>
                        <p className="text-xl font-semibold text-white mt-1" data-testid="recommendations-count">
                          {data.aiRun?.recommendationsGenerated || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/30 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Execution Mode Split</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.executionModeCounts ? (
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-400">Autonomous</span>
                            <span className="text-sm text-emerald-400 font-semibold" data-testid="autonomous-count">
                              {data.executionModeCounts.autonomous || 0} ({(data.executionModeCounts.autonomousPercentage || 0).toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-emerald-500 h-2 rounded-full" 
                              style={{ width: `${data.executionModeCounts.autonomousPercentage || 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-400">HITL (Manual)</span>
                            <span className="text-sm text-amber-400 font-semibold" data-testid="hitl-count">
                              {data.executionModeCounts.hitl || 0} ({(data.executionModeCounts.hitlPercentage || 0).toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-amber-500 h-2 rounded-full" 
                              style={{ width: `${data.executionModeCounts.hitlPercentage || 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-400">
                        No execution mode data available
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-3 mt-4">
              {!data.recommendations || data.recommendations.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No recommendations generated in this run
                </div>
              ) : (
                data.recommendations.map((rec, index) => (
                  <Card key={rec.id} className="bg-gray-800/30 border-gray-700" data-testid={`recommendation-${index}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white mb-1">{rec.title}</h4>
                          <p className="text-sm text-gray-400">{rec.description}</p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          {getExecutionModeBadge(rec)}
                          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                            {rec.priority.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      
                      <Separator className="my-3 bg-gray-700" />
                      
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400">Resource</p>
                          <p className="text-white font-medium mt-1">{rec.resourceId}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Type</p>
                          <p className="text-white font-medium mt-1 capitalize">{rec.type}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Annual Savings</p>
                          <p className="text-green-400 font-bold mt-1">
                            {formatCurrencyK(rec.projectedMonthlySavings * 12)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Calculations Tab */}
            <TabsContent value="calculations" className="space-y-4 mt-4">
              {data.savingsBreakdown ? (
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Savings Breakdown</CardTitle>
                    <CardDescription className="text-gray-400">
                      Detailed analysis of cost optimization opportunities
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-900/50 rounded-lg p-4">
                        <p className="text-sm text-gray-400">Total Annual Savings</p>
                        <p className="text-2xl font-bold text-green-400 mt-2">
                          {formatCurrencyK(data.savingsBreakdown?.totalSavings || 0)}
                        </p>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-4">
                        <p className="text-sm text-gray-400">Average per Recommendation</p>
                        <p className="text-2xl font-bold text-cyan-400 mt-2">
                          {formatCurrencyK(data.savingsBreakdown?.averageSavings || 0)}
                        </p>
                      </div>
                    </div>

                    <Separator className="bg-gray-700" />

                    <div>
                      <h4 className="font-semibold text-white mb-3">Savings by Type</h4>
                      {data.savingsBreakdown?.savingsByType && Object.keys(data.savingsBreakdown.savingsByType).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(data.savingsBreakdown.savingsByType).map(([type, amount]) => (
                            <div key={type} className="flex justify-between items-center bg-gray-900/50 rounded-lg p-3">
                              <span className="text-gray-300 capitalize">{type.replace('-', ' ')}</span>
                              <span className="text-green-400 font-semibold">
                                {formatCurrencyK(amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-400">
                          No savings breakdown available
                        </div>
                      )}
                    </div>

                    <Separator className="bg-gray-700" />

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-400 mb-2">Calculation Methodology</h4>
                      <ul className="text-sm text-gray-300 space-y-1">
                        <li>• Savings calculated using current resource costs vs. optimized configurations</li>
                        <li>• Projections based on 30-day usage patterns and AWS pricing data</li>
                        <li>• Risk assessment includes performance impact and business continuity factors</li>
                        <li>• Annual savings assume consistent usage patterns throughout the year</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-gray-800/30 border-gray-700">
                  <CardContent className="py-8 text-center text-gray-400">
                    No calculation data available for this AI run
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
