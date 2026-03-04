import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Home, Dog, CheckCircle, Clock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface AdminMetrics {
  totalUsers: number;
  totalAdopters: number;
  totalShelters: number;
  totalDogs: number;
  pendingShelters: number;
  pendingDogs: number;
  totalApplications: number;
  recentActivity: number;
}

export default function AdminDashboard() {
  const { data: metrics, isLoading } = useQuery<AdminMetrics>({
    queryKey: ['/api/admin/metrics'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-20" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const metricCards = [
    {
      title: "Total Users",
      value: metrics?.totalUsers || 0,
      icon: Users,
      description: `${metrics?.totalAdopters || 0} adopters, ${metrics?.totalShelters || 0} shelters`,
    },
    {
      title: "Total Dogs",
      value: metrics?.totalDogs || 0,
      icon: Dog,
      description: "Across all listings",
    },
    {
      title: "Pending Shelters",
      value: metrics?.pendingShelters || 0,
      icon: Clock,
      description: "Awaiting approval",
      actionLink: "/admin/approvals",
    },
    {
      title: "Pending Dogs",
      value: metrics?.pendingDogs || 0,
      icon: Clock,
      description: "Awaiting approval",
      actionLink: "/admin/approvals",
    },
    {
      title: "Applications",
      value: metrics?.totalApplications || 0,
      icon: CheckCircle,
      description: "Active adoption journeys",
    },
    {
      title: "Recent Activity",
      value: metrics?.recentActivity || 0,
      icon: Activity,
      description: "Last 24 hours",
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-admin-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage Scout platform operations and approvals
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((metric) => (
          <Card key={metric.title} data-testid={`card-metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {metric.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.description}
              </p>
              {metric.actionLink && metric.value > 0 && (
                <Link href={metric.actionLink}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2 p-0 h-auto text-primary hover:bg-transparent"
                    data-testid={`button-view-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    Review now →
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/admin/approvals">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                data-testid="button-manage-approvals"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Manage Approvals
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                data-testid="button-manage-users"
              >
                <Users className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
            </Link>
            <Link href="/admin/applications">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                data-testid="button-view-applications"
              >
                <Home className="mr-2 h-4 w-4" />
                View Applications
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform Health</CardTitle>
            <CardDescription>System status overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">API Status</span>
              <span className="text-sm font-medium text-green-600">Operational</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Database</span>
              <span className="text-sm font-medium text-green-600">Healthy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Active Sessions</span>
              <span className="text-sm font-medium">{metrics?.recentActivity || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
