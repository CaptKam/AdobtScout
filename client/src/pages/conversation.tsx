import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Message, Dog } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Conversation() {
  const [, params] = useRoute("/messages/:conversationId");
  const [, setLocation] = useLocation();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationId = params?.conversationId;
  const { toast } = useToast();

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: [`/api/conversations/${conversationId}/messages`],
    enabled: !!conversationId,
    refetchInterval: 3000, // Poll for new messages
    onSuccess: () => {
      // Invalidate conversations list to update unread counts
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  // Update conversations list when messages are loaded (marks as read)
  useEffect(() => {
    if (messages && messages.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }
  }, [messages]);

  // Fetch the specific conversation directly by ID
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: [`/api/conversations/${conversationId}`],
    enabled: !!conversationId,
  });

  const dog = conversation?.dog as Dog | undefined;

  console.log('[Conversation] conversationId:', conversationId);
  console.log('[Conversation] Found conversation:', conversation);
  console.log('[Conversation] Dog:', dog);

  // All hooks must be called before conditional returns (Rules of Hooks)
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/messages`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/conversations/${conversationId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      setMessageText("");
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: "Failed to send message",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
      // Don't clear the message on error, let user retry
    },
  });

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMutation.mutate(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Early return guards (after all hooks to comply with Rules of Hooks)
  if (!conversationId) {
    console.error('[Conversation] No conversationId in route params');
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Invalid conversation</p>
      </div>
    );
  }

  if (conversationLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Loading conversation...</p>
      </div>
    );
  }

  if (!conversation || !dog) {
    console.error('[Conversation] Conversation or dog not found');
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Conversation not found</p>
          <Button onClick={() => setLocation("/messages")}>
            Back to Messages
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-card-border bg-card p-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/messages")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={dog.photos[0]} alt={dog.name} />
            <AvatarFallback>{dog.name[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold truncate">{dog.name}</h2>
            <p className="text-xs text-muted-foreground truncate">{conversation.shelterName}</p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/dogs/${dog.id}`)}
          >
            View Profile
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages?.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.senderType === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.senderType === "shelter" && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {conversation.shelterName[0]}
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.senderType === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-card-border"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>

              {msg.senderType === "user" && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-muted text-xs">You</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {sendMutation.isPending && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {conversation.shelterName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="bg-card border border-card-border rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 bg-card border-t border-card-border safe-area-bottom">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Input
            placeholder="Message shelter about meet-and-greet..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sendMutation.isPending}
            className="h-12 text-base flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMutation.isPending}
            size="icon"
            className="h-12 w-12 flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}