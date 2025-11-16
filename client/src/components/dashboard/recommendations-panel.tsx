import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Info, CheckCircle, ExternalLink, CheckCheck } from "lucide-react";
import { formatCurrencyK } from "@/lib/currency";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Recommendation } from "@shared/schema";

export function RecommendationsPanel() {
  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data: recommendations, isLoading } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/approve-all-recommendations', {
        approvedBy: 'current-user',
        comments: 'Bulk approval of all pending recommendations'
      });
    },
    onSuccess: (data: any) => {
      const totalSavings = data.totalAnnualSavings || 0;
      const formattedSavings = formatCurrencyK(totalSavings);
      
      toast({
        title: "Bulk Approval Successful",
        description: `Successfully approved ${data.approvedCount} recommendations with total annual savings of ${formattedSavings}`,
      });
      
      // Force refresh all related data
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/optimization-history'] });
    },
    onError: (error) => {
      toast({
        title: "Bulk Approval Failed",
        description: error instanceof Error ? error.message : "Failed to approve recommendations",
        variant: "destructive",
      });
    },
  });

  const handleApprovalRequest = (recommendationId: string) => {
    setSelectedRecommendation(recommendationId);
    // This will trigger the ApprovalModal to open
    const event = new CustomEvent('openApprovalModal', { detail: { recommendationId } });
    window.dispatchEvent(event);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Priority Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-muted rounded-lg p-4 h-32"></div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Priority Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-accent mx-auto mb-4" />
            <p className="text-muted-foreground">No pending recommendations</p>
            <p className="text-sm text-muted-foreground mt-2">All resources are optimally configured</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const pendingRecommendations = recommendations?.filter(r => r.status === 'pending') || [];
  const sortedRecommendations = [...pendingRecommendations]
    .sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder])
    .slice(0, 6); // Show more recommendations with the full width available

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertCircle className="w-4 h-4" />;
      case 'high': return <AlertCircle className="w-4 h-4" />;
      case 'medium': return <Info className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <Card data-testid="recommendations-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">Priority Recommendations</CardTitle>
          <div className="flex items-center space-x-2">
            {pendingRecommendations.length > 0 && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => approveAllMutation.mutate()}
                disabled={approveAllMutation.isPending}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                data-testid="button-approve-all"
              >
                {approveAllMutation.isPending ? (
                  <>
                    <CheckCheck className="w-4 h-4 mr-1 animate-pulse" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-4 h-4 mr-1" />
                    Approve All ({pendingRecommendations.length})
                  </>
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-primary text-sm hover:underline" data-testid="button-view-all">
              View All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRecommendations.map((recommendation, index) => {
          const isCritical = recommendation.priority === 'critical';
          
          return (
            <Card 
              key={recommendation.id} 
              className={`${isCritical ? 'border-l-4 border-l-destructive' : 'border-l-4 border-l-accent'} hover:shadow-md transition-shadow`}
              data-testid={`recommendation-${index}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`text-${getPriorityColor(recommendation.priority)}`}>
                      {getPriorityIcon(recommendation.priority)}
                    </span>
                    <Badge variant={getPriorityColor(recommendation.priority) as any}>
                      {recommendation.priority.toUpperCase()}
                    </Badge>
                    {recommendation.executionMode === 'autonomous' ? (
                      <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" data-testid={`badge-autonomous-${index}`}>
                        ✅ Auto-Optimized
                      </Badge>
                    ) : (
                      <Badge variant="default" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" data-testid={`badge-hitl-${index}`}>
                        🕒 Awaiting Approval
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" data-testid={`savings-badge-${index}`}>
                    {formatCurrencyK(recommendation.projectedMonthlySavings * 12)}/year
                  </Badge>
                </div>
                
                <h4 className="font-semibold text-foreground mb-2" data-testid={`recommendation-title-${index}`}>
                  {recommendation.title}
                </h4>
                <p className="text-sm text-muted-foreground mb-3" data-testid={`recommendation-description-${index}`}>
                  {recommendation.description}
                </p>
                
                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resource:</span>
                    <span className="font-medium" data-testid={`resource-id-${index}`}>{recommendation.resourceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Savings:</span>
                    <span className="font-bold text-accent" data-testid={`monthly-savings-${index}`}>
                      {formatCurrencyK(recommendation.projectedMonthlySavings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Level:</span>
                    <span className="text-accent" data-testid={`risk-level-${index}`}>
                      &lt; {recommendation.riskLevel}%
                    </span>
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={() => handleApprovalRequest(recommendation.id)}
                  data-testid={`button-approve-${index}`}
                >
                  Review & Approve
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
