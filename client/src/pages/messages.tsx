
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageCircle, Sparkles, Heart, Building2, Trash2, PawPrint, CheckCircle2, Clock, Home, Phone, Users, ChevronRight, Compass } from "lucide-react";
import { useLocation } from "wouter";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useState } from "react";
import type { ConversationWithDetails, ChatMessage, DogWithCompatibility, AdoptionJourney } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdoptionJourneyWithDog extends AdoptionJourney {
  dog: {
    id: string;
    name: string;
    breed: string;
    age: number;
    photos: string[];
  } | null;
  shelterName: string;
}

// Swipeable conversation card component
function SwipeableConversationCard({ 
  conversation, 
  onDelete, 
  onClick 
}: { 
  conversation: ConversationWithDetails;
  onDelete: (id: string) => void;
  onClick: () => void;
}) {
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const opacity = useTransform(x, [-100, 0], [1, 0]);
  const deleteWidth = useTransform(x, [-100, 0], [100, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    setIsDragging(false);
    if (info.offset.x < -80) {
      // Swiped far enough, keep it open
      x.set(-100);
    } else {
      // Snap back
      x.set(0);
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete button background */}
      <motion.div 
        className="absolute right-0 top-0 bottom-0 bg-destructive flex items-center justify-center"
        style={{ width: deleteWidth, opacity }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive-foreground hover:bg-destructive/90"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            x.set(0); // Reset position after delete
            onDelete(conversation.id);
          }}
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </motion.div>

      {/* Swipeable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        style={{ x }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        className="relative"
      >
        <Card
          className="cursor-pointer hover-elevate transition-all"
          onClick={(e) => {
            if (!isDragging) {
              onClick();
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex gap-4 items-start">
              <div className="relative flex-shrink-0">
                <Avatar className="h-14 w-14">
                  {conversation.dog ? (
                    <>
                      <AvatarImage src={conversation.dog.photos[0]} alt={conversation.dog.name} />
                      <AvatarFallback>{conversation.dog.name[0]}</AvatarFallback>
                    </>
                  ) : (
                    <AvatarFallback>
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    </AvatarFallback>
                  )}
                </Avatar>
                {conversation.unreadCount > 0 && (
                  <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center border-2 border-background">
                    <span className="text-xs font-semibold">{conversation.unreadCount}</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {conversation.dog ? conversation.dog.name : "Conversation"}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{conversation.shelterName}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatTime(conversation.lastMessageAt)}
                  </span>
                </div>

                {conversation.lastMessage && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {conversation.lastMessage.senderType === "user" ? "You: " : ""}
                    {conversation.lastMessage.content}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function Messages() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: conversations, isLoading: conversationsLoading } = useQuery<ConversationWithDetails[]>({
    queryKey: ["/api/conversations"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("DELETE", `/api/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data: chatMessages } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat"],
  });

  const { data: likedDogs, isLoading: likedDogsLoading } = useQuery<DogWithCompatibility[]>({
    queryKey: ["/api/dogs/liked"],
  });

  const { data: adoptionJourneys, isLoading: journeysLoading } = useQuery<AdoptionJourneyWithDog[]>({
    queryKey: ["/api/my-adoption-journeys"],
    refetchInterval: 3000, // Poll every 3 seconds to keep steps updated
  });

  // Filter to only in-progress journeys (active or approved, but not completed/cancelled/rejected)
  const activeJourneys = adoptionJourneys?.filter(j => 
    ["active", "approved"].includes(j.status) && !j.completedAt
  ) || [];

  const totalUnreadCount = conversations?.reduce((sum, conv) => sum + conv.unreadCount, 0) || 0;

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-card-border bg-card p-4 md:p-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">Your conversations and matches</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="messages" className="h-full flex flex-col">
          <div className="border-b border-card-border px-4 overflow-x-auto scrollbar-hide">
            <div className="max-w-3xl mx-auto">
              <TabsList className="w-full justify-start bg-transparent h-auto p-0 flex gap-2 sm:gap-6 min-w-max sm:min-w-0">
                <TabsTrigger 
                  value="messages" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-3 pt-4 text-sm sm:text-base whitespace-nowrap"
                  data-testid="tab-messages"
                >
                  <MessageCircle className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Messages</span>
                  <span className="sm:hidden">Msgs</span>
                  {totalUnreadCount > 0 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs" data-testid="badge-unread-count">{totalUnreadCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="matches" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-3 pt-4 text-sm sm:text-base whitespace-nowrap"
                  data-testid="tab-matches"
                >
                  <Heart className="w-4 h-4 mr-1 sm:mr-2" />
                  Matches
                  {likedDogs && likedDogs.length > 0 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs" data-testid="badge-matches-count">{likedDogs.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="adoptions" 
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-primary rounded-none pb-3 pt-4 text-sm sm:text-base whitespace-nowrap"
                  data-testid="tab-adoptions"
                >
                  <PawPrint className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">In Progress</span>
                  <span className="sm:hidden">Active</span>
                  {activeJourneys.length > 0 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-adoptions-count">{activeJourneys.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Messages Tab - Combined Scout AI and Shelter Conversations */}
            <TabsContent value="messages" className="mt-0 h-full">
              <div className="px-4 py-6">
                <div className="max-w-3xl mx-auto space-y-3">
                  {/* Scout AI Chat */}
                  <Card
                    className="cursor-pointer hover-elevate transition-all border-primary/20"
                    onClick={() => setLocation("/chat")}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-4 items-start">
                        <Avatar className="h-14 w-14 flex-shrink-0 bg-primary">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            <Sparkles className="w-7 h-7" />
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold">Scout AI</h3>
                              <p className="text-xs text-muted-foreground">Your AI Matchmaker</p>
                            </div>
                            {chatMessages && chatMessages.length > 0 && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                {formatTime(chatMessages[chatMessages.length - 1].timestamp)}
                              </span>
                            )}
                          </div>

                          {chatMessages && chatMessages.length > 0 ? (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {chatMessages[chatMessages.length - 1].role === "user" ? "You: " : "Scout: "}
                              {chatMessages[chatMessages.length - 1].content}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              Ask me anything about finding your perfect dog companion
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Shelter/Owner Conversations */}
                  {conversationsLoading && (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                      <p>Loading conversations...</p>
                    </div>
                  )}

                  {!conversationsLoading && conversations && conversations.length > 0 ? (
                    conversations.map((conv) => (
                      <SwipeableConversationCard
                        key={conv.id}
                        conversation={conv}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        onClick={() => setLocation(`/messages/${conv.id}`)}
                      />
                    ))
                  ) : (
                    !conversationsLoading && (
                      <div className="text-center py-12 space-y-6 animate-fadeInUp">
                        <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto">
                          <MessageCircle className="w-10 h-10 text-primary/50" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold mb-2">Your conversations await</h2>
                          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                            When you find a pet you love and start a conversation with their shelter or owner, it'll show up here.
                          </p>
                        </div>
                        <Button
                          onClick={() => setLocation('/discover')}
                          className="btn-premium"
                          size="lg"
                          data-testid="button-discover-from-messages"
                        >
                          <Compass className="w-5 h-5 mr-2" />
                          Find Your Match
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Matches Tab */}
            <TabsContent value="matches" className="mt-0 h-full">
              <div className="px-4 py-6">
                <div className="max-w-3xl mx-auto">
                  {likedDogsLoading && (
                    <div className="text-center text-muted-foreground py-12">
                      <Heart className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                      <p>Loading your matches...</p>
                    </div>
                  )}

                  {!likedDogsLoading && likedDogs && likedDogs.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {likedDogs.map((dog) => (
                        <Card
                          key={dog.id}
                          className="cursor-pointer hover-elevate transition-all overflow-hidden"
                          onClick={() => setLocation(`/dogs/${dog.id}`)}
                        >
                          <div className="aspect-square relative">
                            <img
                              src={dog.photos[0]}
                              alt={dog.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 right-2">
                              <Badge className="bg-primary/90 backdrop-blur-sm">
                                {dog.compatibilityScore}%
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-3">
                            <h3 className="font-semibold truncate">{dog.name}</h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {dog.breed} • {dog.age} {dog.age === 1 ? 'yr' : 'yrs'}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    !likedDogsLoading && (
                      <div className="text-center py-12 space-y-6 animate-fadeInUp">
                        <div className="w-20 h-20 bg-gradient-to-br from-rose-500/20 to-rose-500/5 rounded-2xl flex items-center justify-center mx-auto">
                          <Heart className="w-10 h-10 text-rose-500/50" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold mb-2">Your favorites will appear here</h2>
                          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                            Swipe right on pets you love, and they'll be saved here so you can revisit them anytime.
                          </p>
                        </div>
                        <Button
                          onClick={() => setLocation('/discover')}
                          className="btn-premium"
                          size="lg"
                          data-testid="button-discover-from-matches"
                        >
                          <Heart className="w-5 h-5 mr-2" />
                          Start Discovering
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Adoptions In Progress Tab */}
            <TabsContent value="adoptions" className="mt-0 h-full">
              <div className="px-4 py-6">
                <div className="max-w-3xl mx-auto space-y-4">
                  {journeysLoading && (
                    <div className="text-center text-muted-foreground py-12">
                      <PawPrint className="w-8 h-8 mx-auto mb-2 animate-pulse" />
                      <p>Loading your adoption journeys...</p>
                    </div>
                  )}

                  {!journeysLoading && activeJourneys.length > 0 ? (
                    activeJourneys.map((journey) => {
                      const stepMap: Record<string, number> = {
                        application: 1,
                        phone_screening: 2,
                        home_visit: 2, // Legacy support
                        meet_greet: 3,
                        adoption: 4,
                      };
                      const currentStepNum = stepMap[journey.currentStep] || 1;
                      const progressPercent = ((currentStepNum - 1) / 4) * 100;

                      const getStepIcon = (step: string) => {
                        switch (step) {
                          case "application": return Sparkles;
                          case "phone_screening": return Phone;
                          case "home_visit": return Phone; // Legacy support
                          case "meet_greet": return Users;
                          case "adoption": return Heart;
                          default: return Clock;
                        }
                      };

                      const getStepLabel = (step: string) => {
                        switch (step) {
                          case "application": return "Application";
                          case "phone_screening": return "Phone Screening";
                          case "home_visit": return "Phone Screening"; // Legacy support
                          case "meet_greet": return "Meet & Greet";
                          case "adoption": return "Adoption Day";
                          default: return step;
                        }
                      };

                      const StepIcon = getStepIcon(journey.currentStep);

                      return (
                        <motion.div
                          key={journey.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <Card
                            className="cursor-pointer hover-elevate transition-all overflow-hidden border-green-200 dark:border-green-800"
                            onClick={() => setLocation(`/dogs/${journey.dogId}`)}
                            data-testid={`card-adoption-${journey.id}`}
                          >
                            <CardContent className="p-0">
                              <div className="flex">
                                {/* Dog Photo */}
                                {journey.dog && (
                                  <div className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 relative">
                                    <img
                                      src={journey.dog.photos[0]}
                                      alt={journey.dog.name}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/20" />
                                  </div>
                                )}

                                {/* Journey Info */}
                                <div className="flex-1 p-4 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                      <h3 className="font-semibold text-lg truncate">
                                        {journey.dog?.name || "Unknown"}
                                      </h3>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {journey.dog ? `${journey.dog.breed} • ${journey.dog.age} ${journey.dog.age === 1 ? 'yr' : 'yrs'}` : ''}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {journey.shelterName}
                                      </p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                  </div>

                                  {/* Current Step */}
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                      <StepIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                        {getStepLabel(journey.currentStep)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Step {currentStepNum} of 4
                                      </p>
                                    </div>
                                  </div>

                                  {/* Progress Bar */}
                                  <div className="mt-2">
                                    <Progress value={progressPercent} className="h-1.5" />
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })
                  ) : (
                    !journeysLoading && (
                      <div className="text-center py-12 space-y-6 animate-fadeInUp">
                        <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl flex items-center justify-center mx-auto">
                          <PawPrint className="w-10 h-10 text-green-500/50" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold mb-2">Your adoption journey starts here</h2>
                          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                            Once you apply to adopt a pet, you'll be able to track every step of your journey right here.
                          </p>
                        </div>
                        <Button
                          onClick={() => setLocation("/discover")}
                          className="btn-premium"
                          size="lg"
                          data-testid="button-find-dogs"
                        >
                          <Heart className="w-5 h-5 mr-2" />
                          Find Your Perfect Match
                        </Button>
                      </div>
                    )
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
