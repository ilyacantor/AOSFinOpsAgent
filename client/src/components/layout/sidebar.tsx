import { Activity, Bot, ChartLine, Cog, Shield, Lightbulb, BarChart3, HelpCircle, BookOpen, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { Recommendation } from "@shared/schema";

interface SidebarProps {
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onClose }: SidebarProps) {
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

  // Get pending recommendations count for badge
  const { data: recommendations = [] } = useQuery<Recommendation[]>({
    queryKey: ['/api/recommendations'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const pendingCount = recommendations.filter(r => r.status === 'pending').length;

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
  
  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };
  
  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={(e) => {
            e.stopPropagation();
            onClose?.();
          }}
          data-testid="sidebar-backdrop"
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex-shrink-0 
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        onClick={(e) => e.stopPropagation()}
        data-testid="sidebar"
      >
        {/* Mobile close button */}
        <div className="lg:hidden flex justify-end p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <nav className="px-4 pt-0 lg:pt-4 pb-4">
        {/* Operations Section */}
        <div className="mb-6">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Operations
          </h3>
          <ul className="space-y-2">
            <li>
              <Link 
                href="/"
                onClick={handleLinkClick}
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
                onClick={handleLinkClick}
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
                onClick={handleLinkClick}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/recommendations')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-recommendations"
              >
                <Lightbulb className="w-5 h-5 mr-3" />
                <span className="flex-1">Recommendations</span>
                {pendingCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-2 h-5 min-w-5 flex items-center justify-center text-xs px-1.5"
                    data-testid="pending-count-badge"
                  >
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            </li>
          </ul>
        </div>

        {/* Automation Section */}
        <div className="mb-6">
          <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Automation
          </h3>
          <ul className="space-y-2">
            <li>
              <Link
                href="/automation"
                onClick={handleLinkClick}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/automation')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-automation"
              >
                <Cog className="w-5 h-5 mr-3" />
                Rules
              </Link>
            </li>
            <li>
              <Link 
                href="/governance"
                onClick={handleLinkClick}
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
                  onClick={handleLinkClick}
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
                onClick={handleLinkClick}
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
            <li>
              <Link
                href="/user-guide"
                onClick={handleLinkClick}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/user-guide')
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid="nav-user-guide"
              >
                <BookOpen className="w-5 h-5 mr-3" />
                User Guide
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
    </>
  );
}
