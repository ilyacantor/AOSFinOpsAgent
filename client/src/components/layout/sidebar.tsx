import { Activity, Bot, ChartLine, Cog, Shield, Lightbulb, BarChart3, Presentation, HelpCircle } from "lucide-react";
import { Link, useLocation } from "wouter";

export function Sidebar() {
  const [location] = useLocation();
  
  const isActive = (path: string) => location === path;
  
  // Get user role from localStorage
  const getUserRole = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.role;
    } catch {
      return null;
    }
  };
  
  const isAdmin = getUserRole() === 'admin';
  
  return (
    <aside className="w-64 bg-card border-r border-border flex-shrink-0">
      <nav className="px-4 pt-4 pb-4">
        {/* Executive Section */}
        <div className="mb-6">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Executive
          </h3>
          <ul className="space-y-2">
            <li>
              <Link 
                href="/executive" 
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/executive') 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-executive"
              >
                <Presentation className="w-5 h-5 mr-3" />
                Executive Dashboard
              </Link>
            </li>
          </ul>
        </div>

        {/* Operations Section */}
        <div className="mb-6">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Operations
          </h3>
          <ul className="space-y-2">
            <li>
              <Link 
                href="/" 
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/') 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-dashboard"
              >
                <BarChart3 className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link 
                href="/cost-analysis" 
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/cost-analysis') 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-cost-analysis"
              >
                <ChartLine className="w-5 h-5 mr-3" />
                Cost Analysis
              </Link>
            </li>
            <li>
              <Link 
                href="/recommendations" 
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/recommendations') 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-recommendations"
              >
                <Lightbulb className="w-5 h-5 mr-3" />
                Recommendations
              </Link>
            </li>
          </ul>
        </div>

        {/* Automation & Governance Section */}
        <div className="mb-6">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Automation & Governance
          </h3>
          <ul className="space-y-2">
            <li>
              <Link 
                href="/automation" 
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/automation') 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-automation"
              >
                <Cog className="w-5 h-5 mr-3" />
                Automation
              </Link>
            </li>
            <li>
              <Link 
                href="/governance" 
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/governance') 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-governance"
              >
                <Shield className="w-5 h-5 mr-3" />
                Governance
              </Link>
            </li>
          </ul>
        </div>

        {/* Agent Configuration Section - Only visible to admins */}
        {isAdmin && (
          <div className="mb-6">
            <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              AI Configuration
            </h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/agent-config" 
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/agent-config') 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  data-testid="nav-agent-config"
                >
                  <Bot className="w-5 h-5 mr-3" />
                  Agent Config
                </Link>
              </li>
            </ul>
          </div>
        )}

        {/* Help Section */}
        <div className="mb-6">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Help
          </h3>
          <ul className="space-y-2">
            <li>
              <Link 
                href="/faq" 
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/faq') 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-faq"
              >
                <HelpCircle className="w-5 h-5 mr-3" />
                FAQ
              </Link>
            </li>
          </ul>
        </div>
        
        <div className="mt-8">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">AWS Services</h3>
          <ul className="mt-3 space-y-2">
            <li>
              <div className="flex items-center px-3 py-1 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-accent rounded-full mr-3 animate-pulse"></div>
                Cost & Usage Reports
              </div>
            </li>
            <li>
              <div className="flex items-center px-3 py-1 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-accent rounded-full mr-3 animate-pulse"></div>
                CloudWatch
              </div>
            </li>
            <li>
              <div className="flex items-center px-3 py-1 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-accent rounded-full mr-3 animate-pulse"></div>
                Trusted Advisor
              </div>
            </li>
          </ul>
        </div>
      </nav>
    </aside>
  );
}
