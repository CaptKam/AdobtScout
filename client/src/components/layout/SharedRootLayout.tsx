import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { SharedHeader } from "./SharedHeader";
import { SharedNav } from "./SharedNav";
import { ScoutFAB } from "@/components/scout-fab";

interface User {
  id: string;
  role: 'adopter' | 'shelter';
  isAdmin?: boolean;
  isActive?: boolean;
}

interface SharedRootLayoutProps {
  children: React.ReactNode;
}

const EXCLUDED_PATHS = [
  "/",
  "/login",
  "/signup",
  "/onboarding",
  "/shelter-onboarding",
  "/dog-form",
];

const ADMIN_PATHS_PREFIX = "/admin";

export function SharedRootLayout({ children }: SharedRootLayoutProps) {
  const [location] = useLocation();
  
  const { data: currentUser, isLoading: userLoading } = useQuery<User | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  const isAdminRoute = location.startsWith(ADMIN_PATHS_PREFIX);
  const isExcludedPath = EXCLUDED_PATHS.includes(location);
  const isAdmin = currentUser?.isAdmin && currentUser?.isActive;

  const showNavigation = !isAdmin && !isAdminRoute && !isExcludedPath;
  const showHeader = !isAdmin && !isAdminRoute && location !== "/";
  const showFAB = !isAdminRoute && !isExcludedPath;

  return (
    <div className="flex min-h-screen bg-background">
      {showNavigation && (
        <SharedNav 
          variant="sidebar" 
          currentUser={currentUser} 
        />
      )}

      <main
        className={`flex-1 flex flex-col ${
          showNavigation 
            ? "md:ml-64 pb-[calc(4rem+max(env(safe-area-inset-bottom),0px))] md:pb-0 pt-[52px]" 
            : showHeader 
              ? "pt-[52px]" 
              : ""
        }`}
      >
        {showHeader && <SharedHeader />}
        <div className="flex-1">
          {children}
        </div>
      </main>

      {showNavigation && (
        <SharedNav 
          variant="bottom" 
          currentUser={currentUser} 
        />
      )}
      
      {showFAB && <ScoutFAB />}
    </div>
  );
}
