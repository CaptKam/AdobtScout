import { useLocation, Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Dog } from "@shared/schema";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const ROUTE_LABELS: Record<string, string> = {
  "shelter": "Shelter",
  "operations": "Operations Hub",
  "dogs": "Pets",
  "intake": "Intake",
  "pipeline": "Pipeline",
  "inbox": "Inbox",
  "automation": "Automation",
  "settings": "Management",
  "foster": "Foster",
  "medical": "Medical",
  "resources": "Resources",
  "donations": "Donations",
  "calendar": "Calendar",
  "staff": "Staff",
  "analytics": "Analytics",
  "bulk-operations": "Bulk Operations",
  "tasks": "Tasks",
};

export function ShelterBreadcrumb() {
  const [location] = useLocation();
  
  const pathParts = location.split("/").filter(Boolean);
  
  const dogIdMatch = location.match(/\/shelter\/dogs\/([^/]+)/);
  const dogId = dogIdMatch ? dogIdMatch[1] : null;
  
  const { data: dog } = useQuery<Dog>({
    queryKey: ["/api/dogs", dogId],
    enabled: !!dogId,
  });

  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [];
    let currentPath = "";

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      currentPath += `/${part}`;

      if (part === "shelter") {
        continue;
      }

      const isLast = i === pathParts.length - 1;
      
      if (dogId && part === dogId) {
        breadcrumbs.push({
          label: dog?.name || "Pet Details",
          href: isLast ? undefined : currentPath,
        });
      } else {
        const label = ROUTE_LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1);
        breadcrumbs.push({
          label,
          href: isLast ? undefined : currentPath,
        });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav 
      className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden"
      aria-label="Breadcrumb"
      data-testid="shelter-breadcrumb"
    >
      <Link 
        href="/shelter/operations"
        className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
        data-testid="breadcrumb-home"
      >
        <Home className="w-4 h-4" />
        <span className="sr-only">Home</span>
      </Link>
      
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center gap-1 min-w-0">
          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground/50" />
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors truncate max-w-[150px]"
              data-testid={`breadcrumb-${index}`}
            >
              {crumb.label}
            </Link>
          ) : (
            <span 
              className="text-foreground font-medium truncate max-w-[150px]"
              data-testid={`breadcrumb-${index}`}
            >
              {crumb.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
