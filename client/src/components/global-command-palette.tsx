import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dog,
  PawPrint,
  Calendar,
  Inbox,
  LayoutDashboard,
  Settings,
  Users,
  Stethoscope,
  Home,
  BarChart3,
  ClipboardList,
  Sparkles,
  Plus,
  CheckSquare,
  AlertCircle,
  Clock,
  Search,
  FileCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useFeatureFlags } from "@/hooks/use-feature-flags";

interface DogResult {
  id: string;
  name: string;
  breed?: string;
  pipelineStatus?: string;
  urgencyLevel?: string;
  photoUrls?: string[];
}

interface TaskResult {
  id: string;
  title: string;
  status: string;
  dueDate?: string;
  priority?: string;
  dog?: { id: string; name: string } | null;
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

const navigationItems = [
  { path: "/shelter/operations", icon: LayoutDashboard, label: "Operations Hub", keywords: "dashboard home ops", requiresPermission: null, featureFlag: null },
  { path: "/shelter/pipeline", icon: PawPrint, label: "Pipeline", keywords: "workflow stages dogs pets", requiresPermission: "canManageDogs" as keyof StaffPermissions, featureFlag: "shelter_pipeline_view" },
  { path: "/shelter/inbox", icon: Inbox, label: "Inbox", keywords: "messages chat communication", requiresPermission: "canViewInbox" as keyof StaffPermissions, featureFlag: null },
  { path: "/shelter/calendar", icon: Calendar, label: "Calendar", keywords: "schedule events appointments", requiresPermission: "canManageCalendar" as keyof StaffPermissions, featureFlag: null },
  { path: "/shelter/dogs", icon: Dog, label: "Pet Directory", keywords: "all dogs pets list", requiresPermission: null, featureFlag: null },
  { path: "/shelter/intake", icon: Inbox, label: "Intake", keywords: "new arrivals add pet", requiresPermission: "canManageDogs" as keyof StaffPermissions, featureFlag: null },
  { path: "/shelter/applications", icon: FileCheck, label: "Applications", keywords: "adoption requests pending", requiresPermission: "canManageApplications" as keyof StaffPermissions, featureFlag: null },
  { path: "/shelter/medical", icon: Stethoscope, label: "Medical", keywords: "health records vet vaccines", requiresPermission: "canViewMedical" as keyof StaffPermissions, featureFlag: "shelter_medical_tracking" },
  { path: "/shelter/foster", icon: Home, label: "Foster", keywords: "foster network homes", requiresPermission: "canManageFosters" as keyof StaffPermissions, featureFlag: "shelter_foster_management" },
  { path: "/shelter/staff", icon: Users, label: "Staff", keywords: "team members permissions", requiresPermission: "canManageStaff" as keyof StaffPermissions, featureFlag: null },
  { path: "/shelter/automation", icon: Sparkles, label: "Automation", keywords: "rules workflows auto", requiresPermission: "canManageStaff" as keyof StaffPermissions, featureFlag: "automations_engine" },
  { path: "/shelter/application-builder", icon: ClipboardList, label: "Forms", keywords: "questionnaire application builder", requiresPermission: "canManageStaff" as keyof StaffPermissions, featureFlag: "shelter_application_builder" },
  { path: "/shelter/analytics", icon: BarChart3, label: "Analytics", keywords: "reports stats insights", requiresPermission: "canViewReports" as keyof StaffPermissions, featureFlag: null },
  { path: "/shelter/settings", icon: Settings, label: "Settings", keywords: "configuration preferences", requiresPermission: "canManageStaff" as keyof StaffPermissions, featureFlag: null },
];

const quickActions = [
  { id: "new-intake", icon: Plus, label: "New Intake", description: "Add a new pet", path: "/shelter/intake" },
  { id: "new-task", icon: CheckSquare, label: "New Task", description: "Create a task", action: "new-task" },
];

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { data: featureFlags } = useFeatureFlags();

  const { data: dogs = [] } = useQuery<DogResult[]>({
    queryKey: ["/api/shelter/dogs"],
    enabled: open,
  });

  const { data: tasks = [] } = useQuery<TaskResult[]>({
    queryKey: ["/api/shelter/tasks"],
    enabled: open,
  });

  const { data: staffPermissions, isLoading: permissionsLoading } = useQuery<StaffPermissions | null>({
    queryKey: ["/api/shelter/staff/me"],
    retry: false,
  });

  const permissions: StaffPermissions = staffPermissions || {
    role: "unknown",
    canManageDogs: false,
    canManageTasks: false,
    canViewMedical: false,
    canEditMedical: false,
    canManageStaff: false,
    canViewReports: false,
    canManageCalendar: false,
    canManageApplications: false,
    canManageFosters: false,
    canViewBehavior: false,
    canEditBehavior: false,
    canViewInbox: false,
    canSendMessages: false,
  };

  const hasPermission = (permissionKey: keyof StaffPermissions | null): boolean => {
    if (permissionKey === null) return true;
    if (permissionsLoading) return false;
    return permissions[permissionKey] === true;
  };

  const filteredNavigationItems = useMemo(() => {
    return navigationItems.filter((item) => {
      if (item.featureFlag && !featureFlags?.enabledFeatures?.includes(item.featureFlag)) {
        return false;
      }
      if (!hasPermission(item.requiresPermission)) {
        return false;
      }
      return true;
    });
  }, [featureFlags, permissions, permissionsLoading]);

  const filteredQuickActions = useMemo(() => {
    return quickActions.filter((action) => {
      if (action.id === "new-intake" && !hasPermission("canManageDogs")) return false;
      if (action.id === "new-task" && !hasPermission("canManageTasks")) return false;
      return true;
    });
  }, [permissions, permissionsLoading]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback((value: string) => {
    setOpen(false);

    if (value.startsWith("nav:")) {
      setLocation(value.replace("nav:", ""));
    } else if (value.startsWith("dog:")) {
      const dogId = value.replace("dog:", "");
      setLocation(`/shelter/pipeline?focus=${dogId}`);
    } else if (value.startsWith("task:")) {
      setLocation("/shelter/calendar");
    } else if (value.startsWith("action:")) {
      const action = value.replace("action:", "");
      if (action === "new-intake") {
        setLocation("/shelter/intake");
      } else if (action === "new-task") {
        setLocation("/shelter/calendar");
      }
    }
  }, [setLocation]);

  const getUrgencyBadge = (level?: string) => {
    if (level === "critical") {
      return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    }
    if (level === "urgent") {
      return <Badge className="text-xs bg-orange-500">Urgent</Badge>;
    }
    return null;
  };

  const getPriorityIcon = (priority?: string) => {
    if (priority === "urgent") {
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    }
    if (priority === "high") {
      return <AlertCircle className="w-3 h-3 text-orange-500" />;
    }
    return null;
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const urgentDogs = dogs.filter((d) => d.urgencyLevel === "critical" || d.urgencyLevel === "urgent");

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search pets, tasks, or type a command..."
        data-testid="command-palette-input"
      />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick Actions */}
        {filteredQuickActions.length > 0 && (
          <CommandGroup heading="Quick Actions">
            {filteredQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.id}
                  value={`action:${action.id}`}
                  onSelect={handleSelect}
                  data-testid={`command-action-${action.id}`}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{action.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{action.description}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Urgent Dogs */}
        {urgentDogs.length > 0 && (
          <>
            <CommandGroup heading="Urgent Pets">
              {urgentDogs.slice(0, 5).map((dog) => (
                <CommandItem
                  key={dog.id}
                  value={`dog:${dog.id}`}
                  onSelect={handleSelect}
                  data-testid={`command-dog-${dog.id}`}
                >
                  <PawPrint className="mr-2 h-4 w-4" />
                  <span className="font-medium">{dog.name}</span>
                  {dog.breed && (
                    <span className="ml-2 text-xs text-muted-foreground">{dog.breed}</span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {getUrgencyBadge(dog.urgencyLevel)}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Pending Tasks */}
        {pendingTasks.length > 0 && (
          <>
            <CommandGroup heading="Pending Tasks">
              {pendingTasks.slice(0, 5).map((task) => (
                <CommandItem
                  key={task.id}
                  value={`task:${task.id}`}
                  onSelect={handleSelect}
                  data-testid={`command-task-${task.id}`}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  <span className={isOverdue(task.dueDate) ? "text-red-500" : ""}>
                    {task.title}
                  </span>
                  {task.dog && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {task.dog.name}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {getPriorityIcon(task.priority)}
                    {isOverdue(task.dueDate) && (
                      <Badge variant="destructive" className="text-xs">Overdue</Badge>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* All Dogs (searchable) */}
        <CommandGroup heading="Pets">
          {dogs.slice(0, 10).map((dog) => (
            <CommandItem
              key={dog.id}
              value={`dog:${dog.id} ${dog.name} ${dog.breed || ""}`}
              onSelect={() => handleSelect(`dog:${dog.id}`)}
              data-testid={`command-dog-${dog.id}`}
            >
              <PawPrint className="mr-2 h-4 w-4" />
              <span>{dog.name}</span>
              {dog.breed && (
                <span className="ml-2 text-xs text-muted-foreground">{dog.breed}</span>
              )}
              {dog.pipelineStatus && (
                <Badge variant="outline" className="ml-auto text-xs">
                  {dog.pipelineStatus.replace(/_/g, " ")}
                </Badge>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {filteredNavigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.path}
                value={`nav:${item.path} ${item.label} ${item.keywords}`}
                onSelect={() => handleSelect(`nav:${item.path}`)}
                data-testid={`command-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>

      <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">esc</kbd>
            close
          </span>
        </div>
        <span className="flex items-center gap-1">
          <Search className="w-3 h-3" />
          Type to search
        </span>
      </div>
    </CommandDialog>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => {
        const event = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      }}
      className="flex items-center gap-3 w-full max-w-md px-4 py-2.5 text-sm text-muted-foreground bg-background/50 hover:bg-background border border-border/50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md hover:border-border focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      data-testid="command-palette-trigger"
    >
      <Search className="w-5 h-5 text-muted-foreground/70" />
      <span className="flex-1 text-left font-normal">Search pets, tasks, or navigate...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 bg-muted/60 rounded-md text-xs font-medium border border-border/30">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
