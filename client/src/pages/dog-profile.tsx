import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  Phone,
  Calendar,
  CheckCircle2,
  Zap,
  Home,
  MessageCircle,
  X,
  Video,
  ClipboardList,
  Smile,
  Users,
  Pill,
  Stethoscope,
  Award,
  ChevronRight,
  Shield,
  AlertCircle,
  User,
  Lock,
} from "lucide-react";
import type { DogWithCompatibility } from "@shared/schema";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PhoneCall, FileQuestion } from "lucide-react";
import type { ApplicationQuestion, ShelterApplicationQuestion } from "@shared/schema";
import VirtualTourScheduler from "@/components/virtual-tour-scheduler";
import DayInLifeVideo from "@/components/day-in-life-video";
import AdoptionJourneyTracker from "@/components/adoption-journey-tracker";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default function DogProfile() {
  const params = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showVirtualTourDialog, setShowVirtualTourDialog] = useState(false);
  const [showJourneyTracker, setShowJourneyTracker] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [showRequirementsDialog, setShowRequirementsDialog] = useState(false);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);
  // Inline form state for quick profile completion - pre-filled from existing profile
  const [inlineFormData, setInlineFormData] = useState({
    phoneNumber: "",
    city: "",
    state: "",
    homeType: "",
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  
  // Application questions dialog state
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [applicationAnswers, setApplicationAnswers] = useState<Record<string, string | string[] | boolean>>({});
  const { toast } = useToast();

  // Determine the appropriate back navigation based on referrer
  const getBackPath = () => {
    // Check sessionStorage for the previous page
    const referrer = sessionStorage.getItem('dogProfileReferrer');

    if (referrer === 'map') return '/map';
    if (referrer === 'messages') return '/messages';
    if (referrer === 'profile') return '/profile';

    // Default to discover page
    return '/discover';
  };

  const handleBackClick = () => {
    const backPath = getBackPath();
    sessionStorage.removeItem('dogProfileReferrer'); // Clear after use
    setLocation(backPath);
  };

  // Fetch current user
  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/me"],
  });

  // Fetch adoption journey if user is authenticated
  const { data: adoptionJourney } = useQuery<any>({
    queryKey: ["/api/adoption-journeys", params.id],
    enabled: !!params.id,
  });

  // Check if user has any completed applications (for quick apply)
  const { data: applicationStatus } = useQuery<{ hasCompletedApplication: boolean }>({
    queryKey: ["/api/adoption-journeys/has-completed-application"],
    enabled: !!currentUser,
  });

  const { data: dog, isLoading } = useQuery<DogWithCompatibility>({
    queryKey: ["/api/dogs", params.id],
  });

  // Fetch profile mode (adopt/foster/rehome)
  const { data: profile } = useQuery<any>({
    queryKey: ["/api/profile-mode", params.id],
    enabled: !!params.id,
  });

  // Fetch adoption requirements (admin-configurable)
  const { data: adoptionRequirements } = useQuery<{
    requireCompletedProfile: boolean;
    requirePhoneNumber: boolean;
    requireProfilePhoto: boolean;
    requireIdVerification: boolean;
    requireBackgroundCheck: boolean;
    requireHomePhotos: boolean;
    requirePetPolicyVerification: boolean;
    requirementsMessage: string | null;
  }>({
    queryKey: ["/api/adoption-requirements"],
  });

  // Fetch user profile for requirements validation
  const { data: userProfile } = useQuery<any>({
    queryKey: ["/api/user-profile"],
    enabled: !!currentUser,
  });

  // Fetch application questions for this dog (standard + shelter-specific)
  const { data: applicationQuestions } = useQuery<{
    standardQuestions: ApplicationQuestion[];
    shelterQuestions: ShelterApplicationQuestion[];
    shelterForm: any;
    shelterId: string | null;
    shelterName: string | null;
  }>({
    queryKey: ["/api/dogs", params.id, "application-questions"],
    enabled: !!params.id,
  });

  // Pre-fill inline form with existing profile data when userProfile loads
  useEffect(() => {
    if (userProfile) {
      setInlineFormData(prev => ({
        phoneNumber: userProfile.phoneNumber || prev.phoneNumber || "",
        city: userProfile.city || prev.city || "",
        state: userProfile.state || prev.state || "",
        homeType: userProfile.homeType || prev.homeType || "",
      }));
    }
  }, [userProfile]);

  // Increment view count when profile is loaded
  const incrementViewMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/dogs/${params.id}/view`, {});
    },
    onSuccess: () => {
      // Refetch the dog data to show updated view count
      queryClient.invalidateQueries({ queryKey: ["/api/dogs", params.id] });
    },
  });

  // Track view when dog is loaded
  useEffect(() => {
    if (dog && params.id && !incrementViewMutation.isSuccess) {
      incrementViewMutation.mutate();
    }
  }, [dog, params.id]);

  // Like/Pass mutation
  const swipeMutation = useMutation({
    mutationFn: async (direction: "right" | "left") => {
      await apiRequest("POST", "/api/swipes", {
        dogId: params.id,
        direction,
      });
    },
    onSuccess: (_, direction) => {
      if (direction === "right") {
        toast({
          title: `${dog?.name} added to favorites`,
          description: "You can find them in Messages when you're ready!",
        });
      } else {
        toast({
          title: "No worries",
          description: "Keep exploring—your perfect match is out there!",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/swipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/liked"] });
    },
    onError: (error) => {
      console.error("Error recording swipe:", error);
      toast({
        title: "Oops, something went wrong",
        description: "We couldn't save that. Please try again!",
        variant: "destructive",
      });
    },
  });

  // Apply for adoption mutation (with application answers)
  const applyForAdoptionMutation = useMutation({
    mutationFn: async (answers?: Record<string, string | string[] | boolean>) => {
      const response = await apiRequest("POST", "/api/adoption-journeys", {
        dogId: params.id,
        applicationResponses: answers || applicationAnswers,
      });
      return response.json();
    },
    onSuccess: () => {
      // Set local flag immediately to prevent duplicate submissions
      setHasApplied(true);
      // Close application dialog and reset answers
      setShowApplicationDialog(false);
      setApplicationAnswers({});
      toast({
        title: "Exciting! Your journey begins",
        description: `We're thrilled you're interested in ${dog?.name}! Track your progress below.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/adoption-journeys", params.id] });
      // Open the tracker automatically after applying
      setShowJourneyTracker(true);
    },
    onError: (error) => {
      console.error("Error starting adoption journey:", error);
      toast({
        title: "Error",
        description: "Failed to start adoption application. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Quick Apply mutation - skips application step for returning applicants
  const quickApplyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/adoption-journeys", {
        dogId: params.id,
        quickApply: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setHasApplied(true);
      
      // Check if user was fast-tracked based on previous screenings
      const quickApplyResult = data?.quickApplyResult;
      if (quickApplyResult?.skippedScreening) {
        toast({
          title: "You're fast-tracked!",
          description: `Based on your history, you can meet ${dog?.name} right away! No extra steps needed.`,
        });
      } else {
        toast({
          title: "Quick apply successful",
          description: `Great news! We used your saved info to move you forward with ${dog?.name}.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/adoption-journeys", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-adoption-journeys"] });
      setShowJourneyTracker(true);
    },
    onError: (error) => {
      console.error("Error with quick apply:", error);
      toast({
        title: "Error",
        description: "Failed to quick apply. Please try the full application.",
        variant: "destructive",
      });
    },
  });

  const handleMessage = async () => {
    if (!dog) return;
    try {
      const response = await apiRequest("GET", `/api/conversations/by-dog/${dog.id}`);
      const conversation = await response.json();
      setLocation(`/messages/${conversation.id}`);
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Validate adoption requirements before allowing application
  const validateAndApply = () => {
    // First check if user is logged in
    if (!currentUser) {
      sessionStorage.setItem('returnToDog', params.id || '');
      setLocation('/login');
      return;
    }

    // Check requirements against user profile
    const missing: string[] = [];
    
    if (adoptionRequirements) {
      // Check phone number requirement
      if (adoptionRequirements.requirePhoneNumber && !userProfile?.phoneNumber) {
        missing.push("Phone number");
      }
      
      // Check completed profile (basic info)
      if (adoptionRequirements.requireCompletedProfile) {
        if (!userProfile?.city || !userProfile?.state) {
          missing.push("Location (city and state)");
        }
        if (!userProfile?.homeType) {
          missing.push("Housing type");
        }
      }
      
      // Check profile photo requirement
      if (adoptionRequirements.requireProfilePhoto && !userProfile?.profilePhotoUrl) {
        missing.push("Profile photo");
      }
    } else {
      // Default requirements if not configured
      if (!userProfile?.phoneNumber) {
        missing.push("Phone number");
      }
      if (!userProfile?.city || !userProfile?.state) {
        missing.push("Location (city and state)");
      }
    }

    // If missing requirements, show dialog
    if (missing.length > 0) {
      setMissingRequirements(missing);
      setShowRequirementsDialog(true);
      return;
    }

    // Check if there are application questions to answer
    const hasStandardQuestions = applicationQuestions?.standardQuestions && applicationQuestions.standardQuestions.length > 0;
    const hasShelterQuestions = applicationQuestions?.shelterQuestions && applicationQuestions.shelterQuestions.length > 0;
    
    if (hasStandardQuestions || hasShelterQuestions) {
      // Show application questions dialog
      setShowApplicationDialog(true);
      return;
    }

    // No questions to answer - proceed with application directly
    applyForAdoptionMutation.mutate({});
  };

  // Handle inline profile update and auto-apply
  const handleInlineProfileUpdate = async () => {
    setIsUpdatingProfile(true);
    
    try {
      // Build update payload with only non-empty fields
      const updatePayload: any = {};
      if (inlineFormData.phoneNumber.trim()) {
        updatePayload.phoneNumber = inlineFormData.phoneNumber.trim();
      }
      if (inlineFormData.city.trim()) {
        updatePayload.city = inlineFormData.city.trim();
      }
      if (inlineFormData.state.trim()) {
        updatePayload.state = inlineFormData.state.trim();
      }
      if (inlineFormData.homeType) {
        updatePayload.homeType = inlineFormData.homeType;
      }

      // Update profile
      await apiRequest("PATCH", "/api/user-profile", updatePayload);
      
      // Invalidate profile cache
      queryClient.invalidateQueries({ queryKey: ["/api/user-profile"] });
      
      // Close dialog
      setShowRequirementsDialog(false);
      
      // Reset form
      setInlineFormData({ phoneNumber: "", city: "", state: "", homeType: "" });
      
      // Show success
      toast({
        title: "Perfect, profile saved!",
        description: "Let's continue with your application...",
      });
      
      // Check if there are application questions to answer
      const hasStandardQuestions = applicationQuestions?.standardQuestions && applicationQuestions.standardQuestions.length > 0;
      const hasShelterQuestions = applicationQuestions?.shelterQuestions && applicationQuestions.shelterQuestions.length > 0;
      
      if (hasStandardQuestions || hasShelterQuestions) {
        // Show application questions dialog
        setShowApplicationDialog(true);
      } else {
        // No questions - proceed with application directly
        setTimeout(() => {
          applyForAdoptionMutation.mutate({});
        }, 300);
      }
      
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Couldn't update profile",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Handle application form submission with answers
  const handleApplicationSubmit = () => {
    console.log('[Application] Submit clicked, answers:', applicationAnswers);
    console.log('[Application] Questions:', applicationQuestions);
    
    // Validate required questions are answered
    const standardQuestions = applicationQuestions?.standardQuestions || [];
    const shelterQuestions = applicationQuestions?.shelterQuestions || [];
    
    console.log('[Application] Standard questions:', standardQuestions.length, 'Shelter questions:', shelterQuestions.length);
    
    // Check required standard questions with correct prefix
    const requiredUnansweredStandard = standardQuestions
      .filter(q => q.isRequired)
      .filter(q => {
        const answer = applicationAnswers[`std_${q.id}`];
        if (answer === undefined || answer === null) return true;
        if (typeof answer === 'string' && !answer.trim()) return true;
        if (Array.isArray(answer) && answer.length === 0) return true;
        return false;
      });
    
    // Check required shelter questions with correct prefix
    const requiredUnansweredShelter = shelterQuestions
      .filter(q => q.isRequired)
      .filter(q => {
        const answer = applicationAnswers[`shelter_${q.id}`];
        if (answer === undefined || answer === null) return true;
        if (typeof answer === 'string' && !answer.trim()) return true;
        if (Array.isArray(answer) && answer.length === 0) return true;
        return false;
      });
    
    const totalRequired = requiredUnansweredStandard.length + requiredUnansweredShelter.length;
    console.log('[Application] Required unanswered:', totalRequired, { requiredUnansweredStandard, requiredUnansweredShelter });
    
    if (totalRequired > 0) {
      toast({
        title: "Please complete required questions",
        description: `${totalRequired} required question(s) need to be answered.`,
        variant: "destructive",
      });
      return;
    }
    
    console.log('[Application] Submitting mutation with answers:', applicationAnswers);
    // Submit application with answers
    applyForAdoptionMutation.mutate(applicationAnswers);
  };

  // Helper function to render question input based on type
  const renderQuestionInput = (question: ApplicationQuestion | ShelterApplicationQuestion, prefix: string = "") => {
    const questionId = `${prefix}${question.id}`;
    const value = applicationAnswers[questionId] || "";
    
    const handleChange = (val: string | string[] | boolean) => {
      setApplicationAnswers(prev => ({ ...prev, [questionId]: val }));
    };

    switch (question.questionType) {
      case "textarea":
        return (
          <Textarea
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={question.helperText || "Your answer..."}
            className="min-h-[100px]"
            data-testid={`textarea-question-${questionId}`}
          />
        );
      
      case "select":
        return (
          <Select value={value as string} onValueChange={handleChange}>
            <SelectTrigger data-testid={`select-question-${questionId}`}>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option, i) => (
                <SelectItem key={i} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      
      case "multiselect":
        return (
          <div className="space-y-2">
            {question.options?.map((option, i) => {
              const selected = Array.isArray(value) ? value.includes(option) : false;
              return (
                <div key={i} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${questionId}-${i}`}
                    checked={selected}
                    onCheckedChange={(checked) => {
                      const currentValues = Array.isArray(value) ? value : [];
                      if (checked) {
                        handleChange([...currentValues, option]);
                      } else {
                        handleChange(currentValues.filter(v => v !== option));
                      }
                    }}
                    data-testid={`checkbox-question-${questionId}-${i}`}
                  />
                  <Label htmlFor={`${questionId}-${i}`} className="text-sm">{option}</Label>
                </div>
              );
            })}
          </div>
        );
      
      case "boolean":
      case "yes_no":
        return (
          <div className="flex gap-4">
            <Button
              type="button"
              variant={value === "yes" ? "default" : "outline"}
              onClick={() => handleChange("yes")}
              data-testid={`button-question-${questionId}-yes`}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant={value === "no" ? "default" : "outline"}
              onClick={() => handleChange("no")}
              data-testid={`button-question-${questionId}-no`}
            >
              No
            </Button>
          </div>
        );
      
      case "number":
        return (
          <Input
            type="number"
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={question.helperText || "Enter a number"}
            data-testid={`input-question-${questionId}`}
          />
        );
      
      default: // "text"
        return (
          <Input
            type="text"
            value={value as string}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={question.helperText || "Your answer..."}
            data-testid={`input-question-${questionId}`}
          />
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background animate-fadeIn" data-testid="status-dog-profile-loading">
        <div className="relative h-[500px] md:h-[600px] skeleton-shimmer bg-muted">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        </div>
        <div className="relative -mt-12 bg-background rounded-t-3xl">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3 flex-1">
                <Skeleton className="h-9 w-48" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-16 w-16 rounded-2xl" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="flex items-center justify-center pt-4 gap-2 text-muted-foreground">
              <Heart className="w-5 h-5 animate-pulse text-primary" />
              <span className="font-medium">Loading profile...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!dog) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md animate-fadeInUp">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-muted to-muted/50 rounded-2xl flex items-center justify-center">
              <Heart className="w-12 h-12 text-muted-foreground/30" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">Pet not found</h2>
            <p className="text-muted-foreground">
              This pet may have found their forever home, or the listing was removed.
            </p>
          </div>
          <Button 
            onClick={() => setLocation("/discover")} 
            data-testid="button-back-discover"
            className="btn-premium"
            size="lg"
          >
            Discover More Pets
          </Button>
        </div>
      </div>
    );
  }

  const energyLevels = {
    low: { label: "Low Energy", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    moderate: { label: "Moderate", color: "bg-green-500/10 text-green-700 dark:text-green-300" },
    high: { label: "High Energy", color: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
    very_high: { label: "Very High", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  };

  const energy = energyLevels[dog.energyLevel as keyof typeof energyLevels];

  return (
    <div className="bg-background pb-20 animate-fadeIn">
      {/* Header with breadcrumb navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-card-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackClick}
              data-testid="button-back-nav"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Heart className="w-4 h-4 text-primary-foreground fill-current" />
              </div>
              <span className="font-serif text-xl font-bold">Scout</span>
            </div>

            <div className="w-10"></div>
          </div>

          {/* Breadcrumb */}
          <Breadcrumb className="hidden sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink onClick={() => setLocation(getBackPath())} className="cursor-pointer">
                  {getBackPath() === '/map' ? 'Map' : 
                   getBackPath() === '/messages' ? 'Messages' :
                   getBackPath() === '/profile' ? 'Liked Dogs' : 'Discover'}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{dog?.name || 'Dog Profile'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      {/* Photo Gallery */}
      <motion.div 
        className="relative h-[500px] md:h-[600px] bg-black mt-[57px]"
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Main Photo with Fade Transition */}
        <div className="relative w-full h-full">
          {dog.photos.map((photo, idx) => (
            <motion.img
              key={idx}
              src={photo}
              alt={`${dog.name} - Photo ${idx + 1}`}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                idx === currentPhotoIndex ? 'opacity-100' : 'opacity-0'
              }`}
              initial={idx === 0 ? { scale: 1.05 } : {}}
              animate={idx === 0 ? { scale: 1 } : {}}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            />
          ))}
        </div>

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        <div className="absolute top-4 right-4 flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white border border-white/20 transition-all"
            data-testid="button-share"
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="bg-black/40 hover:bg-black/60 backdrop-blur-md text-white border border-white/20 transition-all"
            data-testid="button-favorite"
          >
            <Heart className="w-5 h-5" />
          </Button>
        </div>

        {/* Swipe Areas for Photos */}
        {dog.photos.length > 1 && (
          <>
            <button
              onClick={() => setCurrentPhotoIndex((prev) => prev > 0 ? prev - 1 : dog.photos.length - 1)}
              className="absolute left-0 top-0 bottom-0 w-1/3 cursor-pointer hover:bg-gradient-to-r hover:from-black/20 hover:to-transparent transition-all"
              aria-label="Previous photo"
            />
            <button
              onClick={() => setCurrentPhotoIndex((prev) => prev < dog.photos.length - 1 ? prev + 1 : 0)}
              className="absolute right-0 top-0 bottom-0 w-1/3 cursor-pointer hover:bg-gradient-to-l hover:from-black/20 hover:to-transparent transition-all"
              aria-label="Next photo"
            />
          </>
        )}

        {/* Photo Dots */}
        {dog.photos.length > 1 && (
          <div className="absolute top-20 left-0 right-0 flex justify-center gap-1.5 px-4">
            {dog.photos.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPhotoIndex(idx)}
                className={`h-1 rounded-full transition-all ${
                  idx === currentPhotoIndex
                    ? "w-8 bg-white shadow-lg"
                    : "w-1 bg-white/60 hover:bg-white/80"
                }`}
                data-testid={`button-photo-${idx}`}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Content */}
      <motion.div 
        className="max-w-3xl mx-auto px-6 py-8 space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
      >
        {/* Header */}
        <div className="space-y-4 animate-slideUp">
          <div>
            <h1 className="font-serif text-5xl md:text-6xl mb-3 leading-tight">{dog.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-lg text-muted-foreground mb-2">
              <span className="font-medium">{dog.breed}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>{dog.age} {dog.age === 1 ? 'year' : 'years'} old</span>
              <span className="text-muted-foreground/50">•</span>
              <span>{dog.weight} lbs</span>
            </div>
            <div className="flex items-center gap-2 text-base">
              <MapPin className="w-5 h-5 text-primary" />
              <span className="font-semibold text-primary">
                {dog.distance !== undefined && dog.distance < 0.1 
                  ? `${Math.round(dog.distance * 5280)} feet away` 
                  : dog.distance !== undefined
                    ? `${dog.distance.toFixed(1)} miles away`
                    : 'Location unavailable'}
              </span>
            </div>
            {dog.viewCount > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                👁️ {dog.viewCount.toLocaleString()} {dog.viewCount === 1 ? 'view' : 'views'}
              </div>
            )}
          </div>

          {/* Compatibility Score - Compact Design */}
          <Card className="border-primary/20 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="bg-gradient-to-br from-primary to-primary/80 w-14 h-14 rounded-full flex items-center justify-center shadow-lg">
                    <Heart className="w-6 h-6 text-white fill-current" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary/20 rounded-full animate-ping" />
                </div>
                <div className="flex-1">
                  <div className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {dog.compatibilityScore}%
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Perfect Match Score</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Apply for Adoption CTA - Only show if no active journey and hasn't applied yet */}
          {!adoptionJourney && !hasApplied && (
            <>
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-lg overflow-hidden">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                      <Heart className="w-8 h-8 text-primary" />
                    </div>

                    {/* Show different content based on whether user has completed an application before */}
                    {applicationStatus?.hasCompletedApplication ? (
                      <>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">
                            Ready to meet {dog?.name}?
                          </h3>
                          <p className="text-muted-foreground mt-2">
                            Since you've already applied for another dog, we can use your previous application info!
                          </p>
                        </div>
                        <Button
                          size="lg"
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl hover:shadow-2xl transition-all text-lg py-6"
                          onClick={() => {
                            if (!currentUser) {
                              sessionStorage.setItem('returnToDog', params.id || '');
                              setLocation('/login');
                              return;
                            }
                            quickApplyMutation.mutate();
                          }}
                          disabled={quickApplyMutation.isPending}
                          data-testid="button-quick-apply"
                        >
                          {quickApplyMutation.isPending ? (
                            <>
                              <div className="w-6 h-6 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Zap className="w-6 h-6 mr-2" />
                              Quick Apply
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Skip the application - we'll use your info on file
                        </p>
                      </>
                    ) : (
                      <>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">
                            Ready to meet {dog?.name}?
                          </h3>
                          <p className="text-muted-foreground mt-2">
                            Complete a quick application to start your adoption journey. It only takes a minute!
                          </p>
                        </div>
                        <Button
                          size="lg"
                          className="flex-1 text-lg py-6"
                          onClick={validateAndApply}
                          disabled={applyForAdoptionMutation.isPending || hasApplied}
                          data-testid="button-apply-adoption"
                        >
                          {applyForAdoptionMutation.isPending
                            ? "Submitting..."
                            : hasApplied
                            ? "Application Started"
                            : profile?.mode === 'foster'
                            ? "Apply to Foster"
                            : "Apply to Adopt"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          5 quick steps to complete
                        </p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Journey Status - Show if journey exists or has just applied */}
          {(adoptionJourney || hasApplied) && (
            <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500/10 p-3 rounded-full">
                      <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">Adoption in Progress</div>
                      <div className="text-sm text-muted-foreground">
                        Click the tracker button below to see your progress
                      </div>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                    Active
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Match Explanation */}
        {dog.compatibilityReasons.length > 0 && (
          <div className="space-y-4 animate-slideUp">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-full">
                <Heart className="w-5 h-5 text-primary" />
              </div>
              Why Scout thinks you'll love {dog.name}
            </h2>
            <Card className="border-primary/10 shadow-md">
              <CardContent className="p-6">
                <ul className="space-y-4">
                  {dog.compatibilityReasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-3 group">
                      <div className="bg-primary/10 p-1.5 rounded-full group-hover:bg-primary/20 transition-colors">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      </div>
                      <span className="text-base leading-relaxed">{reason}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* About */}
        <div className="space-y-4 animate-slideUp">
          <h2 className="text-2xl font-bold">About {dog.name}</h2>
          <Card className="shadow-md">
            <CardContent className="p-6 space-y-6">
              <p className="text-base leading-relaxed text-foreground/90">{dog.bio}</p>

              {/* Traits - Enhanced */}
              <div className="space-y-4">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Smile className="w-4 h-4 text-primary" />
                  Personality & Traits
                </h3>
                <div className="space-y-3">
                  {/* Energy Level Badge */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Energy Level</div>
                    <Badge className={`${energy.color} px-4 py-2 text-sm font-medium w-full justify-center`}>
                      <Zap className="w-4 h-4 mr-2" />
                      {energy.label}
                    </Badge>
                  </div>

                  {/* Temperament Traits */}
                  {dog.temperament.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Temperament</div>
                      <div className="flex flex-wrap gap-2">
                        {dog.temperament.map((trait, idx) => (
                          <Badge key={idx} variant="secondary" className="capitalize px-3 py-1.5 text-sm hover-elevate">
                            {trait}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Good With - Enhanced */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Great With
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className={`p-5 rounded-xl transition-all border-2 text-center ${
                    dog.goodWithKids
                      ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800'
                      : 'bg-muted/30 border-border'
                  }`}>
                    <div className={`text-3xl mb-3 ${
                      dog.goodWithKids ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground/50'
                    }`}>
                      👶
                    </div>
                    <div className={`text-xs font-semibold ${
                      dog.goodWithKids ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'
                    }`}>
                      {dog.goodWithKids ? 'Kids' : 'No Kids'}
                    </div>
                  </div>
                  <div className={`p-5 rounded-xl transition-all border-2 text-center ${
                    dog.goodWithDogs
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800'
                      : 'bg-muted/30 border-border'
                  }`}>
                    <div className={`text-3xl mb-3 ${
                      dog.goodWithDogs ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground/50'
                    }`}>
                      🐕
                    </div>
                    <div className={`text-xs font-semibold ${
                      dog.goodWithDogs ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground'
                    }`}>
                      {dog.goodWithDogs ? 'Dogs' : 'No Dogs'}
                    </div>
                  </div>
                  <div className={`p-5 rounded-xl transition-all border-2 text-center ${
                    dog.goodWithCats
                      ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
                      : 'bg-muted/30 border-border'
                  }`}>
                    <div className={`text-3xl mb-3 ${
                      dog.goodWithCats ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground/50'
                    }`}>
                      🐱
                    </div>
                    <div className={`text-xs font-semibold ${
                      dog.goodWithCats ? 'text-purple-700 dark:text-purple-300' : 'text-muted-foreground'
                    }`}>
                      {dog.goodWithCats ? 'Cats' : 'No Cats'}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Day in the Life Video */}
        {dog.dayInLifeVideo && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">A Day with {dog.name}</h3>
            <DayInLifeVideo videoUrl={dog.dayInLifeVideo} dogName={dog.name} />
          </div>
        )}

        {/* Health & Details - Enhanced */}
        <div className="space-y-4 animate-slideUp">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <div className="bg-green-500/10 p-2 rounded-full">
              <Stethoscope className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            Health & Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vaccination Status */}
            <Card className={`shadow-md transition-all ${dog.vaccinated ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-800/50' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${dog.vaccinated ? 'bg-green-500/10' : 'bg-muted/50'}`}>
                    <Pill className={`w-6 h-6 ${dog.vaccinated ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">Vaccination Status</div>
                    <div className={`text-sm ${dog.vaccinated ? 'text-green-700 dark:text-green-300 font-medium' : 'text-muted-foreground'}`}>
                      {dog.vaccinated ? '✓ Fully Vaccinated' : 'Not vaccinated'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Spay/Neuter Status */}
            <Card className={`shadow-md transition-all ${dog.spayedNeutered ? 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/50' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${dog.spayedNeutered ? 'bg-blue-500/10' : 'bg-muted/50'}`}>
                    <Shield className={`w-6 h-6 ${dog.spayedNeutered ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm">Surgery Status</div>
                    <div className={`text-sm ${dog.spayedNeutered ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-muted-foreground'}`}>
                      {dog.spayedNeutered ? '✓ Spayed/Neutered' : 'Not spayed/neutered'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Special Needs Alert */}
          {dog.specialNeeds && (
            <Card className="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/50 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm mb-2">Special Needs & Care</div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{dog.specialNeeds}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Posted By Information */}
        <div className="space-y-3">
          {/* Determine if this is a shelter or owner listing based on ownerRole */}
          {(() => {
            // Use ownerRole from API (based on user's actual role) instead of string matching
            // Both 'adopter' and 'owner' roles indicate individual owners (not shelters)
            const isOwner = dog.ownerRole === 'adopter' || dog.ownerRole === 'owner';
            const heading = isOwner ? "Contact Information" : "Shelter Information";
            const messageLabel = isOwner ? "Message Owner" : "Message Shelter";

            return (
              <>
                <h2 className="text-xl font-bold">{heading}</h2>
                <Card>
                  <CardContent className="p-6 space-y-4">
                    {/* For owners, hide personal information for privacy */}
                    {isOwner ? (
                      <div className="flex items-start gap-3 bg-primary/5 rounded-lg p-4 border border-primary/20">
                        <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm font-medium text-foreground mb-1">
                            Owner Information is Private
                          </div>
                          <p className="text-sm text-muted-foreground">
                            To protect the owner's privacy, contact details are only shared through Scout messaging. Connect through the messaging system to arrange a meet-and-greet.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <Home className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-sm text-muted-foreground mb-1">
                              Available at
                            </div>
                            <h3 className="font-semibold">{dog.shelterName}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{dog.shelterAddress}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-primary" />
                          <a href={`tel:${dog.shelterPhone}`} className="text-sm hover:underline">
                            {dog.shelterPhone}
                          </a>
                        </div>
                      </>
                    )}

                    <div className="pt-4 space-y-3">
                      <Button
                        className="w-full"
                        size="lg"
                        data-testid="button-schedule-visit"
                        onClick={() => setShowScheduleDialog(true)}
                      >
                        <Calendar className="w-5 h-5 mr-2" />
                        Schedule a Visit
                      </Button>
                      
                      {/* Show phone button only for shelters */}
                      {!isOwner && (
                        <Button variant="outline" className="w-full" size="lg" asChild>
                          <a href={`tel:${dog.shelterPhone}`}>
                            <Phone className="w-5 h-5 mr-2" />
                            Call Shelter
                          </a>
                        </Button>
                      )}

                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full"
                        onClick={async () => {
                          try {
                            console.log('[DogProfile] Starting conversation for dog:', dog.id);
                            // Get or create conversation
                            const response = await apiRequest("GET", `/api/conversations/by-dog/${dog.id}`);
                            const conversation = await response.json();
                            console.log('[DogProfile] Got conversation:', conversation.id);
                            setLocation(`/messages/${conversation.id}`);
                          } catch (error) {
                            console.error("Error starting conversation:", error);
                            toast({
                              title: "Error",
                              description: "Failed to start conversation. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                        data-testid="button-message-shelter"
                      >
                        <MessageCircle className="w-5 h-5 mr-2" />
                        {messageLabel}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </div>

      </motion.div>

      {/* Schedule Visit Dialog */}
      <AlertDialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <AlertDialogContent data-testid="schedule-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule a Visit with {dog.name}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-2">
              {(() => {
                // Use ownerRole from API (based on user's actual role) instead of string matching
                // Both 'adopter' and 'owner' roles indicate individual owners (not shelters)
                const isOwner = dog.ownerRole === 'adopter' || dog.ownerRole === 'owner';

                if (isOwner) {
                  return (
                    <>
                      <p>
                        To schedule a visit with {dog.name}, send a message through Scout.
                      </p>

                      <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                        <div className="flex items-start gap-3">
                          <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-foreground text-sm mb-1">Private Adoption</div>
                            <p className="text-sm text-muted-foreground">
                              The owner's contact details are kept private. Please use the messaging feature to connect with them and arrange a meet-and-greet.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                } else {
                  const displayName = dog.shelterName;
                  return (
                    <>
                      <p>
                        To schedule a visit with {dog.name}, please contact the shelter directly:
                      </p>

                      <div className="bg-accent/50 rounded-lg p-4 space-y-3 text-left">
                        <div className="flex items-start gap-3">
                          <Home className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-foreground">{displayName}</div>
                            <div className="text-sm">{dog.shelterAddress}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-primary" />
                          <a
                            href={`tel:${dog.shelterPhone}`}
                            className="font-semibold text-foreground hover:underline"
                          >
                            {dog.shelterPhone}
                          </a>
                        </div>
                      </div>

                      <p className="text-sm">
                        The shelter staff will be happy to arrange a meet-and-greet with {dog.name} and answer any questions about the adoption process.
                      </p>
                    </>
                  );
                }
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              className="w-full sm:w-auto"
              data-testid="button-cancel-schedule"
            >
              Close
            </AlertDialogCancel>
            {(() => {
              const isOwner = dog.ownerRole === 'adopter' || dog.ownerRole === 'owner';
              if (!isOwner) {
                return (
                  <AlertDialogAction
                    className="w-full sm:w-auto"
                    asChild
                    data-testid="button-call-shelter"
                  >
                    <a href={`tel:${dog.shelterPhone}`}>
                      <Phone className="w-4 h-4 mr-2" />
                      Call Now
                    </a>
                  </AlertDialogAction>
                );
              }
              return null;
            })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Virtual Tour Dialog */}
      <Dialog open={showVirtualTourDialog} onOpenChange={setShowVirtualTourDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Virtual Meet & Greet</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Meet {dog.name} from the comfort of your home via video call
            </p>
          </DialogHeader>
          <VirtualTourScheduler 
            dogId={dog.id} 
            dogName={dog.name}
            onScheduled={() => setShowVirtualTourDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Quick Profile Completion Dialog */}
      <Dialog open={showRequirementsDialog} onOpenChange={setShowRequirementsDialog}>
        <DialogContent className="sm:max-w-md" data-testid="requirements-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              Almost there!
            </DialogTitle>
            <DialogDescription>
              Just a few quick details to start your journey with {dog.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Phone Number Field */}
            {missingRequirements.includes("Phone number") && (
              <div className="space-y-2">
                <Label htmlFor="inline-phone" className="text-sm font-medium">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inline-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={inlineFormData.phoneNumber}
                  onChange={(e) => setInlineFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  data-testid="input-inline-phone"
                />
                <p className="text-xs text-muted-foreground">
                  For shelters to contact you about {dog.name}
                </p>
              </div>
            )}
            
            {/* Location Fields */}
            {missingRequirements.includes("Location (city and state)") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="inline-city" className="text-sm font-medium">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inline-city"
                    placeholder="San Francisco"
                    value={inlineFormData.city}
                    onChange={(e) => setInlineFormData(prev => ({ ...prev, city: e.target.value }))}
                    data-testid="input-inline-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inline-state" className="text-sm font-medium">
                    State <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="inline-state"
                    placeholder="CA"
                    value={inlineFormData.state}
                    onChange={(e) => setInlineFormData(prev => ({ ...prev, state: e.target.value }))}
                    data-testid="input-inline-state"
                  />
                </div>
              </div>
            )}
            
            {/* Housing Type Field */}
            {missingRequirements.includes("Housing type") && (
              <div className="space-y-2">
                <Label htmlFor="inline-housing" className="text-sm font-medium">
                  Housing Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={inlineFormData.homeType}
                  onValueChange={(value) => setInlineFormData(prev => ({ ...prev, homeType: value }))}
                >
                  <SelectTrigger id="inline-housing" data-testid="select-inline-housing">
                    <SelectValue placeholder="Select your housing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="mobile_home">Mobile Home</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Friendly message */}
            <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
              <p className="text-xs text-muted-foreground">
                This info helps shelters understand your situation better. You can always update it later in your profile.
              </p>
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRequirementsDialog(false)}
              className="w-full sm:w-auto"
              data-testid="button-cancel-requirements"
            >
              Not Now
            </Button>
            <Button
              onClick={handleInlineProfileUpdate}
              disabled={isUpdatingProfile || (
                (missingRequirements.includes("Phone number") && !inlineFormData.phoneNumber.trim()) ||
                (missingRequirements.includes("Location (city and state)") && (!inlineFormData.city.trim() || !inlineFormData.state.trim())) ||
                (missingRequirements.includes("Housing type") && !inlineFormData.homeType)
              )}
              className="w-full sm:w-auto"
              data-testid="button-save-and-apply"
            >
              {isUpdatingProfile ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 mr-2" />
                  Save & Apply for {dog.name}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application Questions Dialog */}
      <Dialog 
        open={showApplicationDialog} 
        onOpenChange={(open) => {
          setShowApplicationDialog(open);
          // Reset answers when dialog is closed without submitting
          if (!open) {
            setApplicationAnswers({});
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="application-questions-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-primary" />
              Application for {dog.name}
            </DialogTitle>
            <DialogDescription>
              Please answer the following questions to complete your application.
              {applicationQuestions?.shelterName && (
                <span className="block mt-1 text-xs">
                  Includes questions from {applicationQuestions.shelterName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
              {/* Standard Admin Questions */}
              {applicationQuestions?.standardQuestions && applicationQuestions.standardQuestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    General Questions
                  </h3>
                  {applicationQuestions.standardQuestions.map((question, index) => (
                    <div key={question.id} className="space-y-2 pb-4 border-b border-border/50 last:border-0">
                      <Label className="text-sm font-medium">
                        {index + 1}. {question.questionText}
                        {question.isRequired && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {question.helperText && (
                        <p className="text-xs text-muted-foreground mb-2">{question.helperText}</p>
                      )}
                      {renderQuestionInput(question, "std_")}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Shelter-Specific Questions */}
              {applicationQuestions?.shelterQuestions && applicationQuestions.shelterQuestions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {applicationQuestions.shelterName ? `Questions from ${applicationQuestions.shelterName}` : "Additional Questions"}
                  </h3>
                  {applicationQuestions.shelterQuestions.map((question, index) => (
                    <div key={question.id} className="space-y-2 pb-4 border-b border-border/50 last:border-0">
                      <Label className="text-sm font-medium">
                        {(applicationQuestions.standardQuestions?.length || 0) + index + 1}. {question.questionText}
                        {question.isRequired && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {question.helperText && (
                        <p className="text-xs text-muted-foreground mb-2">{question.helperText}</p>
                      )}
                      {renderQuestionInput(question, "shelter_")}
                    </div>
                  ))}
                </div>
              )}
              
            {/* No questions fallback */}
            {(!applicationQuestions?.standardQuestions?.length && !applicationQuestions?.shelterQuestions?.length) && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No additional questions required for this application.</p>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowApplicationDialog(false)}
              className="w-full sm:w-auto"
              data-testid="button-cancel-application"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplicationSubmit}
              disabled={applyForAdoptionMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-submit-application"
            >
              {applyForAdoptionMutation.isPending ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-50 px-6 pointer-events-none">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-4 pointer-events-auto">
          {/* Pass Button */}
          <Button
            size="icon"
            variant="outline"
            className="w-16 h-16 rounded-full shadow-2xl bg-card hover:bg-card border-2 hover:scale-110 transition-all"
            onClick={() => swipeMutation.mutate("left")}
            disabled={swipeMutation.isPending}
            data-testid="button-pass-floating"
          >
            <X className="w-7 h-7 text-destructive" />
          </Button>

          {/* Like Button */}
          <Button
            size="icon"
            className="w-20 h-20 rounded-full shadow-2xl bg-primary hover:bg-primary/90 hover:scale-110 transition-all"
            onClick={() => swipeMutation.mutate("right")}
            disabled={swipeMutation.isPending}
            data-testid="button-like-floating"
          >
            <Heart className="w-9 h-9 fill-current" />
          </Button>

          {/* Message Button */}
          <Button
            size="icon"
            variant="outline"
            className="w-16 h-16 rounded-full shadow-2xl bg-card hover:bg-card border-2 hover:scale-110 transition-all"
            onClick={async () => {
              console.log('[DogProfile] Floating message button clicked for dog:', dog.id);
              await handleMessage();
            }}
            data-testid="button-message-floating"
          >
            <MessageCircle className="w-7 h-7 text-primary" />
          </Button>

          {/* Adoption Journey Tracker Button - Show if there's an active journey or has just applied */}
          {(adoptionJourney || hasApplied) && (
            <Button
              size="icon"
              variant="outline"
              className="w-16 h-16 rounded-full shadow-2xl bg-card hover:bg-card border-2 hover:scale-110 transition-all"
              onClick={() => setShowJourneyTracker(true)}
              data-testid="button-adoption-journey-floating"
            >
              <ClipboardList className="w-7 h-7 text-primary" />
            </Button>
          )}
        </div>
      </div>

      {/* Journey Tracker Dialog */}
      <Dialog open={showJourneyTracker} onOpenChange={setShowJourneyTracker}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Adoption Journey</DialogTitle>
          </DialogHeader>
          {adoptionJourney ? (
            <AdoptionJourneyTracker
              journey={adoptionJourney}
              dogName={dog.name}
              shelterId={dog.shelterId || undefined}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Loading your adoption journey...</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}