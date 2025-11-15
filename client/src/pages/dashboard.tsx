import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { useAgentConfig } from "@/hooks/use-agent-config";
import { AiModeIndicator } from "@/components/ai-mode-indicator";
import { RecommendationsPanel } from "@/components/dashboard/recommendations-panel";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ResourceMonitor } from "@/components/dashboard/resource-monitor";
import { ApprovalModal } from "@/components/modals/approval-modal";
import { DataFlowVisualization } from "@/components/data-flow-viz";
import { OptimizationMix } from "@/components/dashboard/optimization-mix";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const { agentConfig, updateProdMode } = useAgentConfig();
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (lastMessage) {
      // Handle real-time updates
      switch (lastMessage.type) {
        case 'new_recommendation':
          toast({
            title: "New Optimization Opportunity",
            description: `${lastMessage.data.title} - Potential savings: $${Number(lastMessage.data.projectedAnnualSavings).toLocaleString()}/year`,
          });
          queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
          break;
        case 'optimization_executed':
          toast({
            title: lastMessage.data.status === 'success' ? "Optimization Completed" : "Optimization Failed",
            description: lastMessage.data.status === 'success' ? "Resource optimization executed successfully" : lastMessage.data.error,
            variant: lastMessage.data.status === 'success' ? "default" : "destructive",
          });
          queryClient.invalidateQueries({ queryKey: ['/api/optimization-history'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/metrics'] });
          break;
      }
    }
  }, [lastMessage, toast]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AiModeIndicator />
      <TopNav 
        lastSync="Just now"
        prodMode={agentConfig?.prodMode || false}
        onProdModeChange={updateProdMode}
      />
      <div className="flex-1 flex pt-[60px]">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
        
        <div className="p-6 h-full overflow-y-auto">
          {/* Data Flow Visualization with integrated metrics */}
          <DataFlowVisualization />
          
          {/* Optimization Mix */}
          <div className="mt-8">
            <OptimizationMix />
          </div>
          
          {/* Recommendations Section - Responsive Layout */}
          <div className="mt-8">
            <RecommendationsPanel />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            <ActivityFeed />
            <ResourceMonitor />
          </div>
        </div>
        </main>
      </div>
      
      <ApprovalModal />
    </div>
  );
}
