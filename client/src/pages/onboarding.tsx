import { useState, useEffect, startTransition } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FormStepper, FormSection } from "@/components/form-templates";
import { 
  Home, 
  Building2, 
  TreeDeciduous, 
  Dog, 
  Dumbbell, 
  Briefcase, 
  Heart, 
  MapPin, 
  ArrowRight,
  Ruler,
  Calendar,
  Zap,
  Award,
  Sparkles
} from "lucide-react";
import type { OnboardingData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

type UserIntent = "adopter" | "shelter";

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [userIntent, setUserIntent] = useState<UserIntent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({
    searchRadius: 25,
    preferredSize: [],
    preferredAge: [],
    preferredEnergy: [],
  });

  // Check if user is already authenticated
  const { data: currentUser, isLoading: isLoadingUser } = useQuery<{ id: string; role: string } | null>({
    queryKey: ["/api/me"],
    retry: false,
  });

  // Check if user has completed profile (for adopters)
  const { data: profile, isLoading: isLoadingProfile } = useQuery<{ mode?: 'adopt' | 'foster' | 'rehome' } | null>({
    queryKey: ["/api/profile"],
    enabled: !!currentUser && currentUser.role !== 'shelter',
    retry: false,
  });

  // Check if shelter has completed profile
  const { data: shelterProfile, isLoading: isLoadingShelterProfile } = useQuery<{ id: string; shelterName: string } | null>({
    queryKey: ["/api/shelter/profile"],
    enabled: !!currentUser && currentUser.role === 'shelter',
    retry: false,
  });

  // Handle redirects for authenticated users
  useEffect(() => {
    if (currentUser) {
      // For shelter users, check shelter profile
      if (currentUser.role === 'shelter') {
        if (shelterProfile) {
          console.log("[Onboarding] Shelter already has profile, redirecting to operations hub");
          startTransition(() => setLocation("/shelter/operations"));
        } else if (!isLoadingShelterProfile) {
          console.log("[Onboarding] Shelter user without profile, redirecting to shelter onboarding");
          startTransition(() => setLocation("/shelter-onboarding"));
        }
        return;
      }

      // For adopters/owners, check user profile
      if (profile) {
        console.log("[Onboarding] User already has profile, redirecting to", profile.mode || 'discover');
        
        if (currentUser.role === 'adopter' || currentUser.role === 'owner') {
          // Redirect based on mode (works for both adopter and legacy owner roles)
          if (profile.mode === 'rehome') {
            startTransition(() => setLocation("/owner-dashboard"));
          } else {
            startTransition(() => setLocation("/discover"));
          }
        }
        return;
      }

      // For adopters/owners without profile, skip to questionnaire (step 1)
      if ((currentUser.role === 'adopter' || currentUser.role === 'owner') && step === 0) {
        console.log("[Onboarding] Authenticated adopter/owner without profile, skipping to questionnaire");
        setStep(1);
      }
    }
  }, [currentUser, profile, shelterProfile, isLoadingShelterProfile, setLocation]);

  // Show loading state while checking auth and profile status
  // This prevents the onboarding UI from flashing before redirect
  const isLoadingAnyProfile = currentUser?.role === 'shelter' ? isLoadingShelterProfile : isLoadingProfile;
  if (isLoadingUser || (currentUser && isLoadingAnyProfile)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Total steps: 1 intent + 11 lifestyle questions = 12 total
  const totalSteps = 12;
  const actualSteps = 12; // Actual number of steps in the flow
  const progress = ((step + 1) / actualSteps) * 100;

  const handleIntentSelect = (intent: UserIntent) => {
    setUserIntent(intent);

    // All users need to authenticate before continuing with their respective flows
    startTransition(() => setLocation(`/login?intended_role=${intent}`));
  };

  const handleSelect = async (key: keyof OnboardingData | "userIntent", value: any) => {
    // Special handling for intent selection
    if (key === "userIntent") {
      if (value === "shelter") {
        try {
          // Update user role first
          await apiRequest("PATCH", "/api/me/role", { role: value });
          
          // Then redirect to shelter onboarding
          setLocation("/shelter-onboarding");
        } catch (error) {
          console.error("Failed to update user role:", error);
          toast({
            title: "Error",
            description: "Failed to update your role. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }
      // If adopter, continue with the flow
    }

    setFormData({ ...formData, [key]: value });
    setTimeout(() => {
      if (step < actualSteps - 1) {
        setStep(step + 1);
      } else {
        handleSubmit();
      }
    }, 200);
  };

  const handleMultiSelect = (key: keyof OnboardingData, value: string) => {
    const current = formData[key] as string[] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setFormData({ ...formData, [key]: updated });
  };

  const handleNext = () => {
    if (step < actualSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    // Prevent multiple submissions
    if (isSubmitting) {
      console.log("[Onboarding] Already submitting, skipping duplicate call");
      return;
    }

    console.log("[Onboarding] handleSubmit called");
    console.log("[Onboarding] formData:", formData);
    setIsSubmitting(true);

    // Helper function to save profile to database and navigate
    const saveProfileAndNavigate = async (profileData: any) => {
      try {
        // Transform the form data to match the database schema
        const homeType = profileData.livingSituation?.includes("apartment") ? "apartment" 
          : profileData.livingSituation?.includes("condo") ? "condo"
          : "house"; // Default to house for all house_* variants

        const hasYard = profileData.livingSituation?.includes("yard") || false;

        const hasOtherPets = profileData.otherPets !== "none" && !!profileData.otherPets;
        const otherPetsType = (profileData.otherPets === "none" || !profileData.otherPets) 
          ? null 
          : profileData.otherPets;

        // Build profile data with correct field mappings
        const dbProfileData = {
          homeType,
          hasYard,
          hasOtherPets,
          otherPetsType,
          activityLevel: profileData.activityLevel,
          workSchedule: profileData.workSchedule,
          exerciseCommitment: profileData.exerciseCommitment,
          experienceLevel: profileData.experienceLevel,
          preferredSize: profileData.preferredSize || [],
          preferredAge: profileData.preferredAge || [],
          preferredEnergy: profileData.preferredEnergy || [],
          householdComposition: profileData.householdComposition,
          searchRadius: profileData.searchRadius || 25,
          latitude: profileData.latitude,
          longitude: profileData.longitude,
        };

        console.log("[Onboarding] Saving profile to database", dbProfileData);

        // Try to create profile, if it exists, update it instead
        try {
          await apiRequest("POST", "/api/profile", dbProfileData);
          console.log("[Onboarding] Profile created successfully");
        } catch (error: any) {
          // If profile already exists (400), update it instead
          if (error?.status === 400 || error?.message?.includes("already exists")) {
            console.log("[Onboarding] Profile exists, updating with PATCH");
            await apiRequest("PATCH", "/api/profile", dbProfileData);
          } else {
            // Re-throw other errors
            throw error;
          }
        }

        toast({
          title: "Profile saved!",
          description: "Let's find your perfect match",
        });

        // Check if we should return to a specific dog profile
        const returnToDog = sessionStorage.getItem('returnToDog');
        if (returnToDog) {
          sessionStorage.removeItem('returnToDog');
          console.log("[Onboarding] Profile saved, returning to dog profile:", returnToDog);
          setIsSubmitting(false);
          startTransition(() => {
            setLocation(`/dogs/${returnToDog}`);
          });
        } else {
          console.log("[Onboarding] Profile saved successfully, navigating to /discover");
          setIsSubmitting(false);
          startTransition(() => {
            setLocation("/discover");
          });
        }
      } catch (error: any) {
        console.error("[Onboarding] Failed to save profile:", error);
        toast({
          title: "Error saving profile",
          description: error.message || "Please try again",
          variant: "destructive",
        });
        setIsSubmitting(false);
      }
    };

    try {
      if (navigator.geolocation) {
        console.log("[Onboarding] Requesting geolocation with improved accuracy...");

        toast({
          title: "Getting your location...",
          description: "This helps us find dogs near you.",
        });

        // Set a timeout for geolocation (15 seconds for better accuracy)
        let locationReceived = false;
        const timeoutId = setTimeout(() => {
          if (!locationReceived) {
            console.log("[Onboarding] Geolocation timed out, using default");
            toast({
              title: "Using default location",
              description: "We'll use Austin, TX. Update it anytime in your profile.",
            });

            const profileWithDefaultLocation = {
              ...formData,
              latitude: 30.2672,
              longitude: -97.7431,
            };

            saveProfileAndNavigate(profileWithDefaultLocation);
          }
        }, 15000); // 15 second timeout for better accuracy

        navigator.geolocation.getCurrentPosition(
          (position) => {
            locationReceived = true;
            clearTimeout(timeoutId);
            console.log("[Onboarding] Geolocation success:", position.coords);
            console.log("[Onboarding] Accuracy:", position.coords.accuracy, "meters");

            const profileWithLocation = {
              ...formData,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };

            // Provide feedback on accuracy
            const accuracyMeters = Math.round(position.coords.accuracy);
            let accuracyFeedback = "";
            
            if (accuracyMeters < 50) {
              accuracyFeedback = "Excellent precision! 🎯";
            } else if (accuracyMeters < 100) {
              accuracyFeedback = "Good location accuracy ✓";
            } else if (accuracyMeters < 500) {
              accuracyFeedback = "Location found (±" + accuracyMeters + "m)";
            } else {
              accuracyFeedback = "Approximate location (±" + accuracyMeters + "m)";
            }

            toast({
              title: "Location found!",
              description: accuracyFeedback,
            });

            saveProfileAndNavigate(profileWithLocation);
          },
          (error) => {
            locationReceived = true;
            clearTimeout(timeoutId);

            let errorMessage = "We'll use a default location for now.";

            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = "Location access denied. Using Austin, TX as default.";
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = "Location unavailable. Using Austin, TX as default.";
                break;
              case error.TIMEOUT:
                errorMessage = "Location request timed out. Using Austin, TX as default.";
                break;
            }

            console.log("[Onboarding] Geolocation error:", error.message);

            toast({
              title: "Location access unavailable",
              description: errorMessage,
            });

            const profileWithDefaultLocation = {
              ...formData,
              latitude: 30.2672,
              longitude: -97.7431,
            };

            saveProfileAndNavigate(profileWithDefaultLocation);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000 // Allow cached position up to 30 seconds old
          }
        );
      } else {
        console.log("[Onboarding] Geolocation not available");
        toast({
          title: "Location not supported",
          description: "Using Austin, TX. Update it anytime in your profile.",
        });

        const profileWithDefaultLocation = {
          ...formData,
          latitude: 30.2672,
          longitude: -97.7431,
        };

        saveProfileAndNavigate(profileWithDefaultLocation);
      }
    } catch (error) {
      console.error("[Onboarding] Error:", error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false); // Reset flag on error
    }
  };

  // Step 0: Emotional Intent (only for unauthenticated users)
  if (step === 0 && !currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-6">
            <FormStepper 
              currentStep={1} 
              totalSteps={totalSteps}
            />
          </div>

          <Card className="border-2">
            <CardHeader>
              <FormSection
                title="What brings you to Scout today?"
                description="Choose the path that describes you best"
                icon={Heart}
                variant="ai"
                className="text-center"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <Card 
                className="border-2 hover-elevate active-elevate-2 transition-all cursor-pointer group"
                onClick={() => handleIntentSelect("adopter")}
                data-testid="card-intent-adopter"
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">I'm looking to adopt</h3>
                    <p className="text-sm text-muted-foreground">
                      Find a dog that truly fits your lifestyle
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>

              <Card 
                className="border-2 hover-elevate active-elevate-2 transition-all cursor-pointer group"
                onClick={() => handleIntentSelect("shelter")}
                data-testid="card-intent-shelter"
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-7 h-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">I'm a shelter organization</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage multiple dog listings
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Guard: If step is 0 and user is authenticated, show loading while redirect happens
  if (step === 0 && currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Steps 1-12: User Intent + Lifestyle Questions
  const questions = [
    // Step 1: User Intent (What brings you here?)
    {
      title: "What brings you to Scout today?",
      subtitle: "Choose the path that describes you best",
      icon: Heart,
      options: [
        { value: "adopter", label: "I'm looking to adopt 🏡", icon: Heart, description: "Find a dog that truly fits your lifestyle" },
        { value: "shelter", label: "I'm a shelter organization 🏢", icon: Building2, description: "Manage multiple dog listings" },
      ],
      field: "userIntent" as keyof OnboardingData,
      isIntentQuestion: true,
    },
    // Step 2: Living Situation
    {
      title: "Where do you live?",
      subtitle: "This helps us match you with the right size dog",
      icon: Home,
      options: [
        { value: "apartment", label: "Apartment", icon: Building2 },
        { value: "house_no_yard", label: "House (no yard)", icon: Home },
        { value: "house_small_yard", label: "House (small yard)", icon: TreeDeciduous },
        { value: "house_large_yard", label: "House (large yard)", icon: TreeDeciduous },
      ],
      field: "livingSituation" as keyof OnboardingData,
    },
    // Step 2: Other Pets
    {
      title: "Do you have other pets at home?",
      subtitle: "We'll find dogs that get along well with your current pets",
      icon: Dog,
      options: [
        { value: "none", label: "No other pets", icon: Heart },
        { value: "dogs", label: "Other dogs", icon: Dog },
        { value: "cats", label: "Cats", icon: Heart },
        { value: "both", label: "Both dogs and cats", icon: Dog },
      ],
      field: "otherPets" as keyof OnboardingData,
    },
    // Step 3: Activity Level
    {
      title: "How active are you on a typical day?",
      subtitle: "Match your energy with the perfect companion",
      icon: Dumbbell,
      options: [
        { value: "low", label: "Couch companion 🛋️", icon: Heart },
        { value: "moderate", label: "Weekend warrior 🚴‍♂️", icon: Dumbbell },
        { value: "high", label: "Daily adventurer 🏃‍♀️", icon: Zap },
      ],
      field: "activityLevel" as keyof OnboardingData,
    },
    // Step 4: Work Schedule
    {
      title: "How long are you away from home most days?",
      subtitle: "Helps us find a dog that fits your schedule",
      icon: Briefcase,
      options: [
        { value: "home_all_day", label: "Rarely 🏠", icon: Home },
        { value: "hybrid", label: "4-6 hours", icon: Briefcase },
        { value: "office_full_time", label: "8+ hours", icon: Building2 },
      ],
      field: "workSchedule" as keyof OnboardingData,
    },
    // Step 5: Exercise Commitment
    {
      title: "How often can you exercise a dog?",
      subtitle: "Be honest - it's important for the match!",
      icon: Dumbbell,
      options: [
        { value: "minimal", label: "Short daily walks", icon: Heart },
        { value: "few_times_week", label: "Active a few times per week", icon: Dumbbell },
        { value: "daily_vigorous", label: "Daily vigorous exercise", icon: Zap },
      ],
      field: "exerciseCommitment" as keyof OnboardingData,
    },
    // Step 6: Experience Level
    {
      title: "How experienced are you with dogs?",
      subtitle: "No judgment - honesty helps us find the right match",
      icon: Award,
      options: [
        { value: "first_time", label: "New to this ❤️", icon: Heart },
        { value: "some_experience", label: "Some experience", icon: Dog },
        { value: "very_experienced", label: "Experienced handler", icon: Award },
      ],
      field: "experienceLevel" as keyof OnboardingData,
    },
    // Step 7: Household Composition
    {
      title: "Who lives with you?",
      subtitle: "We'll find a dog that fits your household",
      icon: Home,
      options: [
        { value: "alone", label: "Just me", icon: Heart },
        { value: "adults", label: "Partner / roommate", icon: Home },
        { value: "kids_0_5", label: "Kids (0-5 years)", icon: Heart },
        { value: "kids_6_12", label: "Kids (6-12 years)", icon: Heart },
        { value: "kids_teen", label: "Teenagers", icon: Heart },
      ],
      field: "householdComposition" as keyof OnboardingData,
    },
    // Step 8-10: Multi-select preferences
    {
      title: "What size dog interests you?",
      subtitle: "Select all that apply - or skip if you're open to anything!",
      icon: Ruler,
      multiSelect: true,
      options: [
        { value: "small", label: "Small (under 25 lbs)", icon: Heart },
        { value: "medium", label: "Medium (25-60 lbs)", icon: Dog },
        { value: "large", label: "Large (over 60 lbs)", icon: Dog },
      ],
      field: "preferredSize" as keyof OnboardingData,
    },
    {
      title: "What age range do you prefer?",
      subtitle: "Each age has its charm!",
      icon: Calendar,
      multiSelect: true,
      options: [
        { value: "puppy", label: "Puppy (0-1 year)", icon: Heart },
        { value: "young", label: "Young (1-3 years)", icon: Dog },
        { value: "adult", label: "Adult (3-7 years)", icon: Dog },
        { value: "senior", label: "Senior (7+ years)", icon: Heart },
      ],
      field: "preferredAge" as keyof OnboardingData,
    },
    {
      title: "What energy level appeals to you?",
      subtitle: "Match the vibe you're looking for",
      icon: Zap,
      multiSelect: true,
      options: [
        { value: "low", label: "Calm & cuddly 💤", icon: Heart },
        { value: "medium", label: "Balanced energy", icon: Dog },
        { value: "high", label: "Playful & active 🎾", icon: Zap },
      ],
      field: "preferredEnergy" as keyof OnboardingData,
    },
    // Step 11: Search Radius (made multiSelect to show Continue button)
    {
      title: "How far are you willing to travel?",
      subtitle: "Set your search radius",
      icon: MapPin,
      multiSelect: "single", // Special flag for single-select with Continue button
      options: [
        { value: 10, label: "10 miles", icon: MapPin },
        { value: 25, label: "25 miles", icon: MapPin },
        { value: 50, label: "50 miles", icon: MapPin },
        { value: 100, label: "100 miles", icon: MapPin },
      ],
      field: "searchRadius" as keyof OnboardingData,
    },
  ];

  const currentQuestion = questions[step - 1];

  // Show loading state while checking authentication and profile
  // This prevents the onboarding UI from flashing before redirects happen
  if (isLoadingUser || (currentUser && isLoadingProfile)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
              <Heart className="w-6 h-6 text-primary" />
            </div>
          </div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Guard: If step is 0 and user is authenticated, wait for useEffect to redirect
  if (step === 0 && currentUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Guard: If currentQuestion is undefined (shouldn't happen but safeguard)
  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6">
          <FormStepper 
            currentStep={step} 
            totalSteps={totalSteps}
          />
        </div>

        <Card className="border-2">
          <CardHeader>
            <FormSection
              title={currentQuestion.title}
              description={currentQuestion.subtitle}
              icon={currentQuestion.icon}
              variant="ai"
              className="text-center"
            />
          </CardHeader>

          <CardContent className="space-y-3">
            {(currentQuestion as any).isIntentQuestion ? (
              // Special rendering for intent question with descriptions
              <>
                {currentQuestion.options.map((option: any) => (
                  <Card
                    key={String(option.value)}
                    className="border-2 hover-elevate active-elevate-2 transition-all cursor-pointer group"
                    onClick={() => handleSelect(currentQuestion.field, option.value)}
                    data-testid={`card-intent-${option.value}`}
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <option.icon className="w-7 h-7 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-1">{option.label}</h3>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : currentQuestion.multiSelect === "single" ? (
              // Special single-select for search radius (last step)
              <>
                {currentQuestion.options.map((option) => {
                  const isSelected = formData[currentQuestion.field] === option.value;
                  return (
                    <Card
                      key={String(option.value)}
                      className={`cursor-pointer transition-all border-2 ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-card-border hover-elevate"
                      }`}
                      onClick={() => setFormData({ ...formData, [currentQuestion.field]: option.value })}
                      data-testid={`option-${option.value}`}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isSelected ? "bg-primary/20" : "bg-card/50"
                        }`}>
                          {isSelected ? (
                            <Heart className="w-5 h-5 text-primary fill-primary" />
                          ) : (
                            <option.icon className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <span className={`text-lg ${isSelected ? "font-semibold text-foreground" : "text-foreground"}`}>
                          {option.label}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            ) : currentQuestion.multiSelect ? (
              <>
                {currentQuestion.options.map((option) => {
                  const isSelected = (formData[currentQuestion.field] as string[] || []).includes(option.value as string);
                  return (
                    <Card
                      key={option.value as string}
                      className={`cursor-pointer transition-all border-2 ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-card-border hover-elevate"
                      }`}
                      onClick={() => handleMultiSelect(currentQuestion.field, option.value as string)}
                      data-testid={`option-${option.value}`}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isSelected ? "bg-primary/20" : "bg-card/50"
                        }`}>
                          {isSelected ? (
                            <Heart className="w-5 h-5 text-primary fill-primary" />
                          ) : (
                            <option.icon className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <span className={`text-lg ${isSelected ? "font-semibold text-foreground" : "text-foreground"}`}>
                          {option.label}
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            ) : (
              currentQuestion.options.map((option) => (
                <Card
                  key={option.value as string}
                  className="cursor-pointer transition-all border-2 border-card-border hover-elevate active-elevate-2"
                  onClick={() => handleSelect(currentQuestion.field, option.value)}
                  data-testid={`option-${option.value}`}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <option.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-lg">{option.label}</span>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>

          <CardFooter className="flex justify-between gap-4">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                data-testid="button-back"
              >
                Back
              </Button>
            )}
            {(currentQuestion.multiSelect || currentQuestion.multiSelect === "single") && (
              <Button
                onClick={handleNext}
                className="ml-auto"
                data-testid="button-continue"
                disabled={
                  currentQuestion.multiSelect === "single" 
                    ? !formData[currentQuestion.field] 
                    : (step > 1 && !(formData[currentQuestion.field] as string[])?.length)
                }
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}