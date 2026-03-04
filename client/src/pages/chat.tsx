import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Sparkles, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function Chat() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat"],
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", "/api/chat", { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
      setMessage("");
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: "Failed to send message",
        description: "Scout is having trouble responding right now. Please try again.",
        variant: "destructive",
      });
      // Don't clear the message on error, let user retry
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
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

  const suggestedQuestions = [
    "What dogs match my active lifestyle?",
    "Show me dogs good with kids",
    "Find me a low-energy companion",
    "Explain my compatibility scores",
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-card-border bg-card p-4 md:p-6">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              <Sparkles className="w-5 h-5" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold md:text-lg">Chat with Scout</h1>
            <p className="text-xs text-muted-foreground">Your AI adoption matchmaker</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {isLoading && (
            <div className="text-center text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 animate-pulse" />
              <p>Loading conversation...</p>
            </div>
          )}

          {!isLoading && (!messages || messages.length === 0) && (
            <div className="text-center space-y-6 py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Hi! I'm Scout</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  I'm your compassionate AI matchmaker here to help you find the perfect 
                  dog companion. Ask me anything about the dogs I've matched for you!
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestedQuestions.map((q, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => setMessage(q)}
                      className="text-xs"
                      data-testid={`button-suggested-${idx}`}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages?.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    <Sparkles className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-card-border"
                }`}
                data-testid={`message-${msg.role}-${msg.id}`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                {/* If message references a dog, show a context card */}
                {msg.dogContext && (
                  <Card className="mt-3 cursor-pointer hover-elevate" onClick={() => setLocation(`/dogs/${msg.dogContext}`)}>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Referenced dog - click to view</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {msg.role === "user" && (
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
                  <Sparkles className="w-4 h-4" />
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
      <div className="p-4 md:p-6 bg-card border-t border-card-border safe-area-bottom">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Input
            placeholder="Ask Scout about your matches..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sendMutation.isPending}
            className="h-12 text-base flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            size="icon"
            className="h-12 w-12 flex-shrink-0"
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}