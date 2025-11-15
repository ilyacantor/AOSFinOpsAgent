import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Bot, Shield, Settings, AlertTriangle, Activity } from "lucide-react";
import { formatCurrencyK } from "@/lib/currency";
import { TopNav } from "@/components/layout/top-nav";
import { useAgentConfig as useAgentConfigHook } from "@/hooks/use-agent-config";
import { Sidebar } from "@/components/layout/sidebar";
import { apiRequest } from "@/lib/queryClient";

interface AgentConfig {
  autonomousMode: boolean;
  prodMode: boolean;
  simulationMode: boolean;
  maxAutonomousRiskLevel: number;
  approvalRequiredAboveSavings: number;
  autoExecuteTypes: string[];
}

export default function AgentConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<AgentConfig | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { agentConfig: hookConfig, updateProdMode: hookUpdateProdMode } = useAgentConfigHook();

  // Fetch current agent configuration
  const { data: agentConfig, isLoading, error } = useQuery<AgentConfig>({
    queryKey: ['/api/agent-config'],
    staleTime: 30000, // 30 seconds
    retry: false, // Don't retry on 403 errors
  });

  // Update local state when data changes
  useEffect(() => {
    if (agentConfig) {
      setLocalConfig(agentConfig);
    }
  }, [agentConfig]);

  // Mutation to update autonomous mode
  const updateAutonomousMode = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest('POST', '/api/agent-config/autonomous-mode', 
        { enabled, updatedBy: 'admin-user' }
      );
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/agent-config'], data);
      toast({
        title: "Configuration Updated",
        description: `Autonomous mode ${data.autonomousMode ? 'enabled' : 'disabled'} successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update autonomous mode configuration.",
        variant: "destructive",
      });
    }
  });

  // Mutation to update prod mode
  const updateProdMode = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest('POST', '/api/agent-config/prod-mode',
        { enabled, updatedBy: 'admin-user' }
      );
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/agent-config'], data);
      toast({
        title: "Prod Mode Updated",
        description: `Prod Mode ${data.prodMode ? 'ON (AI with RAG)' : 'OFF (Heuristics)'} successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update prod mode configuration.",
        variant: "destructive",
      });
    }
  });

  // Mutation to trigger AI analysis manually
  const triggerAIAnalysis = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/ai/analyze');
      
      // Handle 204 No Content response (no body to parse)
      if (response.status === 204) {
        return { success: true };
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "AI Analysis Started",
        description: "AI-powered analysis with Gemini 2.0 Flash + RAG is running. New recommendations will appear shortly.",
      });
      // Invalidate queries to refresh recommendations when analysis completes
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/recommendations'] });
      }, 5000);
    },
    onError: () => {
      toast({
        title: "Analysis Failed",
        description: "Failed to trigger AI analysis. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Mutation to update risk level
  const updateRiskLevel = useMutation({
    mutationFn: async (riskLevel: number) => {
      const response = await apiRequest('PUT', '/api/system-config/agent.max_autonomous_risk_level',
        { value: riskLevel.toString(), updatedBy: 'admin-user' }
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent-config'] });
      toast({
        title: "Risk Level Updated",
        description: "Maximum autonomous risk level updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update risk level configuration.",
        variant: "destructive",
      });
    }
  });

  const handleToggleAutonomous = async () => {
    if (localConfig) {
      await updateAutonomousMode.mutateAsync(!localConfig.autonomousMode);
    }
  };

  // Mutation to update simulation mode
  const updateSimulationMode = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest('POST', '/api/agent-config/simulation-mode',
        { enabled, updatedBy: 'admin-user' }
      );
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/agent-config'], data);
      toast({
        title: "Simulation Mode Updated",
        description: `Simulation Mode ${data.simulationMode ? 'ON (Dynamic Data)' : 'OFF (Static Data)'} successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update simulation mode configuration.",
        variant: "destructive",
      });
    }
  });

  const handleToggleProdMode = async () => {
    if (localConfig) {
      await updateProdMode.mutateAsync(!localConfig.prodMode);
    }
  };

  const handleToggleSimulationMode = async () => {
    if (localConfig) {
      await updateSimulationMode.mutateAsync(!localConfig.simulationMode);
    }
  };

  const handleRiskLevelChange = async (value: string) => {
    const riskLevel = parseFloat(value);
    if (!isNaN(riskLevel) && riskLevel >= 0 && riskLevel <= 100) {
      setLocalConfig(prev => prev ? { ...prev, maxAutonomousRiskLevel: riskLevel } : null);
      await updateRiskLevel.mutateAsync(riskLevel);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav 
          lastSync="Error"
          prodMode={false}
          onProdModeChange={() => {}}
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
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>
                  You don't have permission to access agent configuration. 
                  This page requires administrator privileges.
                </AlertDescription>
              </Alert>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isLoading || !localConfig) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav 
          lastSync="Loading..."
          prodMode={false}
          onProdModeChange={() => {}}
          onMenuClick={() => setIsMobileSidebarOpen(true)}
        />
        <div className="flex-1 flex pt-[60px]">
          <Sidebar 
            isMobileOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
          />
          <main className="flex-1 overflow-hidden w-full">
            <div className="p-4 sm:p-6 h-full overflow-y-auto">
              <div>
                <h1 className="text-3xl font-bold">Agent Configuration</h1>
                <p className="text-muted-foreground">Loading configuration...</p>
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
        lastSync="1 min ago"
        prodMode={hookConfig?.prodMode || false}
        onProdModeChange={hookUpdateProdMode}
        onMenuClick={() => setIsMobileSidebarOpen(true)}
      />
      <div className="flex-1 flex pt-[60px]">
        <Sidebar 
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <main className="flex-1 overflow-hidden w-full">
          <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Bot className="h-8 w-8" />
          Agent Configuration
        </h1>
        <p className="text-muted-foreground">
          Configure autonomous AI agent behavior and safety controls
        </p>
      </div>

      {/* Prod Mode Card */}
      <Card className="border-cyan-500/30 bg-gradient-to-br from-background to-cyan-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-cyan-400" />
            Production Mode
            <Badge variant={localConfig.prodMode ? "default" : "secondary"} className={localConfig.prodMode ? "bg-cyan-500" : ""} data-testid="prod-mode-badge">
              {localConfig.prodMode ? "AI + RAG" : "HEURISTICS"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Toggle between AI-powered analysis with RAG and traditional heuristics-based analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="prod-mode" className="text-base font-medium">
                Production Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                {localConfig.prodMode 
                  ? "🚀 AI-powered analysis with Gemini 2.0 Flash + RAG (learns from historical optimizations)" 
                  : "⚙️ Traditional heuristics-based analysis (rule-based thresholds)"
                }
              </p>
            </div>
            <Switch
              id="prod-mode"
              checked={localConfig.prodMode}
              onCheckedChange={handleToggleProdMode}
              disabled={updateProdMode.isPending}
              data-testid="prod-mode-toggle"
            />
          </div>

          {localConfig.prodMode && (
            <>
              <Alert className="border-cyan-500/30 bg-cyan-950/10">
                <Bot className="h-4 w-4 text-cyan-400" />
                <AlertDescription>
                  <strong>AI Mode Active.</strong> Using Gemini 2.0 Flash with Retrieval Augmented Generation (RAG) 
                  to analyze resources based on historical optimization patterns and intelligent context analysis.
                </AlertDescription>
              </Alert>
              
              <div className="pt-2">
                <Button 
                  onClick={() => triggerAIAnalysis.mutate()}
                  disabled={triggerAIAnalysis.isPending}
                  className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600"
                  data-testid="trigger-ai-analysis-button"
                >
                  {triggerAIAnalysis.isPending ? (
                    <>
                      <Bot className="mr-2 h-4 w-4 animate-spin" />
                      Running AI Analysis...
                    </>
                  ) : (
                    <>
                      <Bot className="mr-2 h-4 w-4" />
                      Run AI Analysis Now
                    </>
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  Manually trigger AI-powered analysis. Normally runs automatically every 6 hours.
                </p>
              </div>
            </>
          )}

          {!localConfig.prodMode && (
            <Alert>
              <AlertDescription>
                <strong>Heuristics Mode Active.</strong> Using traditional rule-based analysis with fixed thresholds 
                (CPU &lt;40% triggers resize recommendations).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Simulation Mode Card */}
      <Card className="border-purple-500/30 bg-gradient-to-br from-background to-purple-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Simulation Mode
            <Badge variant={localConfig.simulationMode ? "default" : "secondary"} className={localConfig.simulationMode ? "bg-purple-500" : ""} data-testid="simulation-mode-badge">
              {localConfig.simulationMode ? "ON" : "OFF"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Toggle between dynamic synthetic data generation and static data mode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="simulation-mode" className="text-base font-medium">
                Simulation Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                {localConfig.simulationMode 
                  ? "📊 Dynamic data generation active (synthetic resource evolution over time)" 
                  : "📋 Static data mode (fixed resource snapshots)"
                }
              </p>
            </div>
            <Switch
              id="simulation-mode"
              checked={localConfig.simulationMode}
              onCheckedChange={handleToggleSimulationMode}
              disabled={updateSimulationMode.isPending}
              data-testid="simulation-mode-toggle"
            />
          </div>

          {localConfig.simulationMode && (
            <Alert className="border-purple-500/30 bg-purple-950/10">
              <Activity className="h-4 w-4 text-purple-400" />
              <AlertDescription>
                <strong>Simulation Active.</strong> Generating synthetic data that evolves over time with realistic 
                usage patterns, cost fluctuations, and resource lifecycle events.
              </AlertDescription>
            </Alert>
          )}

          {!localConfig.simulationMode && (
            <Alert>
              <AlertDescription>
                <strong>Static Mode Active.</strong> Using fixed resource data without time-based evolution.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Autonomous Mode Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Autonomous Operation Mode
            <Badge variant={localConfig.autonomousMode ? "default" : "secondary"} data-testid="mode-badge">
              {localConfig.autonomousMode ? "AUTONOMOUS" : "MANUAL APPROVAL"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Enable autonomous execution of cost optimization recommendations without human approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="autonomous-mode" className="text-base font-medium">
                Autonomous Execution
              </Label>
              <p className="text-sm text-muted-foreground">
                {localConfig.autonomousMode 
                  ? "Agent will automatically execute approved optimization recommendations" 
                  : "All recommendations require manual approval before execution"
                }
              </p>
            </div>
            <Switch
              id="autonomous-mode"
              checked={localConfig.autonomousMode}
              onCheckedChange={handleToggleAutonomous}
              disabled={updateAutonomousMode.isPending}
              data-testid="autonomous-toggle"
            />
          </div>

          {localConfig.autonomousMode && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Autonomous mode is active.</strong> The agent will automatically execute 
                optimizations that meet the safety criteria below. Monitor the system closely.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Safety Controls Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Safety Controls
          </CardTitle>
          <CardDescription>
            Configure safety thresholds for autonomous execution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="risk-level" className="text-base font-medium">
              Maximum Risk Level for Autonomous Execution
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="risk-level"
                type="number"
                value={localConfig.maxAutonomousRiskLevel}
                onChange={(e) => handleRiskLevelChange(e.target.value)}
                min="0"
                max="100"
                step="0.1"
                className="w-32"
                data-testid="risk-level-input"
              />
              <span className="text-sm text-muted-foreground">
                % risk threshold (recommendations above this require approval)
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-base font-medium">
              Annual Savings Threshold
            </Label>
            <div className="flex items-center gap-4">
              <Input
                type="text"
                value={formatCurrencyK(localConfig.approvalRequiredAboveSavings)}
                readOnly
                className="w-48"
                data-testid="savings-threshold-input"
              />
              <span className="text-sm text-muted-foreground">
                USD/year (recommendations above this always require approval)
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              High-value optimizations above this threshold will always require human approval, 
              regardless of risk level.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-base font-medium">
              Autonomous Execution Types
            </Label>
            <div className="flex gap-2 flex-wrap">
              {localConfig.autoExecuteTypes.map((type) => (
                <Badge key={type} variant="outline" data-testid={`auto-type-${type}`}>
                  {type}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Only these recommendation types can be executed autonomously. 
              Other types always require approval.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Current agent configuration and operational status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium">Analysis Mode</p>
              <p className="text-muted-foreground">
                {localConfig.prodMode ? "AI + RAG (Gemini 2.0 Flash)" : "Heuristics (Rule-based)"}
              </p>
            </div>
            <div>
              <p className="font-medium">Data Mode</p>
              <p className="text-muted-foreground">
                {localConfig.simulationMode ? "Dynamic (Simulation)" : "Static"}
              </p>
            </div>
            <div>
              <p className="font-medium">Operation Mode</p>
              <p className="text-muted-foreground">
                {localConfig.autonomousMode ? "Autonomous" : "Manual Approval Required"}
              </p>
            </div>
            <div>
              <p className="font-medium">Max Risk Level</p>
              <p className="text-muted-foreground">{localConfig.maxAutonomousRiskLevel}%</p>
            </div>
            <div>
              <p className="font-medium">Approval Threshold</p>
              <p className="text-muted-foreground">
                {formatCurrencyK(localConfig.approvalRequiredAboveSavings)}/year
              </p>
            </div>
            <div>
              <p className="font-medium">Auto-execute Types</p>
              <p className="text-muted-foreground">{localConfig.autoExecuteTypes.length} types</p>
            </div>
          </div>
        </CardContent>
      </Card>
          </div>
        </main>
      </div>
    </div>
  );
}