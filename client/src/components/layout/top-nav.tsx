import { Link, useLocation } from "wouter";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Cpu, LogOut, Menu } from "lucide-react";
import autonomosLogo from "@assets/MAIN LOGO TEAL DARK BG PNG_1760814802183.png";

interface TopNavProps {
  lastSync?: string;
  prodMode: boolean;
  onProdModeChange: (enabled: boolean) => void;
  onMenuClick?: () => void;
}

function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

export function TopNav({ 
  lastSync = "Just now", 
  prodMode,
  onProdModeChange,
  onMenuClick
}: TopNavProps) {
  return (
    <nav 
      className="fixed top-0 left-0 right-0 h-[60px] bg-[#0f172a] border-b border-white/[0.08] z-50 px-4 sm:px-6"
      data-testid="top-nav"
    >
      <div className="h-full flex items-center justify-between">
        {/* Left: Hamburger Menu + Logo */}
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Button - Only visible on mobile/tablet */}
          {onMenuClick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="lg:hidden text-gray-300 hover:text-white hover:bg-white/10"
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
          
          <Link 
            href="/" 
            className="hover:opacity-80 transition-opacity"
            data-testid="nav-home-link"
          >
            <img 
              src={autonomosLogo} 
              alt="autonomOS" 
              className="h-[42px]"
            />
          </Link>
        </div>

        {/* Right: Last Sync, Toggles and Logout */}
        <div className="flex items-center gap-4">
          {/* Last Sync */}
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-xs text-gray-400">Last Sync</span>
            <span className="text-xs text-white font-medium" data-testid="last-sync">
              {lastSync}
            </span>
          </div>

          {/* Prod Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <Label 
                htmlFor="prod-mode-toggle" 
                className="text-sm text-gray-300 cursor-pointer font-medium"
              >
                Prod Mode
              </Label>
            </div>
            <Switch
              id="prod-mode-toggle"
              checked={prodMode}
              onCheckedChange={onProdModeChange}
              className="data-[state=checked]:bg-cyan-500"
              data-testid="toggle-prod-mode"
            />
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-gray-300 hover:text-white hover:bg-white/10"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
