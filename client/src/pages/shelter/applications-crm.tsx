import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, Filter, MessageSquare, FileText, Phone,
  Calendar, CheckCircle, XCircle, Clock, AlertCircle,
  User, Dog, ChevronRight, Mail, MoreHorizontal,
  Send, ArrowRight
} from "lucide-react";
import { EmptyState } from "@/components/shelter/empty-state";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { AdoptionJourney, Dog as DogType, User as UserType, Conversation } from "@shared/schema";

interface ApplicationWithDetails extends AdoptionJourney {
  dog?: DogType;
  applicant?: UserType;
}

interface ConversationWithDetails extends Conversation {
  dog?: DogType;
  applicant?: UserType;
  lastMessage?: string;
  unreadCount?: number;
}

const APPLICATION_STATUSES = [
  { id: 'all', label: 'All', icon: FileText },
  { id: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-500' },
  { id: 'needs_info', label: 'Needs Info', icon: AlertCircle, color: 'text-orange-500' },
  { id: 'phone_screening', label: 'Phone Screening', icon: Phone, color: 'text-blue-500' },
  { id: 'interview_scheduled', label: 'Interview', icon: Calendar, color: 'text-purple-500' },
  { id: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-green-500' },
  { id: 'ready_for_checkout', label: 'Ready for Checkout', icon: ArrowRight, color: 'text-emerald-500' },
  { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-gray-500' },
  { id: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-red-500' },
];

export default function ApplicationsCRM() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApplication, setSelectedApplication] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("applications");
  const { toast } = useToast();

  const { data: applications = [], isLoading: loadingApplications } = useQuery<ApplicationWithDetails[]>({
    queryKey: ["/api/shelter/applications"],
  });

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<ConversationWithDetails[]>({
    queryKey: ["/api/shelter/conversations"],
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ applicationId, status }: { applicationId: string; status: string }) => {
      return apiRequest("PATCH", `/api/shelter/applications/${applicationId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/applications"] });
      toast({
        title: "Status updated",
        description: "Application status has been updated.",
      });
    },
  });

  // Filter applications
  const filteredApplications = applications.filter(app => {
    const matchesSearch = 
      app.applicant?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicant?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.applicant?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.dog?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Count by status
  const statusCounts = APPLICATION_STATUSES.reduce((acc, status) => {
    acc[status.id] = status.id === 'all' 
      ? applications.length 
      : applications.filter(app => app.status === status.id).length;
    return acc;
  }, {} as Record<string, number>);

  const getStatusBadge = (status: string) => {
    const statusConfig = APPLICATION_STATUSES.find(s => s.id === status);
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      needs_info: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      phone_screening: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      interview_scheduled: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      approved: 'bg-green-500/10 text-green-600 border-green-500/20',
      ready_for_checkout: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      completed: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
      rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    return colors[status] || colors.pending;
  };

  const selectedApp = selectedApplication 
    ? applications.find(app => app.id === selectedApplication)
    : null;

  return (
    
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Applications & Messages</h1>
              <p className="text-sm md:text-base text-muted-foreground">Unified CRM for all adopter communications</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search applicants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                  data-testid="input-search"
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="applications" className="gap-2">
                <FileText className="w-4 h-4" />
                Applications
                <Badge variant="secondary" className="ml-1">{applications.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Messages
                <Badge variant="secondary" className="ml-1">{conversations.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {activeTab === "applications" && (
            <>
              {/* Left Sidebar - Status Filters */}
              <div className="w-56 border-r bg-muted/30 p-4 hidden lg:block">
                <h3 className="text-sm font-medium mb-3">Filter by Status</h3>
                <div className="space-y-1">
                  {APPLICATION_STATUSES.map((status) => {
                    const Icon = status.icon;
                    const isActive = statusFilter === status.id;
                    return (
                      <button
                        key={status.id}
                        onClick={() => setStatusFilter(status.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive 
                            ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                        data-testid={`filter-${status.id}`}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${status.color || ''}`} />
                          {status.label}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {statusCounts[status.id] || 0}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Application List */}
              <div className="flex-1 flex">
                <ScrollArea className="w-96 border-r">
                  <div className="p-4 space-y-2">
                    {/* Mobile filter */}
                    <div className="lg:hidden mb-4">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          {APPLICATION_STATUSES.map((status) => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.label} ({statusCounts[status.id] || 0})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {filteredApplications.length === 0 ? (
                      <EmptyState 
                        variant="applications" 
                        title={searchQuery ? "No matching applications" : undefined}
                        description={searchQuery ? "Try adjusting your search or filter criteria." : undefined}
                      />
                    ) : (
                      filteredApplications.map((app) => (
                        <Card
                          key={app.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedApplication === app.id ? 'ring-2 ring-primary' : ''
                          }`}
                          onClick={() => setSelectedApplication(app.id)}
                          data-testid={`application-card-${app.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={app.applicant?.profileImageUrl || ''} />
                                <AvatarFallback>
                                  {app.applicant?.firstName?.[0] || 'A'}
                                  {app.applicant?.lastName?.[0] || ''}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium truncate">
                                    {app.applicant?.firstName} {app.applicant?.lastName}
                                  </p>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  Interested in: {app.dog?.name || 'Unknown'}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className={getStatusBadge(app.status)}>
                                    {app.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Application Detail */}
                <div className="flex-1 bg-muted/20">
                  {selectedApp ? (
                    <ScrollArea className="h-full">
                      <div className="p-6 space-y-6">
                        {/* Applicant Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="w-16 h-16">
                              <AvatarImage src={selectedApp.applicant?.profileImageUrl || ''} />
                              <AvatarFallback className="text-xl">
                                {selectedApp.applicant?.firstName?.[0] || 'A'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <h2 className="text-xl font-bold">
                                {selectedApp.applicant?.firstName} {selectedApp.applicant?.lastName}
                              </h2>
                              <p className="text-muted-foreground">{selectedApp.applicant?.email}</p>
                              <Badge variant="outline" className={`mt-2 ${getStatusBadge(selectedApp.status)}`}>
                                {selectedApp.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                if (selectedApp.applicant?.email) {
                                  window.location.href = `mailto:${selectedApp.applicant.email}`;
                                } else {
                                  toast({
                                    title: "No email available",
                                    description: "This applicant doesn't have an email on file.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid="button-email-applicant"
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              Email
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const phone = (selectedApp.applicant as any)?.phone;
                                if (phone) {
                                  window.location.href = `tel:${phone}`;
                                } else {
                                  toast({
                                    title: "No phone number available",
                                    description: "This applicant doesn't have a phone number on file.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid="button-call-applicant"
                            >
                              <Phone className="w-4 h-4 mr-2" />
                              Call
                            </Button>
                          </div>
                        </div>

                        {/* Dog Info */}
                        {selectedApp.dog && (
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-medium text-muted-foreground">
                                Interested In
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Link href={`/shelter/dogs/${selectedApp.dog.id}`}>
                                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                                    {selectedApp.dog.photos?.[0] ? (
                                      <img 
                                        src={selectedApp.dog.photos[0]} 
                                        alt={selectedApp.dog.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Dog className="w-8 h-8 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium">{selectedApp.dog.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {selectedApp.dog.breed} · {selectedApp.dog.age} years · {selectedApp.dog.size}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                                </div>
                              </Link>
                            </CardContent>
                          </Card>
                        )}

                        {/* Status Actions */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Update Status
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-2">
                              {APPLICATION_STATUSES.filter(s => s.id !== 'all').map((status) => (
                                <Button
                                  key={status.id}
                                  variant={selectedApp.status === status.id ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => {
                                    updateApplicationMutation.mutate({
                                      applicationId: selectedApp.id,
                                      status: status.id,
                                    });
                                  }}
                                  disabled={updateApplicationMutation.isPending}
                                  data-testid={`status-btn-${status.id}`}
                                >
                                  {status.label}
                                </Button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Application Details */}
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                              Application Details
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <p className="text-sm font-medium">Submitted</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(selectedApp.createdAt), 'PPpp')}
                              </p>
                            </div>
                            {selectedApp.notes && (
                              <div>
                                <p className="text-sm font-medium">Notes</p>
                                <p className="text-sm text-muted-foreground">{selectedApp.notes}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Select an application to view details</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "messages" && (
            <div className="flex-1 flex">
              {/* Conversation List */}
              <ScrollArea className="w-96 border-r">
                <div className="p-4 space-y-2">
                  {conversations.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No conversations yet</p>
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <Card
                        key={conv.id}
                        className="cursor-pointer transition-all hover:shadow-md"
                        data-testid={`conversation-card-${conv.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback>
                                {conv.applicant?.firstName?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="font-medium truncate">
                                  {conv.applicant?.firstName || 'User'}
                                </p>
                                {conv.unreadCount && conv.unreadCount > 0 && (
                                  <Badge className="bg-primary">{conv.unreadCount}</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                About: {conv.dog?.name || 'General'}
                              </p>
                              {conv.lastMessage && (
                                <p className="text-sm text-muted-foreground truncate mt-1">
                                  {conv.lastMessage}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Message Thread */}
              <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/20">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to view messages</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    
  );
}
