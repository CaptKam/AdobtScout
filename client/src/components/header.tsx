import { Heart, Menu, LogOut, SlidersHorizontal, Home, HeartHandshake, Sparkles, Compass, MapPin, MessageCircle, User as UserIcon, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, UserProfile } from "@shared/schema";

interface HeaderProps {
  onFilterClick?: () => void;
  showFilterButton?: boolean;
}

export default function Header({ onFilterClick, showFilterButton = false }: HeaderProps) {
  const [, setLocation] = useLocation();

  // Fetch user data
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
  const currentMode = userProfile?.mode || 'adopt';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/30">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Filter button or Mode Badge */}
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
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10"
              data-testid="mode-badge"
            >
              {currentMode === 'adopt' ? (
                <>
                  <Heart className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-primary">Adopting</span>
                </>
              ) : currentMode === 'foster' ? (
                <>
                  <Home className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-600">Fostering</span>
                </>
              ) : (
                <>
                  <HeartHandshake className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-primary">Rehoming</span>
                </>
              )}
            </div>
          ) : null}
        </div>

        {/* Center: Logo */}
        <button
          onClick={() => setLocation("/profile")}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground fill-current" />
          </div>
          <span className="font-serif text-xl font-bold">Scout</span>
        </button>

        {/* Right: Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}