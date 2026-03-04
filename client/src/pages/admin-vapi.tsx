import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Phone, 
  PhoneCall, 
  Brain, 
  ClipboardList, 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CallLog {
  id: string;
  type: 'phone_screening' | 'consultation';
  status: string;
  userId: string;
  userName?: string;
  dogId?: string;
  dogName?: string;
  vapiCallId?: string;
  transcript?: string;
  summary?: string;
  analytics?: {
    sentiment?: string;
    concerns?: string[];
    positiveIndicators?: string[];
  };
  createdAt: string;
  completedAt?: string;
}

interface VapiStats {
  totalCalls: number;
  completedCalls: number;
  averageSentiment: number;
  callsByType: { type: string; count: number }[];
  recentCalls: number;
  topConcerns: string[];
}

function OverviewTab() {
  const { data: stats, isLoading } = useQuery<VapiStats>({
    queryKey: ["/api/admin/vapi/stats"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const completionRate = stats?.totalCalls ? Math.round((stats.completedCalls / stats.totalCalls) * 100) : 0;
  const sentimentLabel = stats?.averageSentiment 
    ? stats.averageSentiment >= 4 ? 'Positive' : stats.averageSentiment >= 2.5 ? 'Neutral' : 'Negative'
    : 'N/A';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-calls">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCalls ?? 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card data-testid="card-recent-calls">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recent Calls</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recentCalls ?? 0}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card data-testid="card-completion-rate">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">{stats?.completedCalls ?? 0} completed</p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-sentiment">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentimentLabel}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.averageSentiment ? stats.averageSentiment.toFixed(1) : 'N/A'}/5
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-calls-by-type">
          <CardHeader>
            <CardTitle>Calls by Type</CardTitle>
            <CardDescription>Distribution of call types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.callsByType?.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.type === 'Phone Screening' ? 'bg-primary' : 'bg-blue-500'}`} />
                    <span className="text-sm font-medium">{item.type}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.count} calls</span>
                </div>
              )) ?? (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-top-concerns">
          <CardHeader>
            <CardTitle>Top Concerns</CardTitle>
            <CardDescription>Most common issues raised in calls</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.topConcerns && stats.topConcerns.length > 0 ? (
              <div className="space-y-2">
                {stats.topConcerns.map((concern, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">{concern}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No concerns identified yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CallLogsTab() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const { toast } = useToast();

  const queryParams = new URLSearchParams();
  if (typeFilter !== "all") queryParams.set("type", typeFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  const queryString = queryParams.toString();
  const endpoint = `/api/admin/vapi/call-logs${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading } = useQuery<{ calls: CallLog[]; total: number }>({
    queryKey: ["/api/admin/vapi/call-logs", typeFilter, statusFilter],
    queryFn: async () => {
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch call logs");
      return response.json();
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/vapi/sync-calls', {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Sync failed');
      return response.json();
    },
    onSuccess: (data: { synced: number; updated: number; errors: number }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vapi/call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/vapi/stats'] });
      toast({ 
        title: 'Sync complete', 
        description: `Updated ${data.updated} of ${data.synced} calls${data.errors > 0 ? ` (${data.errors} errors)` : ''}` 
      });
    },
    onError: () => {
      toast({ title: 'Sync failed', description: 'Could not sync call statuses from Vapi', variant: 'destructive' });
    }
  });

  const calls = data?.calls ?? [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSentimentBadge = (sentiment?: string) => {
    if (!sentiment) return null;
    switch (sentiment) {
      case 'positive': return <Badge className="bg-green-100 text-green-800">Positive</Badge>;
      case 'negative': return <Badge className="bg-red-100 text-red-800">Negative</Badge>;
      default: return <Badge variant="secondary">Neutral</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48" data-testid="select-type-filter">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="phone_screening">Phone Screening</SelectItem>
            <SelectItem value="consultation">Consultation</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          data-testid="button-sync-calls"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          Sync Call Statuses
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : calls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Phone className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No calls found</h3>
            <p className="text-muted-foreground">Call logs will appear here once users start making calls</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <Card 
              key={call.id} 
              className="cursor-pointer hover-elevate"
              onClick={() => setSelectedCall(call)}
              data-testid={`call-row-${call.id}`}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(call.status)}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{call.userName || 'Unknown User'}</span>
                      <Badge variant="outline" className="text-xs">
                        {call.type === 'phone_screening' ? 'Phone Screening' : 'Consultation'}
                      </Badge>
                      {call.analytics?.sentiment && getSentimentBadge(call.analytics.sentiment)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {call.dogName && <span>Re: {call.dogName}</span>}
                      {call.dogName && ' • '}
                      {new Date(call.createdAt).toLocaleDateString()} at {new Date(call.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
            <DialogDescription>
              {selectedCall?.type === 'phone_screening' ? 'Phone Screening' : 'Consultation'} Call
            </DialogDescription>
          </DialogHeader>
          
          {selectedCall && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">User</p>
                    <p className="font-medium">{selectedCall.userName || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dog</p>
                    <p className="font-medium">{selectedCall.dogName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={getStatusColor(selectedCall.status)}>
                      {selectedCall.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sentiment</p>
                    {selectedCall.analytics?.sentiment 
                      ? getSentimentBadge(selectedCall.analytics.sentiment)
                      : <span className="text-sm">N/A</span>
                    }
                  </div>
                </div>

                {selectedCall.summary && (
                  <div>
                    <p className="text-sm font-medium mb-1">Summary</p>
                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedCall.summary}</p>
                  </div>
                )}

                {selectedCall.analytics?.concerns && selectedCall.analytics.concerns.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Concerns Identified</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCall.analytics.concerns.map((concern, i) => (
                        <Badge key={i} variant="destructive" className="text-xs">
                          {concern}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCall.analytics?.positiveIndicators && selectedCall.analytics.positiveIndicators.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Positive Indicators</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCall.analytics.positiveIndicators.map((indicator, i) => (
                        <Badge key={i} className="text-xs bg-green-100 text-green-800">
                          {indicator}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCall.transcript && (
                  <div>
                    <p className="text-sm font-medium mb-1">Transcript</p>
                    <div className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {selectedCall.transcript}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickLinkCard({ 
  title, 
  description, 
  icon: Icon, 
  path 
}: { 
  title: string; 
  description: string; 
  icon: typeof Phone; 
  path: string;
}) {
  const [, setLocation] = useLocation();

  return (
    <Card 
      className="cursor-pointer hover-elevate"
      onClick={() => setLocation(path)}
    >
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
    </Card>
  );
}

export default function AdminVapi() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="page-title">
              <Phone className="w-6 h-6" />
              Vapi Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor AI phone calls, manage knowledge base, and configure screening questions
            </p>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="calls" data-testid="tab-calls">
              <PhoneCall className="w-4 h-4 mr-2" />
              Call Logs
            </TabsTrigger>
            <TabsTrigger value="config" data-testid="tab-config">
              <Users className="w-4 h-4 mr-2" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>

          <TabsContent value="calls" className="mt-6">
            <CallLogsTab />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <QuickLinkCard
                title="AI Knowledge Base"
                description="Manage knowledge content for Vapi AI phone assistants"
                icon={Brain}
                path="/admin/knowledge-base"
              />
              <QuickLinkCard
                title="Phone Screening Questions"
                description="Configure questions for AI phone screening calls"
                icon={ClipboardList}
                path="/admin/phone-screening"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
