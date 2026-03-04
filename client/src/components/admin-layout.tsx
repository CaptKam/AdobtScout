import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, LayoutDashboard, User, LogOut, Settings, FileText, ClipboardList, Phone, Brain, Megaphone, Flag, Activity, ToggleRight, UserCheck, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
} from "@/components/ui/sidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  isActive: boolean;
  adminRole?: 'platform_admin' | 'trust_safety' | 'shelter_admin' | 'ai_ops' | null;
}

function AdminSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: currentUser } = useQuery<AdminUser | null>({
    queryKey: ["/api/me"],
    retry: false,
  });

  // Fetch pending eligibility reviews count
  const { data: pendingEligibilityData } = useQuery<{ pending: number }>({
    queryKey: ["/api/admin/eligibility-reviews/pending/count"],
    refetchInterval: 60000,
    enabled: !!currentUser,
  });

  // Fetch pending approvals count
  const { data: pendingApprovalsData } = useQuery<{ pending: number }>({
    queryKey: ["/api/admin/approvals/pending/count"],
    refetchInterval: 60000,
    enabled: !!currentUser,
  });

  // Fetch pending compatibility flags count
  const { data: pendingFlagsData } = useQuery<{ pending: number }>({
    queryKey: ["/api/admin/compatibility-flags/pending/count"],
    refetchInterval: 60000,
    enabled: !!currentUser,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logout"),
    onSuccess: () => {
      queryClient.clear();
      setLocation("/admin/login");
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    },
  });

  // Role-based navigation filtering
  const userRole = currentUser?.adminRole;
  const isPlatformAdmin = userRole === 'platform_admin' || !userRole; // Legacy admins without role get full access
  const isTrustSafety = userRole === 'trust_safety';
  const isAiOps = userRole === 'ai_ops';

  // Define all nav items with role restrictions
  const allNavItems = [
    { path: "/admin/dashboard", icon: Shield, label: "Dashboard", roles: ['platform_admin'], badge: 0 },
    { path: "/admin/eligibility", icon: UserCheck, label: "Eligibility Review", roles: ['platform_admin', 'trust_safety'], badge: pendingEligibilityData?.pending || 0 },
    { path: "/admin/approvals", icon: LayoutDashboard, label: "Approvals", roles: ['platform_admin'], badge: pendingApprovalsData?.pending || 0 },
    { path: "/admin/applications", icon: FileText, label: "Applications", roles: ['platform_admin'], badge: 0 },
    { path: "/admin/compatibility-flags", icon: Flag, label: "Flags", roles: ['platform_admin', 'trust_safety'], badge: pendingFlagsData?.pending || 0 },
    { path: "/admin/users", icon: User, label: "Users", roles: ['platform_admin'], badge: 0 },
    { path: "/admin/features", icon: ToggleRight, label: "Features", roles: ['platform_admin'], badge: 0 },
    { path: "/admin/plugins", icon: Puzzle, label: "Plugins", roles: ['platform_admin'], badge: 0 },
    { path: "/admin/settings", icon: Settings, label: "Settings", roles: ['platform_admin'], badge: 0 },
    { path: "/admin/diagnostics", icon: Activity, label: "Diagnostics", roles: ['platform_admin'], badge: 0 },
  ];

  const allContentItems = [
    { path: "/admin/application-questions", icon: ClipboardList, label: "App Questions", roles: ['platform_admin'] },
    { path: "/admin/phone-screening", icon: Phone, label: "Phone Screening", roles: ['platform_admin', 'trust_safety'] },
    { path: "/admin/knowledge-base", icon: Brain, label: "AI Knowledge", roles: ['platform_admin', 'ai_ops'] },
    { path: "/admin/marketing", icon: Megaphone, label: "Marketing Partners", roles: ['platform_admin'] },
    { path: "/admin/vapi", icon: Phone, label: "Vapi", roles: ['platform_admin', 'ai_ops'] },
  ];

  // Filter items based on user's role
  const navItems = isPlatformAdmin 
    ? allNavItems 
    : allNavItems.filter(item => item.roles.includes(userRole || ''));
  
  const contentItems = isPlatformAdmin 
    ? allContentItems 
    : allContentItems.filter(item => item.roles.includes(userRole || ''));

  const displayName = currentUser?.firstName && currentUser?.lastName
    ? `${currentUser.firstName} ${currentUser.lastName}`
    : currentUser?.email || "Admin";

  return (
    <Sidebar className="bg-slate-900 border-slate-700">
      <SidebarHeader className="border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h1 className="font-bold text-lg bg-[transparent] text-[#000000]">Scout Admin</h1>
            <p className="text-xs text-slate-400">Control Panel</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-[#2a2c37]">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-400">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                const badgeCount = item.badge;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      onClick={() => setLocation(item.path)}
                      isActive={isActive}
                      className={`${
                        isActive
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                      }`}
                      data-testid={`admin-nav-${item.label.toLowerCase()}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {contentItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-400">Content Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {contentItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => setLocation(item.path)}
                        isActive={isActive}
                        className={`${
                          isActive
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                        }`}
                        data-testid={`admin-nav-${item.label.toLowerCase().replace(' ', '-')}`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-slate-700 bg-[#2a2c37]">
        <div className="p-4 bg-slate-800/50 rounded-lg mb-3 mx-2">
          <p className="text-sm font-medium text-white truncate">{displayName}</p>
          <p className="text-xs text-slate-400 truncate">{currentUser?.email}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="mx-2 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
          data-testid="button-admin-logout"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [, setLocation] = useLocation();

  // Guard: Verify admin authentication
  const { data: currentUser, isLoading } = useQuery<AdminUser | null>({
    queryKey: ["/api/me"],
    retry: false,
  });

  // Redirect non-admin users to admin login
  useEffect(() => {
    if (!isLoading && (!currentUser || !currentUser.isAdmin || !currentUser.isActive)) {
      setLocation("/admin/login");
    }
  }, [currentUser, isLoading, setLocation]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Don't render admin content for non-admins
  if (!currentUser || !currentUser.isAdmin || !currentUser.isActive) {
    return null;
  }

  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
            <SidebarTrigger className="text-foreground hover:bg-accent" data-testid="button-toggle-sidebar" />
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1.5 rounded-full border ${
                currentUser?.adminRole === 'platform_admin' ? 'bg-purple-500/10 border-purple-500/20' :
                currentUser?.adminRole === 'trust_safety' ? 'bg-blue-500/10 border-blue-500/20' :
                currentUser?.adminRole === 'ai_ops' ? 'bg-amber-500/10 border-amber-500/20' :
                'bg-green-500/10 border-green-500/20'
              }`}>
                <p className={`text-xs font-medium ${
                  currentUser?.adminRole === 'platform_admin' ? 'text-purple-600' :
                  currentUser?.adminRole === 'trust_safety' ? 'text-blue-600' :
                  currentUser?.adminRole === 'ai_ops' ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                  {currentUser?.adminRole === 'platform_admin' ? 'Platform Admin' :
                   currentUser?.adminRole === 'trust_safety' ? 'Trust & Safety' :
                   currentUser?.adminRole === 'ai_ops' ? 'AI Operations' :
                   currentUser?.adminRole === 'shelter_admin' ? 'Shelter Admin' :
                   'Admin Access'}
                </p>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
