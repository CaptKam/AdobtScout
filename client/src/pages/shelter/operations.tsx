import { Link } from "wouter";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isPast, addDays, isWithinInterval } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiRibbon, KpiRibbonSkeleton } from "@/components/shelter/kpi-ribbon";
import { EmptyStateInline } from "@/components/shelter/empty-state";

import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  Stethoscope,
  Heart,
  ChevronRight,
  RefreshCw,
  Target,
  CalendarClock,
  Syringe,
  Dog,
  Clock,
  FileCheck,
  Users,
} from "lucide-react";

interface DashboardMetrics {
  totalDogs: number;
  dogsInIntake: number;
  dogsInMedicalHold: number;
  dogsReady: number;
  overdueTasks: number;
  activeApplications: number;
}

interface StaffMe {
  role: string;
}

interface ShelterTask {
  id: string;
  title: string;
  status: "pending" | "completed";
  priority?: "low" | "medium" | "high" | "urgent";
  dueDate?: string | null;
  dogId?: string | null;
  taskType?: string;
}

interface UpcomingVaccine {
  id: string;
  dogId: string;
  dogName: string;
  vaccineName: string;
  nextDueDate: string;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatUpdatedAt(updatedAt?: number) {
  if (!updatedAt) return "—";
  return format(new Date(updatedAt), "h:mm a");
}

function getRoleBuckets(role: string) {
  const isAdmin = role === "owner" || role === "manager";
  const isMedical = role === "medical" || isAdmin;
  const isAdoptions = role === "adoption_counselor" || isAdmin;
  const isIntake = role === "kennel" || isAdmin;
  return { isAdmin, isMedical, isAdoptions, isIntake };
}

function GoalRow({ label, value, pct, variant = "default" }: { label: string; value: string; pct: number; variant?: "default" | "success" | "warning" | "danger" }) {
  const barVariants = {
    default: "",
    success: "success",
    warning: "warning",
    danger: "danger",
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{label}</p>
          <p className="text-xs text-muted-foreground">{value}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {pct}%
        </Badge>
      </div>

      <div className="progress-modern">
        <div 
          className={`progress-modern-bar ${barVariants[variant]}`}
          style={{ width: `${pct}%` }} 
        />
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  const isUrgent = priority === "urgent";
  
  return (
    <Badge 
      variant="outline" 
      className={cx(
        "shrink-0",
        isUrgent ? "border-destructive/40 text-destructive" : ""
      )}
    >
      {priority || "medium"}
    </Badge>
  );
}

export default function OperationsHub() {
  const staffQuery = useQuery<StaffMe>({
    queryKey: ["/api/shelter/staff/me"],
    retry: false,
  });

  const role = staffQuery.data?.role ?? "staff";
  const { isAdmin, isMedical, isAdoptions, isIntake } = getRoleBuckets(role);

  const metricsQuery = useQuery<DashboardMetrics>({
    queryKey: ["/api/shelter/dashboard"],
  });

  const tasksQuery = useQuery<ShelterTask[]>({
    queryKey: ["/api/shelter/tasks"],
  });

  const vaccinesQuery = useQuery<UpcomingVaccine[]>({
    queryKey: ["/api/shelter/medical/vaccines/upcoming"],
    enabled: isMedical,
  });

  const metrics = metricsQuery.data;

  const hasBlockers =
    (metrics?.dogsInMedicalHold ?? 0) > 0 ||
    (metrics?.dogsInIntake ?? 0) > 0 ||
    (metrics?.overdueTasks ?? 0) > 0;

  const nextUp = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    const pending = tasks.filter((t) => t.status !== "completed");
    const now = new Date();
    const in7 = addDays(now, 7);

    const scored = pending
      .map((t) => {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        const isOverdue = !!due && isPast(due) && !isToday(due);
        const isDueToday = !!due && isToday(due);
        const isDueSoon = !!due && isWithinInterval(due, { start: now, end: in7 });

        let score = 0;
        if (isOverdue) score += 100;
        if (isDueToday) score += 80;
        if (t.priority === "urgent") score += 70;
        if (t.priority === "high") score += 50;
        if (isDueSoon) score += 30;
        if (!due) score += 5;

        return { task: t, score, due };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scored;
  }, [tasksQuery.data]);

  const urgentVaccines = useMemo(() => {
    const list = vaccinesQuery.data ?? [];
    const now = new Date();
    const in7 = addDays(now, 7);
    return list
      .filter((v) => {
        const due = new Date(v.nextDueDate);
        return isWithinInterval(due, { start: now, end: in7 }) || isToday(due);
      })
      .slice(0, 4);
  }, [vaccinesQuery.data]);

  const updatedAt = Math.max(
    metricsQuery.dataUpdatedAt ?? 0,
    tasksQuery.dataUpdatedAt ?? 0,
    vaccinesQuery.dataUpdatedAt ?? 0
  );

  const goals = useMemo(() => {
    const ready = metrics?.dogsReady ?? 0;
    const targetReady = 25;
    const pctReady = targetReady > 0 ? Math.min(100, Math.round((ready / targetReady) * 100)) : 0;

    const holds = metrics?.dogsInMedicalHold ?? 0;
    const targetHoldsMax = 5;
    const pctHolds = targetHoldsMax > 0 ? Math.max(0, Math.min(100, Math.round(((targetHoldsMax - holds) / targetHoldsMax) * 100))) : 0;

    return {
      ready: { label: "Dogs Adoptable", value: ready, target: targetReady, pct: pctReady },
      holds: { label: "Medical Holds", value: holds, target: targetHoldsMax, pct: pctHolds },
    };
  }, [metrics?.dogsReady, metrics?.dogsInMedicalHold]);

  const loading = metricsQuery.isLoading || staffQuery.isLoading;
  const error = metricsQuery.isError || staffQuery.isError;

  const kpiMetrics = useMemo(() => [
    {
      label: "Total Pets",
      value: metrics?.totalDogs ?? 0,
      previousValue: (metrics?.totalDogs ?? 0) - 2,
      icon: <Dog className="w-4 h-4" />,
      accentColor: "default" as const,
    },
    {
      label: "Ready",
      value: metrics?.dogsReady ?? 0,
      previousValue: (metrics?.dogsReady ?? 0) - 1,
      icon: <CheckCircle className="w-4 h-4" />,
      accentColor: "success" as const,
    },
    {
      label: "Applications",
      value: metrics?.activeApplications ?? 0,
      icon: <FileCheck className="w-4 h-4" />,
      accentColor: "default" as const,
    },
    {
      label: "Overdue",
      value: metrics?.overdueTasks ?? 0,
      icon: <Clock className="w-4 h-4" />,
      accentColor: (metrics?.overdueTasks ?? 0) > 0 ? "danger" as const : "default" as const,
    },
  ], [metrics]);

  return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header with Last Updated */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 animate-fade-in-scale">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-page-title">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Focus on what matters. Route work to the right place.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-updated-at">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Updated {formatUpdatedAt(updatedAt)}</span>
          </div>
        </div>

        {/* KPI Ribbon */}
        {loading ? (
          <KpiRibbonSkeleton count={4} />
        ) : (
          <KpiRibbon metrics={kpiMetrics} className="stagger-1" />
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Dashboard data unavailable
              </CardTitle>
              <CardDescription>
                Please refresh. If this persists, check API health.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Status Overview */}
        <Card 
          className="dashboard-card transition-all" 
          data-testid="card-attention-hero"
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              {loading ? (
                <Skeleton className="h-5 w-48" />
              ) : hasBlockers ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                  <span>Items Requiring Attention</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-muted-foreground" />
                  <span>You're All Caught Up</span>
                </>
              )}
            </CardTitle>
            {hasBlockers && (
              <CardDescription>
                Review and resolve these items to keep the pipeline moving.
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5 text-sm" data-testid="text-blocker-list">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : (
                <>
                  {(metrics?.dogsInMedicalHold ?? 0) > 0 && (
                    <p className="flex items-center gap-2 text-muted-foreground" data-testid="text-medical-hold-count">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                      {metrics?.dogsInMedicalHold} dogs on medical hold
                    </p>
                  )}
                  {(metrics?.dogsInIntake ?? 0) > 0 && (
                    <p className="flex items-center gap-2 text-muted-foreground" data-testid="text-intake-count">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                      {metrics?.dogsInIntake} intakes awaiting clearance
                    </p>
                  )}
                  {(metrics?.overdueTasks ?? 0) > 0 && (
                    <p className="flex items-center gap-2" data-testid="text-overdue-count">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      {metrics?.overdueTasks} overdue tasks
                    </p>
                  )}
                  {!hasBlockers && <p className="text-muted-foreground">Nothing requires attention right now.</p>}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild data-testid="button-open-pipeline">
                <Link href="/shelter/pipeline">
                  Open Pipeline
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>

              {isAdmin && (
                <Button variant="outline" asChild data-testid="button-view-insights">
                  <Link href="/shelter/analytics">
                    View Insights
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Work Routing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ animationFillMode: 'both' }}>
          {isMedical && (
            <Card className="dashboard-card" data-testid="card-medical-queue">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Stethoscope className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Medical Queue</h3>
                    <p className="text-xs text-muted-foreground">
                      Treatments, vaccines & holds
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full justify-between" asChild data-testid="button-open-medical">
                  <Link href="/shelter/medical">
                    Open Medical
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isAdoptions && (
            <Card className="dashboard-card" data-testid="card-applications">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Applications</h3>
                    <p className="text-xs text-muted-foreground">
                      {metrics?.activeApplications ?? 0} active applications
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full justify-between" asChild data-testid="button-review-applications">
                  <Link href="/shelter/applications">
                    Review Applications
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {isIntake && (
            <Card className="dashboard-card" data-testid="card-intake">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Intake</h3>
                    <p className="text-xs text-muted-foreground">
                      New arrivals & drafts
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full justify-between" asChild data-testid="button-start-intake">
                  <Link href="/shelter/intake">
                    Start Intake
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Secondary Grid: Goals + Next Up + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ animationFillMode: 'both' }}>
          {/* Goals (Admin/Manager only) */}
          {isAdmin ? (
            <Card className="dashboard-card lg:col-span-1" data-testid="card-goals">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base dashboard-card-title">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="w-4 h-4 text-primary" />
                  </div>
                  Goals
                </CardTitle>
                <CardDescription className="text-xs">
                  Shelter performance tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <>
                    <GoalRow
                      label={goals.ready.label}
                      value={`${goals.ready.value} / ${goals.ready.target}`}
                      pct={goals.ready.pct}
                      variant={goals.ready.pct >= 75 ? "success" : goals.ready.pct >= 50 ? "warning" : "default"}
                    />
                    <GoalRow
                      label={goals.holds.label}
                      value={`${goals.holds.value} (target: ${goals.holds.target})`}
                      pct={goals.holds.pct}
                      variant={goals.holds.pct >= 100 ? "success" : goals.holds.pct >= 50 ? "default" : "warning"}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Next Up (Read-only preview) */}
          <Card className="dashboard-card lg:col-span-1" data-testid="card-next-up">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base dashboard-card-title">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CalendarClock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                Next Up
              </CardTitle>
              <CardDescription className="text-xs">
                Priority tasks preview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasksQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : nextUp.length === 0 ? (
                <EmptyStateInline variant="tasks" />
              ) : (
                <>
                  {nextUp.map(({ task, due }) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 hover-elevate"
                      data-testid={`next-up-task-${task.id}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {due
                            ? isToday(due)
                              ? `Due today`
                              : isPast(due)
                                ? `Overdue`
                                : `Due ${format(due, "MMM d")}`
                            : "No due date"}
                        </p>
                      </div>
                      <PriorityBadge priority={task.priority} />
                    </div>
                  ))}

                  <div className="pt-1">
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" asChild data-testid="button-view-all-tasks">
                      <Link href="/shelter/tasks">
                        View All Tasks
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Alerts Strip: Vaccines Due Soon */}
          <Card className="dashboard-card lg:col-span-1" data-testid="card-alerts">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base dashboard-card-title">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Syringe className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                Alerts
              </CardTitle>
              <CardDescription className="text-xs">
                High-signal reminders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {!isMedical ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No alerts for your role.
                </p>
              ) : vaccinesQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : urgentVaccines.length === 0 ? (
                <div className="py-4 text-center">
                  <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <p className="text-sm text-muted-foreground">No vaccine alerts this week</p>
                </div>
              ) : (
                <>
                  {urgentVaccines.map((v) => (
                    <div 
                      key={v.id} 
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2.5 hover-elevate"
                      data-testid={`vaccine-alert-${v.id}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.dogName}</p>
                        <p className="text-xs text-muted-foreground truncate">{v.vaccineName}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {format(new Date(v.nextDueDate), "MMM d")}
                      </Badge>
                    </div>
                  ))}

                  <div className="pt-1">
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" asChild data-testid="button-open-medical-alerts">
                      <Link href="/shelter/medical">
                        Open Medical
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
  );
}
