import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/dashboard";
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
      <Route path="/">
        {() => (
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        )}
      </Route>
      {/* Redirect legacy /executive route to main dashboard */}
      <Route path="/executive">
        {() => <Redirect to="/" />}
      </Route>
      <Route path="/cost-analysis">
        {() => (
          <AuthGuard>
            <CostAnalysis />
          </AuthGuard>
        )}
      </Route>
      <Route path="/recommendations">
        {() => (
          <AuthGuard>
            <Recommendations />
          </AuthGuard>
        )}
      </Route>
      <Route path="/automation">
        {() => (
          <AuthGuard>
            <Automation />
          </AuthGuard>
        )}
      </Route>
      <Route path="/governance">
        {() => (
          <AuthGuard>
            <Governance />
          </AuthGuard>
        )}
      </Route>
      <Route path="/agent-config">
        {() => (
          <AuthGuard>
            <AgentConfig />
          </AuthGuard>
        )}
      </Route>
      <Route path="/faq">
        {() => (
          <AuthGuard>
            <FAQ />
          </AuthGuard>
        )}
      </Route>
      <Route component={NotFound} />
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
