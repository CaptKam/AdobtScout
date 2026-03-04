import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  MessageSquare, Search, Filter, Clock, AlertCircle, CheckCircle,
  Circle, Send, MoreVertical, Dog, User, ChevronDown, Flag,
  UserPlus, Archive, X, Inbox
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  userId: string;
  dogId: string;
  shelterName: string;
  shelterId: string | null;
  status: string;
  channelType: string;
  priority: string;
  assignedTo: string | null;
  shelterUnreadCount: number;
  userUnreadCount: number;
  lastMessageAt: string;
  snoozedUntil: string | null;
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: string;
  messageType: string;
  content: string;
  metadata: any;
  isRead: boolean;
  timestamp: string;
}

interface ConversationDetails {
  conversation: Conversation;
  dog: {
    id: string;
    name: string;
    breed: string;
    photos: string[];
    age: number;
    size: string;
  };
  adopter: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profileImageUrl: string | null;
  };
  messages: Message[];
}

function ConversationList({ 
  conversations, 
  selectedId, 
  onSelect 
}: { 
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <Circle className="w-3 h-3 text-green-500 fill-green-500" />;
      case 'pending': return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'closed': return <CheckCircle className="w-3 h-3 text-slate-400" />;
      default: return <Circle className="w-3 h-3 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'normal': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      case 'low': return 'bg-slate-400/10 text-slate-400 border-slate-400/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <Inbox className="w-12 h-12 text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No conversations yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          When adopters message you about dogs, their conversations will appear here.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1 p-2">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              selectedId === conversation.id
                ? "bg-primary/10 border border-primary/20"
                : "hover:bg-accent"
            }`}
            data-testid={`conversation-item-${conversation.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="relative">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                {conversation.shelterUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {conversation.shelterUnreadCount > 9 ? '9+' : conversation.shelterUnreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(conversation.status)}
                  <span className="font-medium text-sm truncate">
                    Conversation
                  </span>
                  {conversation.priority !== 'normal' && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getPriorityColor(conversation.priority)}`}>
                      {conversation.priority}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Dog className="w-3 h-3" />
                  <span className="truncate">About dog</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function ConversationPane({ 
  conversationId,
  onClose
}: { 
  conversationId: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: details, isLoading } = useQuery<ConversationDetails>({
    queryKey: ["/api/shelter/conversations", conversationId],
    enabled: !!conversationId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/shelter/conversations/${conversationId}/messages`, { content }),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/conversations", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/conversations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send message",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/shelter/conversations/${conversationId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/conversations", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/conversations"] });
      toast({ title: "Status updated" });
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: (priority: string) =>
      apiRequest("PATCH", `/api/shelter/conversations/${conversationId}/priority`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/conversations", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/conversations"] });
      toast({ title: "Priority updated" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [details?.messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Conversation not found
      </div>
    );
  }

  const { conversation, dog, adopter, messages } = details;
  const adopterName = adopter.firstName && adopter.lastName 
    ? `${adopter.firstName} ${adopter.lastName}`
    : adopter.email || "Unknown Adopter";

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="border-b p-4 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="md:hidden"
              data-testid="button-close-conversation"
            >
              <X className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={adopter.profileImageUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {adopterName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-foreground">{adopterName}</h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Dog className="w-3 h-3" />
                  <span>Inquiring about {dog.name}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-change-status">
                  Status: {conversation.status}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate("open")}>
                  <Circle className="w-3 h-3 text-green-500 fill-green-500 mr-2" />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate("pending")}>
                  <Clock className="w-3 h-3 text-yellow-500 mr-2" />
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate("closed")}>
                  <CheckCircle className="w-3 h-3 text-slate-400 mr-2" />
                  Closed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-conversation-actions">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => updatePriorityMutation.mutate("urgent")}>
                  <Flag className="w-4 h-4 mr-2 text-red-500" />
                  Mark Urgent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updatePriorityMutation.mutate("high")}>
                  <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
                  Mark High Priority
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updatePriorityMutation.mutate("normal")}>
                  <Circle className="w-4 h-4 mr-2" />
                  Normal Priority
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign to Staff
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate("closed")}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 max-w-2xl mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderType === "shelter" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.senderType === "shelter"
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${
                  msg.senderType === "shelter" ? "text-primary-foreground/70" : "text-muted-foreground"
                }`}>
                  {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4 bg-card">
        <div className="flex gap-2 items-end max-w-2xl mx-auto">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="resize-none min-h-[80px]"
            data-testid="input-message"
          />
          <Button 
            onClick={handleSend} 
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="shrink-0"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Select a conversation</h2>
        <p className="text-muted-foreground">
          Choose a conversation from the list to view messages and respond to adopters.
        </p>
      </div>
    </div>
  );
}

export default function ShelterCommunications() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/shelter/conversations", statusFilter === "all" ? undefined : statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" 
        ? "/api/shelter/conversations"
        : `/api/shelter/conversations?status=${statusFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ["/api/shelter/conversations/unread/count"],
    refetchInterval: 30000,
  });

  return (
    
      <div className="h-full flex flex-col">
        <div className="border-b bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Messages</h1>
              {unreadCount && unreadCount.count > 0 && (
                <Badge variant="default" className="rounded-full">
                  {unreadCount.count} unread
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className={`w-full md:w-80 border-r flex flex-col bg-card ${selectedId ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-3 border-b space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-conversations"
                />
              </div>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1" data-testid="button-filter-status">
                      <Filter className="w-4 h-4 mr-2" />
                      {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setStatusFilter("all")}>All</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("open")}>Open</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("pending")}>Pending</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("closed")}>Closed</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>

          <div className={`flex-1 flex flex-col bg-muted/30 ${selectedId ? 'flex' : 'hidden md:flex'}`}>
            {selectedId ? (
              <ConversationPane 
                conversationId={selectedId} 
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    
  );
}
