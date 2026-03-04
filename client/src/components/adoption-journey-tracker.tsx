import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Clock, Calendar, PartyPopper, Sparkles, Heart, Phone, Users, PawPrint, ChevronRight, Info, Loader2, PhoneCall } from "lucide-react";
import { format, addDays } from "date-fns";
import AIReviewBadge from "./ai-review-badge";
import { AdoptionMilestonesBadges } from "./adoption-milestones-badges";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JourneyStep {
  id: string;
  title: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  completedAt?: Date;
  scheduledAt?: Date;
  estimatedDays?: number;
  icon: any;
  color: string;
  tips?: string[];
  phoneStatus?: string; // For phone screening step
}

interface AvailableSlot {
  date: string;
  time: string;
  datetime: string;
}

interface AdoptionJourneyTrackerProps {
  journey: {
    id: string;
    currentStep: string;
    status?: string; // "active", "approved", "rejected"
    applicationSubmittedAt?: Date;
    // Phone Screening (replaces home visit)
    phoneScreeningStatus?: string; // "pending", "scheduled", "in_progress", "completed", "failed"
    phoneScreeningScheduledAt?: Date;
    phoneScreeningCompletedAt?: Date;
    phoneScreeningTranscript?: string;
    phoneScreeningSummary?: string;
    // Legacy home visit fields (backward compatibility)
    homeVisitScheduledAt?: Date;
    homeVisitCompletedAt?: Date;
    // Meet & Greet
    meetGreetScheduledAt?: Date;
    meetGreetCompletedAt?: Date;
    adoptionDate?: Date;
    completedAt?: Date;
    milestones?: string[];
    aiReviewScore?: number;
    aiRecommendation?: string;
    aiReviewSummary?: string;
    aiReviewData?: any;
  };
  dogName: string;
  shelterId?: string;
  onUploadDocument?: () => void;
  onScheduleStep?: (step: string) => void;
}

export default function AdoptionJourneyTracker({
  journey,
  dogName,
  shelterId,
  onUploadDocument,
  onScheduleStep,
}: AdoptionJourneyTrackerProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [slotDialogOpen, setSlotDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const { toast } = useToast();

  // Fetch available meet & greet slots when dialog is open and shelterId is available
  const { data: availableSlots = [], isLoading: loadingSlots } = useQuery<AvailableSlot[]>({
    queryKey: ["/api/shelters", shelterId, "available-slots"],
    queryFn: async () => {
      if (!shelterId) return [];
      const res = await fetch(`/api/shelters/${shelterId}/available-slots`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch slots");
      return res.json();
    },
    enabled: slotDialogOpen && !!shelterId,
  });

  // Mutation to book a meet & greet slot
  const bookSlotMutation = useMutation({
    mutationFn: async (datetime: string) => {
      return apiRequest("POST", `/api/adoption-journeys/${journey.id}/book-meet-greet`, { datetime });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/adoption-journeys", journey.id] });
      setSlotDialogOpen(false);
      setSelectedSlot(null);
      toast({
        title: "Meet & Greet Scheduled!",
        description: `You're all set to meet ${dogName}. We can't wait!`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to book the slot. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Group slots by date for easier display
  const slotsByDate = availableSlots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {} as Record<string, AvailableSlot[]>);

  const formatSlotTime = (time: string) => {
    const [hour, min] = time.split(':').map(Number);
    const ampm = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
  };

  const canBookMeetGreet = journey.currentStep === "meet_greet" && !journey.meetGreetScheduledAt && shelterId;

  // Mutation to start phone screening call
  const startCallMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/adoption-journeys/${journey.id}/start-my-call`),
    onSuccess: async () => {
      // Invalidate specific journey data to get updated status when call completes
      queryClient.invalidateQueries({ queryKey: ['/api/adoption-journeys', journey.id] });
      setCallDialogOpen(false);
      toast({
        title: "Call started!",
        description: "You'll receive a call from Scout AI shortly. Make sure your phone is nearby!",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to start call. Please try again.";
      if (error?.code === "PHONE_REQUIRED") {
        toast({
          title: "Phone number required",
          description: "Please add your phone number in your profile settings before starting the call.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });

  // Poll for call status updates when call is in progress
  useEffect(() => {
    // Only poll if call is in progress
    if (journey.phoneScreeningStatus !== "in_progress") {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const updatedJourney = await apiRequest('GET', `/api/adoption-journeys/${journey.id}/call-status`) as any;
        // Invalidate and refetch the journey data
        queryClient.setQueryData(['/api/adoption-journeys', journey.id], updatedJourney);
        
        // Stop polling if call completed or failed
        if (updatedJourney?.phoneScreeningStatus === "completed" || updatedJourney?.phoneScreeningStatus === "failed") {
          clearInterval(pollInterval);
          // Show toast notification when call completes
          if (updatedJourney.phoneScreeningStatus === "completed") {
            toast({
              title: "Call completed!",
              description: "Thank you for the conversation. Your screening has been completed.",
            });
          }
        }
      } catch (error) {
        console.error("Error polling call status:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [journey.id, journey.phoneScreeningStatus, toast]);

  // Check if awaiting admin approval (on phone_screening but not yet approved)
  const isAwaitingApproval = 
    (journey.currentStep === "phone_screening" || journey.currentStep === "home_visit") &&
    journey.status !== "approved" &&
    journey.status !== "rejected";

  // Check if user can start a call - requires admin approval first
  const canStartCall = 
    (journey.currentStep === "phone_screening" || journey.currentStep === "home_visit") &&
    journey.status === "approved" && // Must be approved by admin first
    journey.phoneScreeningStatus !== "in_progress" &&
    journey.phoneScreeningStatus !== "completed";
  
  const steps: JourneyStep[] = [
    {
      id: "application",
      title: "Application",
      description: "Your application has been submitted",
      status: journey.applicationSubmittedAt ? "completed" : journey.currentStep === "application" ? "current" : "upcoming",
      completedAt: journey.applicationSubmittedAt,
      estimatedDays: 1,
      icon: Sparkles,
      color: "text-purple-500",
      tips: [
        "We're reviewing your application",
        "You'll hear back within 24-48 hours",
      ],
    },
    {
      id: "phone_screening",
      title: "Phone Screening",
      description: isAwaitingApproval 
        ? "Your application is being reviewed by our team" 
        : journey.status === "approved"
          ? "Great news! Your application was approved. Ready for your phone screening call."
          : "A quick call to learn more about you",
      status: journey.phoneScreeningCompletedAt || journey.homeVisitCompletedAt 
        ? "completed" 
        : (journey.currentStep === "phone_screening" || journey.currentStep === "home_visit") 
          ? "current" 
          : "upcoming",
      scheduledAt: journey.phoneScreeningScheduledAt || journey.homeVisitScheduledAt,
      completedAt: journey.phoneScreeningCompletedAt || journey.homeVisitCompletedAt,
      estimatedDays: 3,
      icon: Phone,
      color: "text-blue-500",
      tips: isAwaitingApproval 
        ? [
            "We're reviewing your application",
            "You'll be notified when approved",
            "This usually takes 24-48 hours",
          ]
        : [
            "Be in a quiet place when we call",
            "Have details about your living situation ready",
            "Feel free to ask us questions too!",
          ],
      // Extra phone screening info
      phoneStatus: isAwaitingApproval ? "awaiting_approval" : journey.phoneScreeningStatus,
    },
    {
      id: "meet_greet",
      title: "Meet & Greet",
      description: `Time to meet ${dogName}!`,
      status: journey.meetGreetCompletedAt ? "completed" : journey.currentStep === "meet_greet" ? "current" : "upcoming",
      scheduledAt: journey.meetGreetScheduledAt,
      completedAt: journey.meetGreetCompletedAt,
      estimatedDays: 3,
      icon: Users,
      color: "text-orange-500",
      tips: [
        "Bring treats to build rapport",
        "Stay calm and patient",
        "Ask about their personality",
      ],
    },
    {
      id: "adoption",
      title: "Adoption Day",
      description: `Welcome ${dogName} home!`,
      status: journey.completedAt ? "completed" : journey.currentStep === "adoption" ? "current" : "upcoming",
      scheduledAt: journey.adoptionDate,
      completedAt: journey.completedAt,
      estimatedDays: 0,
      icon: Heart,
      color: "text-red-500",
      tips: [
        "Bring a carrier or leash",
        "Set up their new space",
        "Be patient during adjustment",
      ],
    },
  ];

  const completedSteps = steps.filter(s => s.status === "completed").length;
  const progressPercentage = (completedSteps / steps.length) * 100;
  const currentStepIndex = steps.findIndex(s => s.status === "current");

  const getEstimatedCompletion = () => {
    if (journey.completedAt || currentStepIndex < 0 || !steps || steps.length === 0) return null;
    let totalDays = 0;
    for (let i = currentStepIndex; i < steps.length; i++) {
      if (steps[i]) {
        totalDays += steps[i].estimatedDays || 0;
      }
    }
    return addDays(new Date(), totalDays);
  };

  // Success state - adoption completed
  if (journey.completedAt) {
    return (
      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
        <CardContent className="p-6 sm:p-8">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <div className="relative inline-block mb-4">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <PartyPopper className="w-16 h-16 text-green-500" />
              </motion.div>
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Heart className="w-6 h-6 text-red-500 fill-red-500" />
              </motion.div>
            </div>
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
              Congratulations!
            </h2>
            <p className="text-green-600 dark:text-green-500 mb-4">
              {dogName} officially joined your family on{" "}
              <span className="font-semibold">
                {format(new Date(journey.completedAt), "MMMM d, yyyy")}
              </span>
            </p>
            {journey.milestones && journey.milestones.length > 0 && (
              <div className="mt-4">
                <AdoptionMilestonesBadges
                  milestones={journey.milestones}
                  currentStep={journey.currentStep}
                />
              </div>
            )}
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary/10 via-orange-100/50 to-amber-100/50 dark:from-primary/20 dark:via-orange-900/20 dark:to-amber-900/20 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-md flex items-center justify-center">
              <PawPrint className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                Your Journey with {dogName}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs font-medium">
                  Step {completedSteps + 1} of {steps.length}
                </Badge>
                {getEstimatedCompletion() && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    Est. {format(getEstimatedCompletion()!, "MMM d")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progress</span>
            <span className="font-semibold text-foreground">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="h-2 bg-white/50 dark:bg-gray-800/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-orange-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <CardContent className="p-4 sm:p-6">
        {/* AI Review Status */}
        {journey.aiReviewScore && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-100 dark:border-purple-900/50"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-sm">AI Review</span>
                  <AIReviewBadge 
                    score={journey.aiReviewScore}
                    recommendation={journey.aiRecommendation}
                    summary={journey.aiReviewSummary}
                  />
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {journey.aiReviewSummary}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Milestones */}
        {journey.milestones && journey.milestones.length > 0 && (
          <div className="mb-6">
            <AdoptionMilestonesBadges
              milestones={journey.milestones}
              currentStep={journey.currentStep}
            />
          </div>
        )}

        {/* Timeline Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isExpanded = expandedStep === step.id;
            const isLast = index === steps.length - 1;
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className={`relative rounded-2xl border transition-all duration-200 ${
                    step.status === "current"
                      ? "border-primary/50 bg-primary/5 shadow-md"
                      : step.status === "completed"
                      ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
                      : "border-muted bg-muted/30"
                  }`}
                >
                  <button
                    onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                    className="w-full p-4 flex items-center gap-4 text-left"
                    data-testid={`button-step-${step.id}`}
                  >
                    {/* Step indicator */}
                    <div className="relative">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                          step.status === "completed"
                            ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                            : step.status === "current"
                            ? "bg-primary text-white shadow-lg shadow-primary/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.status === "completed" ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <StepIcon className="w-6 h-6" />
                        )}
                      </div>
                      {!isLast && (
                        <div
                          className={`absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-6 ${
                            step.status === "completed" ? "bg-green-300 dark:bg-green-700" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${
                          step.status === "upcoming" ? "text-muted-foreground" : ""
                        }`}>
                          {step.title}
                        </h3>
                        {step.status === "current" && (
                          <Badge className="bg-primary/20 text-primary border-0 text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                      {step.completedAt && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                          Completed {format(new Date(step.completedAt), "MMM d, yyyy")}
                        </p>
                      )}
                      {step.scheduledAt && !step.completedAt && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Scheduled for {format(new Date(step.scheduledAt), "MMM d, yyyy")}
                        </p>
                      )}
                      {/* Phone screening status indicator */}
                      {step.id === "phone_screening" && (
                        <div className="mt-2 space-y-2">
                          {step.phoneStatus === "awaiting_approval" && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800">
                              <Clock className="w-3 h-3 mr-1" />
                              Awaiting application approval
                            </Badge>
                          )}
                          {step.phoneStatus === "awaiting_review" && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Call complete - under review
                            </Badge>
                          )}
                          {step.phoneStatus === "in_progress" && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Call in progress
                            </Badge>
                          )}
                          {step.phoneStatus === "pending" && journey.status === "approved" && (
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Application Approved!
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                                <Phone className="w-3 h-3 mr-1" />
                                Ready for phone screening
                              </Badge>
                            </div>
                          )}
                          {step.phoneStatus === "pending" && journey.status !== "approved" && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                              <Clock className="w-3 h-3 mr-1" />
                              Ready to call
                            </Badge>
                          )}
                          {step.phoneStatus === "approved" && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Screening approved
                            </Badge>
                          )}
                          {step.phoneStatus === "failed" && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
                              Call unsuccessful - tap to retry
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand indicator */}
                    <ChevronRight 
                      className={`w-5 h-5 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {/* Start Phone Screening button - outside of the clickable step button */}
                  {step.id === "phone_screening" && step.status === "current" && canStartCall && (
                    <div className="px-4 pb-4 pt-0 pl-20">
                      <Button
                        size="sm"
                        onClick={() => setCallDialogOpen(true)}
                        className="w-full sm:w-auto"
                        data-testid="button-start-phone-call"
                      >
                        <PhoneCall className="w-4 h-4 mr-2" />
                        Start Phone Screening
                      </Button>
                    </div>
                  )}

                  {/* Schedule Meet & Greet button - when on meet_greet step and not yet scheduled */}
                  {step.id === "meet_greet" && step.status === "current" && canBookMeetGreet && (
                    <div className="px-4 pb-4 pt-0 pl-20">
                      <Button
                        size="sm"
                        onClick={() => setSlotDialogOpen(true)}
                        className="w-full sm:w-auto"
                        data-testid="button-schedule-meet-greet"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Schedule Meet & Greet
                      </Button>
                    </div>
                  )}

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isExpanded && step.tips && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0">
                          <div className="pl-16 space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <Info className="w-4 h-4" />
                              Tips for this step
                            </div>
                            <div className="space-y-2">
                              {step.tips.map((tip, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2 text-sm"
                                >
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                                  <span>{tip}</span>
                                </div>
                              ))}
                            </div>
                            {step.status === "current" && onScheduleStep && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onScheduleStep(step.id);
                                }}
                                className="mt-3"
                                data-testid={`button-schedule-${step.id}`}
                              >
                                <Calendar className="w-4 h-4 mr-2" />
                                Schedule {step.title}
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>

      {/* Phone Screening Confirmation Dialog */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent data-testid="dialog-start-call">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              Start Phone Screening
            </DialogTitle>
            <DialogDescription>
              Ready to chat with Scout AI about adopting {dogName}? We'll call you at the phone number in your profile for a friendly 5-10 minute conversation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              <h4 className="font-medium text-sm">What to expect:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  A friendly AI assistant will call you
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  We'll ask about your home and lifestyle
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  You can ask questions about {dogName} too!
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  The call takes about 5-10 minutes
                </li>
              </ul>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Make sure you're in a quiet place where you can talk comfortably.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCallDialogOpen(false)}>
              Not Now
            </Button>
            <Button 
              onClick={() => startCallMutation.mutate()}
              disabled={startCallMutation.isPending}
              data-testid="button-confirm-start-call"
            >
              {startCallMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <PhoneCall className="mr-2 h-4 w-4" />
                  Call Me Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meet & Greet Slot Selection Dialog */}
      <Dialog open={slotDialogOpen} onOpenChange={setSlotDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" data-testid="dialog-book-meet-greet">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Schedule Meet & Greet
            </DialogTitle>
            <DialogDescription>
              Choose a time to meet {dogName}! Select from available slots below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : Object.keys(slotsByDate).length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No available slots at this time.</p>
                <p className="text-sm text-muted-foreground mt-1">Please check back later or contact the shelter.</p>
              </div>
            ) : (
              Object.entries(slotsByDate).slice(0, 7).map(([date, slots]) => (
                <div key={date} className="space-y-2">
                  <h4 className="font-medium text-sm">
                    {format(new Date(date), "EEEE, MMMM d")}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <Button
                        key={`${slot.date}-${slot.time}`}
                        size="sm"
                        variant={selectedSlot?.datetime === slot.datetime ? "default" : "outline"}
                        onClick={() => setSelectedSlot(slot)}
                        data-testid={`button-slot-${slot.date}-${slot.time}`}
                      >
                        {formatSlotTime(slot.time)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedSlot && bookSlotMutation.mutate(selectedSlot.datetime)}
              disabled={!selectedSlot || bookSlotMutation.isPending}
              data-testid="button-confirm-book-slot"
            >
              {bookSlotMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Confirm Booking
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
