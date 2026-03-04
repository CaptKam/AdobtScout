import { Suspense, useEffect, lazy, memo, useMemo, useCallback } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SharedHeader, SharedNav } from "@/components/layout";
import { ScoutFAB } from "@/components/scout-fab";
import { PageLoading } from "@/components/ui/page-loading";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import { RoleSwitchProvider } from "@/lib/role-switch-engine";
import { ShelterLayout } from "@/components/shelter-layout";

const Onboarding = lazy(() => import("@/pages/onboarding"));
const ShelterOnboarding = lazy(() => import("@/pages/shelter-onboarding"));
const OwnerDashboard = lazy(() => import("@/pages/owner-dashboard"));
const DogForm = lazy(() => import("@/pages/dog-form"));
const DiscoverPage = lazy(() => import("@/pages/discover"));
const DogProfile = lazy(() => import("@/pages/dog-profile"));
const AdoptionApplication = lazy(() => import("@/pages/adoption-application"));
const Map = lazy(() => import("@/pages/map"));
const Chat = lazy(() => import("@/pages/chat"));
const Messages = lazy(() => import("@/pages/messages"));
const Conversation = lazy(() => import("@/pages/conversation"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const ShelterProfile = lazy(() => import("@/pages/shelter-profile"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminApprovals = lazy(() => import("@/pages/admin-approvals"));
const AdminApplications = lazy(() => import("@/pages/admin-applications"));
const AdminUsers = lazy(() => import("@/pages/admin-users"));
const AdminSettings = lazy(() => import("@/pages/admin-settings"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));
const AdminApplicationQuestions = lazy(() => import("@/pages/admin-application-questions"));
const AdminPhoneScreening = lazy(() => import("@/pages/admin-phone-screening"));
const AdminKnowledgeBase = lazy(() => import("@/pages/admin-knowledge-base"));
const AdminMarketing = lazy(() => import("@/pages/admin-marketing"));
const AdminVapi = lazy(() => import("@/pages/admin-vapi"));
const AdminCompatibilityFlags = lazy(() => import("@/pages/admin-compatibility-flags"));
const AdminDiagnostics = lazy(() => import("@/pages/admin-diagnostics"));
const AdminFeatures = lazy(() => import("@/pages/admin-features"));
const AdminEligibility = lazy(() => import("@/pages/admin-eligibility"));
const AdminPlugins = lazy(() => import("@/pages/admin-plugins"));
const AdminLayout = lazy(() => import("@/components/admin-layout").then(m => ({ default: m.AdminLayout })));
const ShelterLogin = lazy(() => import("@/pages/shelter-login"));
const DonatePage = lazy(() => import("@/pages/donate"));

// Import shelter pages with preload capability from centralized module
import {
  ShelterCommunications,
  ShelterCheckout,
  ShelterTaskAutomation,
  ShelterMedical,
  ShelterFoster,
  ShelterApplications,
  ShelterIntake,
  ShelterDogs,
  ShelterTasks,
  ShelterCalendar,
  ShelterStaffPage,
  ShelterAnalytics,
  ShelterSettings,
  ShelterApplicationBuilder,
  ShelterDonations,
  ShelterResources,
  ShelterOperations,
  ShelterPipeline,
  ShelterApplicationsCRM,
  ShelterAutomation,
  ShelterDogDetail,
  ShelterInbox,
  ShelterBulkOperations,
  ShelterPlugins,
} from "@/lib/shelter-preload";

interface User {
  id: string;
  role: 'adopter' | 'shelter';
  isAdmin?: boolean;
  isActive?: boolean;
}

// ShelterPortal - Manages all shelter routes internally with a stable ShelterLayout wrapper
// This prevents the layout from remounting when navigating between shelter pages
function ShelterPortal() {
  const [location] = useLocation();
  
  // Determine which page to show based on the current location
  const renderShelterPage = () => {
    if (location === "/shelter" || location === "/shelter/") {
      return <Redirect to="/shelter/operations" />;
    }
    if (location === "/shelter/operations") return <ShelterOperations />;
    if (location === "/shelter/pipeline") return <ShelterPipeline />;
    if (location === "/shelter/applications-crm") return <ShelterApplicationsCRM />;
    if (location === "/shelter/inbox") return <ShelterInbox />;
    if (location === "/shelter/automation") return <ShelterAutomation />;
    if (location === "/shelter/plugins") return <ShelterPlugins />;
    if (location.startsWith("/shelter/dogs/")) return <ShelterDogDetail />;
    if (location === "/shelter/dogs") return <ShelterDogs />;
    if (location === "/shelter/tasks") return <ShelterTasks />;
    if (location === "/shelter/calendar") return <ShelterCalendar />;
    if (location === "/shelter/staff") return <ShelterStaffPage />;
    if (location === "/shelter/analytics") return <ShelterAnalytics />;
    if (location === "/shelter/settings") return <ShelterSettings />;
    if (location === "/shelter/communications") return <ShelterCommunications />;
    if (location === "/shelter/checkout") return <ShelterCheckout />;
    if (location === "/shelter/task-automation") return <ShelterTaskAutomation />;
    if (location === "/shelter/medical") return <ShelterMedical />;
    if (location === "/shelter/foster") return <ShelterFoster />;
    if (location === "/shelter/applications") return <ShelterApplications />;
    if (location === "/shelter/application-builder") return <ShelterApplicationBuilder />;
    if (location === "/shelter/donations") return <ShelterDonations />;
    if (location === "/shelter/resources") return <ShelterResources />;
    if (location === "/shelter/intake") return <ShelterIntake />;
    if (location === "/shelter/bulk-operations") return <ShelterBulkOperations />;
    
    // Default to operations for any unknown shelter route
    return <ShelterOperations />;
  };

  return (
    <ShelterLayout>
      <Suspense fallback={<PageLoading />}>
        {renderShelterPage()}
      </Suspense>
    </ShelterLayout>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Switch>
        {/* Admin Routes - Separate system with own layout and login */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard">
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </Route>
        <Route path="/admin/approvals">
          <AdminLayout>
            <AdminApprovals />
          </AdminLayout>
        </Route>
        <Route path="/admin/applications">
          <AdminLayout>
            <AdminApplications />
          </AdminLayout>
        </Route>
        <Route path="/admin/users">
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        </Route>
        <Route path="/admin/settings">
          <AdminLayout>
            <AdminSettings />
          </AdminLayout>
        </Route>
        <Route path="/admin/application-questions" component={AdminApplicationQuestions} />
        <Route path="/admin/phone-screening" component={AdminPhoneScreening} />
        <Route path="/admin/knowledge-base" component={AdminKnowledgeBase} />
        <Route path="/admin/marketing">
          <AdminLayout>
            <AdminMarketing />
          </AdminLayout>
        </Route>
        <Route path="/admin/vapi" component={AdminVapi} />
        <Route path="/admin/compatibility-flags">
          <AdminLayout>
            <AdminCompatibilityFlags />
          </AdminLayout>
        </Route>
        <Route path="/admin/diagnostics" component={AdminDiagnostics} />
        <Route path="/admin/features">
          <AdminLayout>
            <AdminFeatures />
          </AdminLayout>
        </Route>
        <Route path="/admin/eligibility">
          <AdminLayout>
            <AdminEligibility />
          </AdminLayout>
        </Route>
        <Route path="/admin/plugins">
          <AdminLayout>
            <AdminPlugins />
          </AdminLayout>
        </Route>

        {/* Shelter Portal Routes - Login is outside layout */}
        <Route path="/shelter/login" component={ShelterLogin} />
        
        {/* All shelter routes use ShelterPortal which manages its own internal routing */}
        <Route path="/shelter/:rest*" component={ShelterPortal} />

        {/* Main App Routes */}
        <Route path="/" component={LandingPage} />
        <Route path="/signup" component={lazy(() => import("@/pages/signup"))} />
        <Route path="/login" component={lazy(() => import("@/pages/login"))} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/shelter-onboarding" component={ShelterOnboarding} />
        {/* Redirect old shelter-dashboard to new operations hub */}
        <Route path="/shelter-dashboard">
          <Redirect to="/shelter/operations" />
        </Route>
        <Route path="/owner-dashboard" component={OwnerDashboard} />
        <Route path="/dog-form" component={DogForm} />
        <Route path="/discover" component={DiscoverPage} />
        <Route path="/dogs/:id" component={DogProfile} />
        <Route path="/dogs/:id/apply" component={AdoptionApplication} />
        <Route path="/map" component={Map} />
        <Route path="/chat" component={Chat} />
        <Route path="/messages" component={Messages} />
        <Route path="/messages/:conversationId" component={Conversation} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/shelters/:id" component={ShelterProfile} />
        <Route path="/donate/:shelterId" component={DonatePage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppContent() {
  const [location, setLocation] = useLocation();

  const { data: currentUser, isLoading: userLoading } = useQuery<User | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const isAdminRoute = location.startsWith("/admin");
  const isShelterRoute = location.startsWith("/shelter") || location === "/shelter-dashboard" || location === "/shelter-onboarding";
  const isShelterLoginRoute = location === "/shelter/login";
  const isAdmin = currentUser?.isAdmin && currentUser?.isActive;

  // Define public routes that don't require authentication
  const publicRoutes = ["/", "/login", "/signup", "/admin/login", "/shelter/login"];
  const isDonateRoute = location.startsWith("/donate/");
  const isPublicRoute = publicRoutes.includes(location) || isDonateRoute;

  // Redirect unauthenticated users to login for protected routes
  useEffect(() => {
    if (!userLoading && !currentUser && !isPublicRoute) {
      setLocation("/login");
    }
  }, [currentUser, userLoading, isPublicRoute, setLocation]);

  useEffect(() => {
    if (!userLoading && isAdmin && !isAdminRoute && location !== "/") {
      setLocation("/admin/dashboard");
    }
  }, [isAdmin, isAdminRoute, location, userLoading, setLocation]);

  const showNavigation =
    !isAdmin &&
    !isAdminRoute &&
    !isShelterRoute &&
    !isShelterLoginRoute &&
    !isDonateRoute &&
    location !== "/" &&
    location !== "/login" &&
    location !== "/signup" &&
    location !== "/onboarding" &&
    location !== "/dog-form";

  const showHeader = !isAdmin && !isAdminRoute && !isShelterRoute && !isShelterLoginRoute && !isDonateRoute && location !== "/";

  return (
    <div className="flex min-h-screen bg-background">
      <SharedNav variant="sidebar" currentUser={currentUser} />

      <main
        className={`flex-1 flex flex-col ${
          showNavigation ? "md:ml-64 pb-[calc(4rem+max(env(safe-area-inset-bottom),0px))] md:pb-0 pt-[52px]" : showHeader ? "pt-[52px]" : ""
        }`}
      >
        {showHeader && <SharedHeader />}
        <div className="flex-1">
          <Router />
        </div>
      </main>

      <SharedNav variant="bottom" currentUser={currentUser} />
      <ScoutFAB />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RoleSwitchProvider>
          <AppContent />
        </RoleSwitchProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;