
import { Heart, Menu, User, Settings } from "lucide-react";
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

export function AppHeader() {
  const [, setLocation] = useLocation();
  
  const { data: user } = useQuery<any>({
    queryKey: ["/api/me"],
    retry: false,
  });

  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile"],
    enabled: !!user && user.role === 'adopter',
    retry: false,
  });

  const handleProfileClick = () => {
    if (!user) return;
    
    // Check if adopter is in rehoming mode or has legacy owner role
    if (user.role === 'adopter' && profile?.mode === 'rehome') {
      setLocation('/owner-dashboard');
    } else if (user.role === 'adopter') {
      setLocation('/profile');
    } else if (user.role === 'shelter') {
      setLocation('/shelter/operations');
    } else if (user.role === 'owner') {
      setLocation('/owner-dashboard');
    }
  };

  const getDashboardLabel = () => {
    if (!user) return "My Profile";
    
    if (user.role === 'adopter' && profile?.mode === 'rehome') {
      return "Dog Dashboard";
    } else if (user.role === 'adopter') {
      return "My Profile";
    } else if (user.role === 'shelter') {
      return "Shelter Dashboard";
    } else if (user.role === 'owner') {
      return "Dog Dashboard";
    }
    return "My Profile";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-card-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Hamburger Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="w-7 h-7" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={handleProfileClick}>
              <User className="w-5 h-5 mr-3" />
              {getDashboardLabel()}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleProfileClick}>
              <Settings className="w-5 h-5 mr-3" />
              Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleProfileClick}
            data-testid="button-profile"
          >
            <User className="w-5 h-5 mr-2" />
            {getDashboardLabel()}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleProfileClick}
            data-testid="button-settings"
          >
            <Settings className="w-5 h-5 mr-2" />
            Settings
          </Button>
        </div>

        {/* Center: Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Heart className="w-6 h-6 text-primary-foreground fill-current" />
          </div>
          <span className="font-serif text-2xl font-bold">Scout</span>
        </div>

        {/* Right: Placeholder for balance */}
        <div className="w-10 md:w-auto" />
      </div>
    </header>
  );
}
