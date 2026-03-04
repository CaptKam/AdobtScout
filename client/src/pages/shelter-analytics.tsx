import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Dog, IntakeRecord, ShelterTask } from "@shared/schema";
import {
  TrendingUp,
  TrendingDown,
  Dog as DogIcon,
  Users,
  Clock,
  CheckCircle,
  Calendar,
  Activity,
  Heart,
  ArrowRight,
} from "lucide-react";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  differenceInDays,
} from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DogWithIntake extends Dog {
  intake: IntakeRecord | null;
}

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#ef4444", "#6b7280"];

export default function ShelterAnalytics() {
  const { data: dogs = [] } = useQuery<DogWithIntake[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const { data: tasks = [] } = useQuery<ShelterTask[]>({
    queryKey: ["/api/shelter/tasks"],
  });

  const { data: intakeRecords = [] } = useQuery<IntakeRecord[]>({
    queryKey: ["/api/shelter/intake"],
  });

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const recentIntakes = intakeRecords.filter(
      (r) => new Date(r.intakeDate) >= thirtyDaysAgo
    );
    const recentAdoptions = intakeRecords.filter(
      (r) => r.outcomeType === "adopted" && r.outcomeDate && new Date(r.outcomeDate) >= thirtyDaysAgo
    );

    const completedTasks = tasks.filter((t) => t.status === "completed");
    const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");

    const avgLengthOfStay = dogs.reduce((sum, dog) => {
      if (dog.intake?.intakeDate) {
        const endDate = dog.intake.outcomeDate ? new Date(dog.intake.outcomeDate) : now;
        return sum + differenceInDays(endDate, new Date(dog.intake.intakeDate));
      }
      return sum;
    }, 0) / (dogs.length || 1);

    return {
      totalDogs: dogs.length,
      adoptedThisMonth: recentAdoptions.length,
      intakesThisMonth: recentIntakes.length,
      avgLengthOfStay: Math.round(avgLengthOfStay),
      completedTasks: completedTasks.length,
      pendingTasks: pendingTasks.length,
      taskCompletionRate: tasks.length > 0 
        ? Math.round((completedTasks.length / tasks.length) * 100) 
        : 0,
    };
  }, [dogs, tasks, intakeRecords]);

  const intakesByDay = useMemo(() => {
    const last14Days = eachDayOfInterval({
      start: subDays(new Date(), 13),
      end: new Date(),
    });

    return last14Days.map((day) => ({
      date: format(day, "MMM d"),
      intakes: intakeRecords.filter((r) => isSameDay(new Date(r.intakeDate), day)).length,
      adoptions: intakeRecords.filter(
        (r) => r.outcomeType === "adopted" && r.outcomeDate && isSameDay(new Date(r.outcomeDate), day)
      ).length,
    }));
  }, [intakeRecords]);

  const pipelineDistribution = useMemo(() => {
    const statusCounts: Record<string, number> = {
      intake: 0,
      medical_hold: 0,
      behavior_eval: 0,
      ready: 0,
      adopted: 0,
    };

    dogs.forEach((dog) => {
      const status = dog.intake?.pipelineStatus || "ready";
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    });

    return Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: count,
      }));
  }, [dogs]);

  const intakeTypeDistribution = useMemo(() => {
    const typeCounts: Record<string, number> = {};

    intakeRecords.forEach((record) => {
      const type = record.intakeType || "unknown";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return Object.entries(typeCounts).map(([type, count]) => ({
      name: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: count,
    }));
  }, [intakeRecords]);

  const tasksByType = useMemo(() => {
    const typeCounts: Record<string, number> = {};

    tasks.forEach((task) => {
      const type = task.taskType || "custom";
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    return Object.entries(typeCounts)
      .map(([type, count]) => ({
        name: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [tasks]);

  return (
    
      <div className="p-4 md:p-6 space-y-6" data-testid="page-shelter-analytics">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground">Shelter performance and insights</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Dogs</p>
                  <p className="text-2xl font-bold">{stats.totalDogs}</p>
                </div>
                <DogIcon className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Adoptions (30d)</p>
                  <p className="text-2xl font-bold text-green-600">{stats.adoptedThisMonth}</p>
                </div>
                <Heart className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Intakes (30d)</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.intakesThisMonth}</p>
                </div>
                <ArrowRight className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Stay (days)</p>
                  <p className="text-2xl font-bold">{stats.avgLengthOfStay}</p>
                </div>
                <Clock className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Intakes & Adoptions</CardTitle>
              <CardDescription>Last 14 days activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={intakesByDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="intakes"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      name="Intakes"
                    />
                    <Area
                      type="monotone"
                      dataKey="adoptions"
                      stackId="2"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.6}
                      name="Adoptions"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Distribution</CardTitle>
              <CardDescription>Current dog status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {pipelineDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pipelineDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {pipelineDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Intake Sources</CardTitle>
              <CardDescription>How dogs arrive at your shelter</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {intakeTypeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={intakeTypeDistribution} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tasks by Type</CardTitle>
              <CardDescription>Task distribution across categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {tasksByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksByType}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="count" fill="#a855f7" radius={[4, 4, 0, 0]} name="Tasks" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  <p className="text-xl font-bold">{stats.completedTasks}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-100">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Pending</p>
                  <p className="text-xl font-bold">{stats.pendingTasks}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                  <p className="text-xl font-bold">{stats.taskCompletionRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    
  );
}
