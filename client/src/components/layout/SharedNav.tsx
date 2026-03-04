import { startTransition, memo, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Heart, MapPin, MessageCircle, User, Compass, LayoutDashboard, Sparkles } from "lucide-react";
import { useRoleSwitch, type UserMode } from "@/lib/role-switch-engine";
import { MODE_COLORS } from "@/lib/design-tokens";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

interface User {
  id: string;
  role: 'adopter' | 'shelter';
  isAdmin?: boolean;
  isActive?: boolean;
}

interface SharedNavProps {
  variant: 'bottom' | 'sidebar';
  currentUser: User | null | undefined;
}

const NAV_ITEMS_BY_MODE: Record<UserMode, { path: string; icon: typeof Heart; label: string }[]> = {
  adopt: [
    { path: "/discover", icon: Compass, label: "Discover" },
    { path: "/map", icon: MapPin, label: "Map" },
    { path: "/messages", icon: MessageCircle, label: "Messages" },
    { path: "/profile", icon: User, label: "Profile" },
  ],
  foster: [
    { path: "/discover", icon: Compass, label: "Discover" },
    { path: "/map", icon: MapPin, label: "Map" },
    { path: "/messages", icon: MessageCircle, label: "Messages" },
    { path: "/profile", icon: User, label: "Profile" },
  ],
  rehome: [
    { path: "/discover", icon: Compass, label: "Discover" },
    { path: "/map", icon: MapPin, label: "Map" },
    { path: "/messages", icon: MessageCircle, label: "Messages" },
    { path: "/owner-dashboard", icon: LayoutDashboard, label: "My Listings" },
  ],
};

const SHELTER_NAV_ITEMS = [
  { path: "/shelter/operations", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/messages", icon: MessageCircle, label: "Messages" },
];

const EXCLUDED_PATHS = [
  "/",
  "/login",
  "/signup",
  "/onboarding",
  "/shelter-onboarding",
  "/dog-form",
];

export const SharedNav = memo(function SharedNav({ variant, currentUser }: SharedNavProps) {
  const [location, setLocation] = useLocation();
  const { currentMode, modeConfig } = useRoleSwitch();
  const modeColors = MODE_COLORS[currentMode];
  const { data: featureFlags, isLoading: featuresLoading } = useFeatureFlags();

  const handleNavClick = useCallback((path: string) => {
    startTransition(() => setLocation(path));
  }, [setLocation]);

  // Filter nav items based on enabled features
  // Default to showing ALL items while loading to prevent UI flickering
  const navItems = useMemo(() => {
    const baseItems = currentUser?.role === 'shelter'
      ? SHELTER_NAV_ITEMS
      : NAV_ITEMS_BY_MODE[currentMode];
    
    // While loading, show all items (default to enabled)
    if (featuresLoading || !featureFlags) {
      return baseItems;
    }
    
    const enabledFeatures = featureFlags.enabledFeatures;
    
    return baseItems;
  }, [currentUser?.role, currentMode, featureFlags, featuresLoading]);

  // Only show navigation for authenticated users
  if (!currentUser) {
    return null;
  }

  // Hide SharedNav on admin and shelter portal pages (they have their own layouts)
  if (EXCLUDED_PATHS.includes(location) || 
      location.startsWith("/admin") || 
      location.startsWith("/shelter") ||
      location === "/shelter-dashboard" ||
      location === "/shelter-onboarding") {
    return null;
  }

  if (variant === 'bottom') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[max(env(safe-area-inset-bottom),0px)] px-4 pointer-events-none">
        <nav className="glass-dock rounded-2xl mb-2 flex justify-around items-center h-16 max-w-md mx-auto pointer-events-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path ||
              (item.path === "/messages" && location.startsWith("/messages/"));
            return (
              <button
                key={item.path}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2 px-4 transition-all duration-200 rounded-xl haptic-press ${
                  isActive
                    ? `${modeColors.text}`
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => startTransition(() => setLocation(item.path))}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                aria-current={isActive ? "page" : undefined}
              >
                <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${
                  isActive ? `${modeColors.bgMuted}` : ""
                }`}>
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "stroke-[2.5] scale-110" : ""}`} />
                  {isActive && (
                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${modeColors.bg}`} />
                  )}
                </div>
                <span className={`text-[10px] transition-all duration-200 ${isActive ? "font-semibold" : "font-medium opacity-70"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div className="hidden md:block fixed left-0 top-0 bottom-0 w-64 glass-card border-r border-border/10">
      <div className="p-5 space-y-6 pt-[68px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg bg-[#e9640c]">
            <Heart className="w-5 h-5 fill-current text-white" />
          </div>
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight">Scout</h1>
            <p className={`text-xs ${modeColors.text} font-medium`}>{modeConfig.description}</p>
          </div>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path ||
              (item.path === "/messages" && location.startsWith("/messages/"));
            return (
              <button
                key={item.path}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 haptic-press ${
                  isActive
                    ? `${modeColors.bgMuted} ${modeColors.text} shadow-sm`
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
                onClick={() => startTransition(() => setLocation(item.path))}
                data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? "stroke-[2.5] scale-110" : ""}`} />
                <span className={`text-sm transition-all duration-200 ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                {isActive && (
                  <div className={`ml-auto w-1.5 h-1.5 rounded-full ${modeColors.bg}`} />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
});
