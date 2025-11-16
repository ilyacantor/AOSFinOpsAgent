import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Database, Play, RotateCcw, CheckCircle, AlertCircle, Sparkles } from "lucide-react";

export function DataGeneratorCard() {
  const [hasData, setHasData] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateDataMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/generate-aws-data'),
    onSuccess: (data: any) => {
      setHasData(true);
      toast({
        title: "🎉 Simulation Data Generated!",
        description: `Generated ${data.resourcesCount} AWS resources and ${data.recommendationsCount} cost optimization recommendations`,
      });
      
      // Invalidate all queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/aws-resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/optimization-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/cost-trends'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Generation Failed",
        description: error.message || "Failed to generate simulation data",
        variant: "destructive",
      });
    },
  });

  const clearDataMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/clear-simulation-data'),
    onSuccess: () => {
      setHasData(false);
      toast({
        title: "Data Cleared",
        description: "All simulation data has been removed",
      });
      
      // Invalidate all queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/aws-resources'] });
      queryClient.invalidateQueries({ queryKey: ['/api/optimization-history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/cost-trends'] });
    },
    onError: (error: any) => {
      toast({
        title: "Clear Failed",
        description: error.message || "Failed to clear simulation data",
        variant: "destructive",
      });
    },
  });

  const aiAnalysisMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/ai/analyze'),
    onSuccess: () => {
      toast({
        title: "🤖 AI Analysis Started",
        description: "Gemini 2.5 Flash is analyzing your resources. New recommendations will appear shortly.",
      });
      
      // Refresh recommendations after a delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      }, 3000);
    },
    onError: (error: any) => {
      toast({
        title: "AI Analysis Failed",
        description: error.message || "Failed to start AI analysis",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            AWS Data Simulation
          </CardTitle>
          <Badge variant={hasData ? "default" : "secondary"} data-testid="simulation-status">
            {hasData ? "Active" : "Empty"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Load realistic AWS resources, cost data, and optimization recommendations to explore the FinOps platform with sample data.
        </p>
        
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            7+ AWS Resources
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            6 months cost data
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-blue-500" />
            5+ Recommendations
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-purple-500" />
            Optimization history
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={() => generateDataMutation.mutate()}
              disabled={generateDataMutation.isPending}
              className="flex-1"
              data-testid="button-generate-data"
            >
              {generateDataMutation.isPending ? (
                <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {generateDataMutation.isPending ? 'Generating...' : 'Generate Simulation Data'}
            </Button>

            {hasData && (
              <Button
                onClick={() => clearDataMutation.mutate()}
                disabled={clearDataMutation.isPending}
                variant="outline"
                size="sm"
                data-testid="button-clear-data"
              >
                Clear
              </Button>
            )}
          </div>

          {hasData && (
            <Button
              onClick={() => aiAnalysisMutation.mutate()}
              disabled={aiAnalysisMutation.isPending}
              variant="default"
              className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              data-testid="button-ai-analyze"
            >
              {aiAnalysisMutation.isPending ? (
                <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              {aiAnalysisMutation.isPending ? 'AI Analyzing...' : '🤖 Run AI Analysis (Gemini 2.5 Flash)'}
            </Button>
          )}
        </div>

        {generateDataMutation.isError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              {(generateDataMutation.error as any)?.message || 'Failed to generate data'}
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground border-t pt-3">
          <strong>What gets generated:</strong>
          <ul className="list-disc list-inside space-y-1 mt-1">
            <li>EC2 instances with utilization metrics</li>
            <li>RDS databases and S3 buckets</li>
            <li>6 months of cost and usage data</li>
            <li>Cost optimization recommendations</li>
            <li>Historical optimization results</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}