import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, MessageSquare, FileText, Phone,
  Calendar, CheckCircle, XCircle, Clock, AlertCircle,
  Dog, Mail, Send, ArrowRight, Inbox as InboxIcon,
  Filter, Star, Archive, MoreHorizontal, RefreshCw,
  ChevronDown, Bell, Eye, Reply, ArrowLeft
} from "lucide-react";
import { EmptyStateInline } from "@/components/shelter/empty-state";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { AdoptionJourney, Dog as DogType, User as UserType, Conversation, UserProfile, FamilyMember, HouseholdPet, AdopterVerification } from "@shared/schema";

interface ApplicationWithDetails extends AdoptionJourney {
  dog?: DogType;
  applicant?: UserType;
  // API returns these fields
  user?: { id: string; firstName?: string; lastName?: string; email?: string };
  userProfile?: UserProfile;
  familyMembers?: FamilyMember[];
  householdPets?: HouseholdPet[];
  verification?: AdopterVerification;
}

interface ConversationWithDetails extends Conversation {
  dog?: DogType;
  applicant?: UserType;
  lastMessage?: string;
  unreadCount?: number;
}

type InboxItemType = 'application' | 'message';

interface InboxItem {
  id: string;
  type: InboxItemType;
  timestamp: Date;
  applicantName: string;
  applicantEmail?: string;
  applicantAvatar?: string;
  dogName: string;
  dogId?: string;
  preview: string;
  status?: string;
  isUnread?: boolean;
  unreadCount?: number;
  originalData: ApplicationWithDetails | ConversationWithDetails;
}

const INBOX_FILTERS = [
  { id: 'all', label: 'All Inbox', icon: InboxIcon },
  { id: 'unread', label: 'Unread', icon: Bell },
  { id: 'applications', label: 'Applications', icon: FileText },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'starred', label: 'Starred', icon: Star },
];

const STATUS_FILTERS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'pending', label: 'Pending', color: 'text-yellow-500' },
  { id: 'needs_info', label: 'Needs Info', color: 'text-orange-500' },
  { id: 'phone_screening', label: 'Phone Screening', color: 'text-blue-500' },
  { id: 'interview_scheduled', label: 'Interview Scheduled', color: 'text-purple-500' },
  { id: 'approved', label: 'Approved', color: 'text-green-500' },
  { id: 'ready_for_checkout', label: 'Ready for Checkout', color: 'text-emerald-500' },
  { id: 'completed', label: 'Completed', color: 'text-gray-500' },
  { id: 'rejected', label: 'Rejected', color: 'text-red-500' },
];

const getStatusBadgeClasses = (status: string) => {
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

const getStatusLabel = (status: string) => {
  const statusItem = STATUS_FILTERS.find(s => s.id === status);
  return statusItem?.label || status?.replace(/_/g, ' ') || 'Unknown';
};

export default function UnifiedInbox() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [starredItems, setStarredItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleStarred = (itemId: string) => {
    setStarredItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/applications"] });
      // Also refresh the timeline to show the new status change event
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/applications', variables.applicationId, 'messages'] });
      toast({
        title: "Status updated",
        description: "Application status has been updated and added to timeline.",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, itemId, type }: { message: string; itemId: string; type: InboxItemType }) => {
      // Extract the actual ID from the prefixed itemId (e.g., "app-123" -> "123")
      const actualId = itemId.replace(/^(app-|msg-)/, '');
      
      if (type === 'application') {
        // Send message to applicant via application endpoint
        return apiRequest("POST", `/api/shelter/applications/${actualId}/message`, { content: message });
      } else {
        // Send message to existing conversation
        return apiRequest("POST", `/api/shelter/conversations/${actualId}/messages`, { content: message });
      }
    },
    onSuccess: (_, variables) => {
      setReplyMessage("");
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/applications"] });
      // Invalidate the specific application's messages
      const actualId = variables.itemId.replace(/^(app-|msg-)/, '');
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/applications', actualId, 'messages'] });
    },
  });

  const unifiedItems = useMemo<InboxItem[]>(() => {
    const items: InboxItem[] = [];

    applications.forEach(app => {
      // API returns 'user' field, not 'applicant'
      const applicant = app.user || app.applicant;
      const firstName = applicant?.firstName || 'Unknown';
      const lastName = applicant?.lastName || '';
      const email = applicant?.email;
      // Profile image might be in userProfile or directly on applicant
      const profileImage = app.userProfile?.profileImage || (app.applicant as any)?.profileImageUrl;
      
      items.push({
        id: `app-${app.id}`,
        type: 'application',
        timestamp: new Date(app.updatedAt || app.createdAt || Date.now()),
        applicantName: `${firstName} ${lastName}`.trim(),
        applicantEmail: email ?? undefined,
        applicantAvatar: profileImage ?? undefined,
        dogName: app.dog?.name || 'Unknown Dog',
        dogId: app.dogId ?? undefined,
        preview: `Application for ${app.dog?.name || 'a dog'} - Status: ${getStatusLabel(app.status)}`,
        status: app.status,
        isUnread: app.status === 'pending',
        originalData: app,
      });
    });

    conversations.forEach(conv => {
      items.push({
        id: `msg-${conv.id}`,
        type: 'message',
        timestamp: new Date(conv.createdAt || Date.now()),
        applicantName: `${conv.applicant?.firstName || 'Unknown'} ${conv.applicant?.lastName || ''}`.trim(),
        applicantEmail: conv.applicant?.email ?? undefined,
        dogName: conv.dog?.name || 'General Inquiry',
        dogId: conv.dogId ?? undefined,
        preview: conv.lastMessage || 'New conversation',
        isUnread: (conv.unreadCount || 0) > 0,
        unreadCount: conv.unreadCount,
        originalData: conv,
      });
    });

    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return items;
  }, [applications, conversations]);

  const filteredItems = useMemo(() => {
    return unifiedItems.filter(item => {
      const matchesSearch = 
        item.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.applicantEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.dogName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.preview.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFilter = true;
      if (activeFilter === 'applications') matchesFilter = item.type === 'application';
      else if (activeFilter === 'messages') matchesFilter = item.type === 'message';
      else if (activeFilter === 'unread') matchesFilter = item.isUnread === true;
      else if (activeFilter === 'starred') matchesFilter = starredItems.has(item.id);

      let matchesStatus = true;
      if (statusFilter !== 'all' && item.type === 'application') {
        matchesStatus = item.status === statusFilter;
      }

      return matchesSearch && matchesFilter && matchesStatus;
    });
  }, [unifiedItems, searchQuery, activeFilter, statusFilter, starredItems]);

  const selectedItem = selectedItemId 
    ? unifiedItems.find(item => item.id === selectedItemId)
    : null;

  const filterCounts = useMemo(() => {
    return {
      all: unifiedItems.length,
      unread: unifiedItems.filter(i => i.isUnread).length,
      applications: unifiedItems.filter(i => i.type === 'application').length,
      messages: unifiedItems.filter(i => i.type === 'message').length,
      starred: starredItems.size,
    };
  }, [unifiedItems, starredItems]);

  const isLoading = loadingApplications || loadingConversations;

  return (
    
      <div className="h-[calc(100vh-64px)] flex flex-col">
        <div className="p-3 md:p-6 pb-3 md:pb-4 border-b bg-background">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Inbox</h1>
                <p className="text-muted-foreground text-xs md:text-sm hidden sm:block">All applications and messages in one place</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/shelter/applications"] });
                queryClient.invalidateQueries({ queryKey: ["/api/shelter/conversations"] });
              }} data-testid="button-refresh">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px] md:w-40" data-testid="select-status-filter">
                  <Filter className="w-4 h-4 mr-1 md:mr-2 flex-shrink-0" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-48 border-r bg-muted/30 p-3 hidden lg:block">
            <div className="space-y-1">
              {INBOX_FILTERS.map((filter) => {
                const Icon = filter.icon;
                const isActive = activeFilter === filter.id;
                const count = filterCounts[filter.id as keyof typeof filterCounts] || 0;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive 
                        ? 'bg-primary/10 text-primary font-medium' 
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    data-testid={`filter-${filter.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {filter.label}
                    </span>
                    {count > 0 && (
                      <Badge variant="secondary" className="text-xs h-5 min-w-5 flex items-center justify-center">
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inbox list - full width on mobile, fixed width on desktop. Hidden on mobile when item selected */}
          <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col ${selectedItemId ? 'hidden md:flex' : 'flex'}`}>
            <div className="lg:hidden p-2 border-b">
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  {INBOX_FILTERS.map(filter => (
                    <SelectItem key={filter.id} value={filter.id}>
                      {filter.label} ({filterCounts[filter.id as keyof typeof filterCounts] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
                    <p>Loading inbox...</p>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <InboxIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No items found</p>
                    <p className="text-sm mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${
                        selectedItemId === item.id 
                          ? 'bg-primary/5 border-primary/20 shadow-sm' 
                          : 'border-transparent hover:bg-muted/50'
                      } ${item.isUnread ? 'bg-primary/5' : ''}`}
                      data-testid={`inbox-item-${item.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStarred(item.id); }}
                          className="mt-0.5 flex-shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center -m-2 md:m-0"
                          data-testid={`star-${item.id}`}
                        >
                          <Star className={`w-5 h-5 md:w-4 md:h-4 transition-colors ${
                            starredItems.has(item.id) 
                              ? 'fill-yellow-400 text-yellow-400' 
                              : 'text-muted-foreground hover:text-yellow-400'
                          }`} />
                        </button>
                        <div className="relative">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={item.applicantAvatar} />
                            <AvatarFallback className="text-xs">
                              {item.applicantName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          {item.isUnread && (
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`font-medium truncate text-sm ${item.isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {item.applicantName}
                            </p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(item.timestamp, { addSuffix: false })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.type === 'application' ? (
                              <FileText className="w-3 h-3 text-blue-500 flex-shrink-0" />
                            ) : (
                              <MessageSquare className="w-3 h-3 text-green-500 flex-shrink-0" />
                            )}
                            <span className="text-xs text-muted-foreground truncate">
                              {item.dogName}
                            </span>
                            {item.unreadCount && item.unreadCount > 0 && (
                              <Badge className="bg-primary text-xs h-4 px-1.5">{item.unreadCount}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {item.preview}
                          </p>
                          {item.status && (
                            <Badge variant="outline" className={`text-xs mt-1.5 ${getStatusBadgeClasses(item.status)}`}>
                              {getStatusLabel(item.status)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Detail panel - hidden on mobile when no item selected, full width on mobile when item selected */}
          <div className={`flex-1 flex flex-col bg-muted/10 ${selectedItemId ? 'flex' : 'hidden md:flex'}`}>
            {selectedItem ? (
              <>
                <div className="p-3 md:p-4 border-b bg-background flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {/* Back button - mobile only */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="md:hidden flex-shrink-0"
                      onClick={() => setSelectedItemId(null)}
                      data-testid="button-back"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Avatar className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0">
                      <AvatarImage src={selectedItem.applicantAvatar} />
                      <AvatarFallback className="text-xs md:text-sm">
                        {selectedItem.applicantName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm md:text-base truncate">{selectedItem.applicantName}</h3>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">{selectedItem.applicantEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                    <Button variant="outline" size="icon" className="md:hidden" data-testid="button-email-mobile">
                      <Mail className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="md:hidden" data-testid="button-call-mobile">
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="hidden md:flex">
                      <Mail className="w-4 h-4 mr-2" />
                      Email
                    </Button>
                    <Button variant="outline" size="sm" className="hidden md:flex">
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="p-4 md:p-6 space-y-4 md:space-y-6">
                    {selectedItem.type === 'application' && (
                      <ApplicationDetail 
                        application={selectedItem.originalData as ApplicationWithDetails}
                        onStatusChange={(status) => {
                          const app = selectedItem.originalData as ApplicationWithDetails;
                          updateApplicationMutation.mutate({ applicationId: app.id, status });
                        }}
                        isPending={updateApplicationMutation.isPending}
                      />
                    )}
                    {selectedItem.type === 'message' && (
                      <MessageDetail 
                        conversation={selectedItem.originalData as ConversationWithDetails}
                      />
                    )}
                  </div>
                </ScrollArea>

                <div className="p-3 md:p-4 border-t bg-background">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder={selectedItem.type === 'application' 
                        ? "Message this applicant..." 
                        : "Type your reply..."}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (replyMessage.trim()) {
                            sendMessageMutation.mutate({
                              message: replyMessage,
                              itemId: selectedItem.id,
                              type: selectedItem.type
                            });
                          }
                        }
                      }}
                      className="min-h-[50px] md:min-h-[60px] resize-none text-sm md:text-base"
                      data-testid="input-reply"
                    />
                    <Button 
                      className="self-end" 
                      size="icon"
                      disabled={!replyMessage.trim() || sendMessageMutation.isPending}
                      onClick={() => {
                        if (replyMessage.trim()) {
                          sendMessageMutation.mutate({
                            message: replyMessage,
                            itemId: selectedItem.id,
                            type: selectedItem.type
                          });
                        }
                      }}
                      data-testid="button-send"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <InboxIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Select an item</p>
                  <p className="text-sm">Choose an application or message to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    
  );
}

interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: string;
  messageType: string;
  content: string;
  isRead: boolean;
  timestamp: string;
}

function ApplicationDetail({ 
  application, 
  onStatusChange,
  isPending 
}: { 
  application: ApplicationWithDetails;
  onStatusChange: (status: string) => void;
  isPending: boolean;
}) {
  // Get applicant info from the API response (uses 'user' not 'applicant')
  const applicant = application.user || application.applicant;
  const userProfile = application.userProfile;
  const familyMembers = application.familyMembers || [];
  const householdPets = application.householdPets || [];
  const verification = application.verification;
  
  // Fetch messages for this application
  const { data: messages = [], isLoading: loadingMessages } = useQuery<MessageData[]>({
    queryKey: ['/api/shelter/applications', application.id, 'messages'],
    queryFn: async () => {
      const res = await fetch(`/api/shelter/applications/${application.id}/messages`, {
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  return (
    <div className="space-y-6">
      {/* CONTEXT FIRST: Dog Card */}
      {application.dog && (
        <Card className="border-primary/20 bg-primary/5" data-testid="dog-context-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {application.dog.photos?.[0] ? (
                  <img 
                    src={application.dog.photos[0]} 
                    alt={application.dog.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Dog className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg">{application.dog.name}</h3>
                  <Badge variant="outline" className={getStatusBadgeClasses(application.status)}>
                    {getStatusLabel(application.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {application.dog.breed} · {application.dog.age} · {application.dog.size}
                </p>
                <p className="text-xs text-muted-foreground">
                  Application submitted {application.createdAt ? formatDistanceToNow(new Date(application.createdAt), { addSuffix: true }) : 'recently'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* READINESS & STATUS ACTIONS */}
      <Card data-testid="actions-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              {verification?.isReadyToAdopt ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Ready to Adopt
                </Badge>
              ) : verification ? (
                <Badge variant="outline" className="text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {verification.backgroundCheckStatus?.replace(/_/g, ' ') || 'Pending Verification'}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  No Verification
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">
                {applicant?.firstName} {applicant?.lastName}
              </span>
            </div>
            <div className="flex gap-2">
              <Select 
                value={application.status} 
                onValueChange={onStatusChange}
                disabled={isPending}
              >
                <SelectTrigger className="w-[180px]" data-testid="select-status">
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.filter(s => s.id !== 'all').map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applicant Information (collapsed by default) */}
      <Card data-testid="applicant-info-card">
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-sm md:text-base flex items-center gap-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={userProfile?.profileImage || undefined} />
              <AvatarFallback className="text-xs">
                {applicant?.firstName?.[0]}{applicant?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            Applicant Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Name</p>
              <p className="font-medium" data-testid="applicant-name">
                {applicant?.firstName} {applicant?.lastName}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
              <p className="font-medium" data-testid="applicant-email">
                {applicant?.email || 'Not provided'}
              </p>
            </div>
          </div>

          {/* Profile Details */}
          {userProfile && (
            <>
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {userProfile.homeType && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Housing</p>
                    <p className="text-sm capitalize">{userProfile.homeType?.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {userProfile.hasYard !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Yard</p>
                    <p className="text-sm">{userProfile.hasYard ? 'Yes' : 'No'}</p>
                  </div>
                )}
                {userProfile.activityLevel && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Activity Level</p>
                    <p className="text-sm capitalize">{userProfile.activityLevel}</p>
                  </div>
                )}
                {userProfile.workSchedule && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Work Schedule</p>
                    <p className="text-sm capitalize">{userProfile.workSchedule?.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {userProfile.experienceLevel && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Experience</p>
                    <p className="text-sm capitalize">{userProfile.experienceLevel?.replace(/_/g, ' ')}</p>
                  </div>
                )}
                {userProfile.hasChildren !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Has Children</p>
                    <p className="text-sm">{userProfile.hasChildren ? 'Yes' : 'No'}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Family Members */}
          {familyMembers.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Household Members ({familyMembers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {familyMembers.map((member, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {member.name} ({member.relation}{member.ageGroup ? `, ${member.ageGroup}` : ''})
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Household Pets */}
          {householdPets.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Current Pets ({householdPets.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {householdPets.map((pet, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {pet.name} - {pet.species}{pet.age ? ` (${pet.age}y)` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Verification Status */}
          {verification && (
            <>
              <Separator />
              <div className="flex items-center gap-2">
                {verification.isReadyToAdopt ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Ready to Adopt
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Clock className="w-3 h-3 mr-1" />
                    Verification: {verification.backgroundCheckStatus?.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 md:pb-3">
          <CardTitle className="text-sm md:text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const applicantName = applicant?.firstName || 'there';
              const dogName = application.dog?.name || 'a dog';
              const subject = `Meet & Greet - ${dogName}`;
              const body = `Hi ${applicantName},\n\nThank you for your interest in ${dogName}! We'd love to schedule a meet and greet.\n\nWhen would be a good time for you?\n\nBest regards`;
              window.location.href = `mailto:${applicant?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              onStatusChange('interview_scheduled');
            }}
            disabled={isPending}
            className="text-xs md:text-sm h-auto py-2"
            data-testid="action-schedule-meet"
          >
            <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate">Schedule Meet</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const phone = (applicant as any)?.phone || userProfile?.phoneNumber;
              if (phone) {
                window.location.href = `tel:${phone}`;
                onStatusChange('phone_screening');
              }
            }}
            disabled={isPending || !((applicant as any)?.phone || userProfile?.phoneNumber)}
            className="text-xs md:text-sm h-auto py-2"
            data-testid="action-phone-screen"
          >
            <Phone className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate">Call Now</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const applicantName = applicant?.firstName || 'there';
              const dogName = application.dog?.name || 'a dog';
              const subject = `Additional Information Needed - ${dogName}`;
              const body = `Hi ${applicantName},\n\nWe're reviewing your application for ${dogName} and need some additional information to proceed.\n\nCould you please provide:\n\n[Add specific requests here]\n\nThank you!`;
              window.location.href = `mailto:${applicant?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              onStatusChange('needs_info');
            }}
            disabled={isPending}
            className="text-xs md:text-sm h-auto py-2"
            data-testid="action-request-info"
          >
            <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate">Request Info</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              onStatusChange('approved');
            }}
            disabled={isPending}
            className="text-xs md:text-sm h-auto py-2"
            data-testid="action-pre-approve"
          >
            <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate">Approve</span>
          </Button>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMessages ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Loading timeline...
            </div>
          ) : messages.length === 0 ? (
            <EmptyStateInline 
              variant="messages"
              title="No activity yet"
              description="Status updates and messages will appear here."
            />
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto" data-testid="timeline-list">
              {messages.map((msg) => {
                const isSystem = msg.senderType === 'system';
                const isShelter = msg.senderType === 'shelter_staff';
                
                if (isSystem) {
                  // System event styling (centered, muted)
                  return (
                    <div key={msg.id} className="flex justify-center" data-testid={`timeline-event-${msg.id}`}>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-full px-4 py-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs text-muted-foreground">{msg.content}</span>
                        <span className="text-xs text-muted-foreground/60">
                          {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  );
                }
                
                // Message styling (left/right aligned)
                return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isShelter ? 'justify-end' : 'justify-start'}`}
                    data-testid={`timeline-message-${msg.id}`}
                  >
                    <div 
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        isShelter 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-3 h-3" />
                        <span className="text-xs font-medium">
                          {isShelter ? 'You' : 'Applicant'}
                        </span>
                      </div>
                      <p>{msg.content}</p>
                      <p className={`text-xs mt-1 ${isShelter ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MessageDetail({ conversation }: { conversation: ConversationWithDetails }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-green-500" />
        </div>
        <div>
          <h4 className="font-semibold">Message Thread</h4>
          <p className="text-sm text-muted-foreground">
            About: {conversation.dog?.name || 'General Inquiry'}
          </p>
        </div>
      </div>

      {conversation.dog && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden">
                {conversation.dog.photos?.[0] ? (
                  <img src={conversation.dog.photos[0]} alt={conversation.dog.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Dog className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <h5 className="font-medium">{conversation.dog.name}</h5>
                <p className="text-sm text-muted-foreground">
                  {conversation.dog.breed} · {conversation.dog.age} years
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Message history will appear here</p>
          <p className="text-sm mt-1">Full chat thread integration coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}
