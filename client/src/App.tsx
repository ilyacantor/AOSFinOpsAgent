import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/dashboard";
import ExecutiveDashboard from "@/pages/executive-dashboard";
import CostAnalysis from "@/pages/cost-analysis";
import Recommendations from "@/pages/recommendations";
import Automation from "@/pages/automation";
import Governance from "@/pages/governance";
import AgentConfig from "@/pages/agent-config";
import FAQ from "@/pages/faq";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Auth}/>
      <AuthGuard>
        <Route path="/" component={Dashboard}/>
        <Route path="/executive" component={ExecutiveDashboard}/>
        <Route path="/cost-analysis" component={CostAnalysis}/>
        <Route path="/recommendations" component={Recommendations}/>
        <Route path="/automation" component={Automation}/>
        <Route path="/governance" component={Governance}/>
        <Route path="/agent-config" component={AgentConfig}/>
        <Route path="/faq" component={FAQ}/>
        <Route component={NotFound} />
      </AuthGuard>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
