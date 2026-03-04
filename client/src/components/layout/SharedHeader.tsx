import { Heart, Menu, LogOut, SlidersHorizontal, Home, HeartHandshake, Sparkles, Compass, MapPin, MessageCircle, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useRoleSwitch } from "@/lib/role-switch-engine";
import { MODE_COLORS } from "@/lib/design-tokens";
import type { User, UserProfile } from "@shared/schema";

interface SharedHeaderProps {
  onFilterClick?: () => void;
  showFilterButton?: boolean;
}

export function SharedHeader({ onFilterClick, showFilterButton = false }: SharedHeaderProps) {
  const [, setLocation] = useLocation();
  const { currentMode, modeConfig } = useRoleSwitch();

  const { data: currentUser } = useQuery<User | null>({
    queryKey: ["/api/me"],
  });

  const { data: userProfile } = useQuery<UserProfile | null>({
    queryKey: ["/api/profile"],
    enabled: !!currentUser && currentUser.role === 'adopter',
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const isAdopter = currentUser?.role === 'adopter';
  const modeColors = MODE_COLORS[currentMode];

  const ModeIcon = currentMode === 'adopt' ? Heart 
    : currentMode === 'foster' ? Home 
    : HeartHandshake;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/30">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showFilterButton ? (
            <Button
              variant="outline"
              size="icon"
              onClick={onFilterClick}
              data-testid="button-filters"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </Button>
          ) : isAdopter ? (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${modeColors.bgMuted}`}
              data-testid="mode-badge"
            >
              <ModeIcon className={`w-5 h-5 ${modeColors.text}`} />
              <span className={`text-sm font-medium ${modeColors.text}`}>
                {modeConfig.label}
              </span>
            </div>
          ) : null}
        </div>

        <button
          onClick={() => setLocation("/profile")}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          data-testid="link-logo"
        >
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground fill-current" />
          </div>
          <span className="font-serif text-xl font-bold">Scout</span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-menu">
              <Menu className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            {currentUser ? (
              <>
                <DropdownMenuItem onClick={() => setLocation("/chat")} className="gap-3 rounded-lg">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-primary">Scout AI</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="gap-3 rounded-lg">
                  <UserIcon className="w-4 h-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="gap-3 rounded-lg text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => setLocation("/login")} className="gap-3 rounded-lg">
                  <UserIcon className="w-4 h-4" />
                  Log In
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/signup")} className="gap-3 rounded-lg">
                  <Heart className="w-4 h-4 text-primary" />
                  <span className="text-primary">Sign Up</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
