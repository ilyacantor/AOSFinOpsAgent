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
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const { agentConfig, updateProdMode } = useAgentConfig();
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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
        onMenuClick={() => setIsMobileSidebarOpen(true)}
      />
      <div className="flex-1 flex pt-[60px]">
        <Sidebar 
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <main className="flex-1 overflow-hidden w-full">
        
        <div className="p-4 sm:p-6 h-full overflow-y-auto">
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
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8 mt-8">
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
