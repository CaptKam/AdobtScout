import { useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Building2, LayoutDashboard, Dog, LogOut, PawPrint,
  Settings, Inbox, Sparkles, Heart, Stethoscope,
  Home, Calendar, Users, BarChart3, HandHelping, Upload, ClipboardList, FileCheck,
  Bell, Search, Maximize2, Compass, MapPin, MessageCircle, User as UserIcon,
} from "lucide-react";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { cn } from "@/lib/utils";
import { ShelterBreadcrumb } from "./shelter-breadcrumb";
import { ShelterQuickActions } from "./shelter-quick-actions";
import { GlobalCommandPalette, CommandPaletteTrigger } from "./global-command-palette";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeCustomizer } from "./shelter/theme-customizer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

interface AppUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'adopter' | 'shelter';
  isAdmin?: boolean;
  isActive?: boolean;
}

interface StaffPermissions {
  role: string;
  canManageDogs: boolean;
  canManageTasks: boolean;
  canViewMedical: boolean;
  canEditMedical: boolean;
  canManageStaff: boolean;
  canViewReports: boolean;
  canManageCalendar: boolean;
  canManageApplications: boolean;
  canManageFosters: boolean;
  canViewBehavior: boolean;
  canEditBehavior: boolean;
  canViewInbox: boolean;
  canSendMessages: boolean;
}

const DEFAULT_OWNER_PERMISSIONS: StaffPermissions = {
  role: "owner",
  canManageDogs: true,
  canManageTasks: true,
  canViewMedical: true,
  canEditMedical: true,
  canManageStaff: true,
  canViewReports: true,
  canManageCalendar: true,
  canManageApplications: true,
  canManageFosters: true,
  canViewBehavior: true,
  canEditBehavior: true,
  canViewInbox: true,
  canSendMessages: true,
};

function UnifiedSidebar({ currentUser }: { currentUser: AppUser }) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { setOpenMobile, isMobile } = useSidebar();
  const isShelter = currentUser.role === "shelter";

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/shelter/conversations/unread/count"],
    refetchInterval: 30000,
    enabled: isShelter,
  });

  const { data: pendingAppsData } = useQuery<{ count: number }>({
    queryKey: ["/api/shelter/applications/pending/count"],
    refetchInterval: 60000,
    enabled: isShelter,
  });

  const { data: pendingTasksData } = useQuery<{ count: number }>({
    queryKey: ["/api/shelter/tasks/pending/count"],
    refetchInterval: 60000,
    enabled: isShelter,
  });

  const { data: urgentDogsData } = useQuery<{ count: number }>({
    queryKey: ["/api/shelter/dogs/urgent/count"],
    refetchInterval: 60000,
    enabled: isShelter,
  });

  const { data: staffPermissions } = useQuery<StaffPermissions | null>({
    queryKey: ["/api/shelter/staff/me"],
    enabled: isShelter,
    retry: false,
  });

  const permissions: StaffPermissions = staffPermissions || DEFAULT_OWNER_PERMISSIONS;

  const { data: featureFlags } = useFeatureFlags();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logout"),
    onSuccess: () => {
      queryClient.clear();
      setLocation("~/");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    },
  });

  const handleNavClick = useCallback((path: string) => {
    setLocation(path);
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [setLocation, isMobile, setOpenMobile]);

  const hasPermission = (permissionKey: keyof StaffPermissions | null): boolean => {
    if (permissionKey === null) return true;
    return permissions[permissionKey] === true;
  };

  const pathToFeatureFlag: Record<string, string> = {
    "/shelter/foster": "shelter_foster_management",
    "/shelter/medical": "shelter_medical_tracking",
    "/shelter/resources": "shelter_resources",
    "/shelter/donations": "shelter_donations",
    "/shelter/pipeline": "shelter_pipeline_view",
    "/shelter/bulk-operations": "shelter_bulk_operations",
    "/shelter/automation": "automations_engine",
    "/shelter/application-builder": "shelter_application_builder",
  };

  const isAdmin = permissions.role === "owner" || permissions.role === "manager" || permissions.canManageStaff;

  // Shelter navigation items
  const shelterCoreItems = useMemo(() => [
    { path: "/shelter/operations", icon: LayoutDashboard, label: "Dashboard", description: "Your daily dashboard", requiresPermission: null as keyof StaffPermissions | null },
    { path: "/shelter/pipeline", icon: PawPrint, label: "Pipeline", badge: urgentDogsData?.count, description: "Manage pet workflow", requiresPermission: "canManageDogs" as keyof StaffPermissions },
    { path: "/shelter/intake", icon: Upload, label: "Intake", description: "New pet arrivals", requiresPermission: "canManageDogs" as keyof StaffPermissions },
    { path: "/shelter/applications", icon: FileCheck, label: "Applications", badge: pendingAppsData?.count, description: "Adoption requests", requiresPermission: "canManageApplications" as keyof StaffPermissions },
    { path: "/shelter/medical", icon: Stethoscope, label: "Medical", description: "Health records", requiresPermission: "canViewMedical" as keyof StaffPermissions },
    { path: "/shelter/foster", icon: Home, label: "Foster", description: "Foster network", requiresPermission: "canManageFosters" as keyof StaffPermissions },
    { path: "/shelter/inbox", icon: Inbox, label: "Inbox", badge: unreadData?.count, description: "Messages & communications", requiresPermission: "canViewInbox" as keyof StaffPermissions },
  ], [urgentDogsData?.count, pendingAppsData?.count, unreadData?.count]);

  const shelterAdminItems = useMemo(() => [
    { path: "/shelter/staff", icon: Users, label: "Staff", description: "Team management", requiresPermission: "canManageStaff" as keyof StaffPermissions },
    { path: "/shelter/analytics", icon: BarChart3, label: "Analytics", description: "Reports & insights", requiresPermission: "canViewReports" as keyof StaffPermissions },
    { path: "/shelter/automation", icon: Sparkles, label: "Automation", description: "Workflow rules", requiresPermission: "canManageStaff" as keyof StaffPermissions },
    { path: "/shelter/application-builder", icon: ClipboardList, label: "Forms", description: "Custom applications", requiresPermission: "canManageStaff" as keyof StaffPermissions },
    { path: "/shelter/calendar", icon: Calendar, label: "Calendar", badge: pendingTasksData?.count, description: "Schedule & tasks", requiresPermission: "canManageCalendar" as keyof StaffPermissions },
    { path: "/shelter/settings", icon: Settings, label: "Settings", description: "Shelter settings", requiresPermission: "canManageStaff" as keyof StaffPermissions },
  ], [pendingTasksData?.count]);

  // Adopter navigation items
  const adopterItems = useMemo(() => [
    { path: "/discover", icon: Compass, label: "Discover", description: "Find your pet" },
    { path: "/map", icon: MapPin, label: "Map", description: "Nearby shelters" },
    { path: "/messages", icon: MessageCircle, label: "Messages", description: "Your conversations" },
    { path: "/profile", icon: UserIcon, label: "Profile", description: "Your profile" },
  ], []);

  const isItemVisible = (item: { path: string; requiresPermission?: keyof StaffPermissions | null }) => {
    const flagKey = pathToFeatureFlag[item.path];
    if (flagKey && !featureFlags?.enabledFeatures?.includes(flagKey)) return false;
    if ('requiresPermission' in item && !hasPermission(item.requiresPermission ?? null)) return false;
    return true;
  };

  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const displayName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.email || "User";

  const renderNavItem = (item: { path: string; icon: any; label: string; badge?: number }) => {
    const Icon = item.icon;
    const isActive = location === item.path ||
      (item.path === "/shelter/operations" && (location === "/shelter" || location === "/shelter/")) ||
      (item.path === "/messages" && location.startsWith("/messages/"));
    const badgeCount = item.badge;
    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          onClick={() => handleNavClick(item.path)}
          isActive={isActive}
          tooltip={item.label}
          data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <Icon className="w-4 h-4" />
          <span>{item.label}</span>
          {badgeCount && badgeCount > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-xs font-medium rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center">
              {badgeCount > 99 ? '99+' : badgeCount}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="bg-sidebar border-sidebar-border">
      <SidebarHeader className="border-sidebar-border">
        <div className={cn(
          "flex items-center gap-3 py-3 transition-all",
          isCollapsed ? "justify-center px-2" : "px-4"
        )}>
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
            {isShelter ? (
              <Building2 className="w-4 h-4 text-primary-foreground" />
            ) : (
              <Heart className="w-4 h-4 text-primary-foreground fill-current" />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-sm text-sidebar-foreground truncate">
                {isShelter ? "AdoptScout" : "Scout"}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {isShelter ? "Shelter Management" : "Find your pet"}
              </p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {isShelter ? (
          <>
            {/* Shelter: Core Work Section */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {shelterCoreItems.filter(isItemVisible).map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Shelter: Browse as Adopter */}
            <SidebarGroup>
              <SidebarGroupLabel>Browse</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavClick("/discover")}
                      isActive={location === "/discover"}
                      tooltip="Discover"
                    >
                      <Compass className="w-4 h-4" />
                      <span>Discover</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Shelter: Admin Section */}
            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {shelterAdminItems.filter(isItemVisible).map(renderNavItem)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </>
        ) : (
          /* Adopter Navigation */
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {adopterItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AppShellHeader({ currentUser }: { currentUser: AppUser }) {
  const [, setLocation] = useLocation();
  const isShelter = currentUser.role === "shelter";

  const displayName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.email?.split('@')[0] || "User";

  const initials = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName[0]}${currentUser.lastName[0]}`
    : currentUser?.email?.[0]?.toUpperCase() || "U";

  return (
    <header className="modern-admin-navbar h-14 md:h-16 bg-card border-b border-border flex items-center justify-between px-3 md:px-6 gap-2">
      <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
        <SidebarTrigger className="text-foreground hover:bg-accent shrink-0" data-testid="button-toggle-sidebar" />
        {isShelter && (
          <div className="hidden md:block">
            <ShelterBreadcrumb />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        {isShelter && (
          <>
            <button
              onClick={() => {
                const event = new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  bubbles: true,
                });
                document.dispatchEvent(event);
              }}
              className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
              data-testid="button-mobile-search"
            >
              <Search className="w-5 h-5" />
            </button>

            <div className="hidden lg:flex flex-1 max-w-2xl mx-4">
              <CommandPaletteTrigger />
            </div>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
              <Bell className="w-4 h-4" />
              <span className="notification-badge absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2">Mark all read</Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-4 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex"
          onClick={() => {
            if (!document.fullscreenEnabled) return;
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            } else {
              document.documentElement.requestFullscreen().catch(() => {});
            }
          }}
          data-testid="button-fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-2 ml-1" data-testid="button-user-menu">
              <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium truncate max-w-[100px]">{displayName}</span>
                <span className="text-[10px] text-muted-foreground -mt-0.5">
                  {isShelter ? "Shelter" : "Adopter"}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-medium">{displayName}</span>
                  <span className="text-xs text-muted-foreground">{currentUser?.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isShelter ? (
              <DropdownMenuItem
                onClick={() => setLocation("/shelter/settings")}
                data-testid="menu-settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setLocation("/profile")}
                data-testid="menu-profile"
              >
                <UserIcon className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                apiRequest("POST", "/api/logout").then(() => {
                  queryClient.clear();
                  setLocation("~/");
                });
              }}
              className="text-red-600"
              data-testid="menu-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppShell({ children }: AppShellProps) {
  const [, setLocation] = useLocation();

  const { data: currentUser, isLoading } = useQuery<AppUser | null>({
    queryKey: ["/api/me"],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && !currentUser) {
      setLocation("~/login");
    }
  }, [currentUser, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const isShelter = currentUser.role === "shelter";

  const sidebarStyle = {
    "--sidebar-width": "16.25rem",
    "--sidebar-width-icon": "3.75rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider defaultOpen={false} style={sidebarStyle}>
      {isShelter && <GlobalCommandPalette />}
      <div className="flex h-screen w-full bg-background">
        <UnifiedSidebar currentUser={currentUser} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <AppShellHeader currentUser={currentUser} />
          <main className="flex-1 h-0 overflow-y-auto modern-admin-content">
            {children}
          </main>
          {isShelter && <ShelterQuickActions />}
        </div>
      </div>
      {isShelter && <ThemeCustomizer />}
    </SidebarProvider>
  );
}
