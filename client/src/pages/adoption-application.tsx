import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  Home,
  Phone,
  Users,
  PawPrint,
  CheckCircle2,
  Sparkles,
  ClipboardList,
  Building2,
  Loader2,
} from "lucide-react";
import { FormStepper, VisualCardSelector, FormSection, FormActions } from "@/components/form-templates";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DogWithCompatibility, UserProfile, ShelterApplicationForm, ShelterApplicationQuestion } from "@shared/schema";

interface ApplicationData {
  phoneNumber: string;
  homeType: string;
  hasYard: boolean;
  hasOtherPets: boolean;
  otherPetsDescription: string;
  householdMembers: string;
  workSchedule: string;
  experienceDescription: string;
  whyThisDog: string;
  customResponses?: Record<string, string | string[]>;
}

const BASE_STEPS = [
  { id: "contact", title: "Contact Info", icon: Phone },
  { id: "home", title: "Your Home", icon: Home },
  { id: "household", title: "Your Household", icon: Users },
  { id: "experience", title: "Experience", icon: PawPrint },
  { id: "why", title: "Why This Dog", icon: Heart },
];

export default function AdoptionApplication() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasShownDraftToast = useRef(false);

  // Load saved progress from localStorage (without triggering toast)
  const getSavedProgress = () => {
    try {
      const saved = localStorage.getItem(`adoption-draft-${params.id}`);
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch {
      return null;
    }
  };

  const savedData = getSavedProgress();
  const [formData, setFormData] = useState<ApplicationData>(
    savedData || {
      phoneNumber: "",
      homeType: "",
      hasYard: false,
      hasOtherPets: false,
      otherPetsDescription: "",
      householdMembers: "",
      workSchedule: "",
      experienceDescription: "",
      whyThisDog: "",
    }
  );

  // Show draft restored toast only once
  useEffect(() => {
    if (savedData && !hasShownDraftToast.current) {
      hasShownDraftToast.current = true;
      toast({
        title: "Draft Restored",
        description: "We've restored your previous answers. Continue where you left off!",
      });
    }
  }, []);

  // Auto-save progress
  useEffect(() => {
    if (Object.values(formData).some(val => val !== "" && val !== false)) {
      localStorage.setItem(`adoption-draft-${params.id}`, JSON.stringify(formData));
    }
  }, [formData, params.id]);

  const { data: dog, isLoading: isDogLoading } = useQuery<DogWithCompatibility>({
    queryKey: ["/api/dogs", params.id],
  });

  const { data: userProfile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  // Fetch shelter-specific questions if the dog belongs to a shelter
  const { data: shelterQuestions } = useQuery<{
    form: ShelterApplicationForm | null;
    questions: ShelterApplicationQuestion[];
  }>({
    queryKey: ["/api/shelters", dog?.userId, "application-questions"],
    queryFn: async () => {
      if (!dog?.userId) return { form: null, questions: [] };
      const res = await fetch(`/api/shelters/${dog.userId}/application-questions`);
      if (!res.ok) return { form: null, questions: [] };
      return res.json();
    },
    enabled: !!dog?.userId,
  });

  // Build steps dynamically based on whether shelter has custom questions
  const steps = useMemo(() => {
    const hasCustomQuestions = shelterQuestions?.questions && shelterQuestions.questions.length > 0;
    if (hasCustomQuestions) {
      const customStep = { id: "shelter", title: "Shelter Questions", icon: ClipboardList };
      return [...BASE_STEPS.slice(0, -1), customStep, BASE_STEPS[BASE_STEPS.length - 1]];
    }
    return BASE_STEPS;
  }, [shelterQuestions]);

  // Find the custom questions step index
  const customQuestionsStepIndex = steps.findIndex(s => s.id === "shelter");

  useEffect(() => {
    if (userProfile) {
      // Map experience level to description
      const experienceMap: Record<string, string> = {
        'first_time': "This will be my first dog",
        'some_experience': "I've had dogs before and know the basics",
        'very_experienced': "I'm very experienced with dogs and their care",
      };

      // Map work schedule to readable description
      const workScheduleMap: Record<string, string> = {
        'home_all_day': "I work from home or am home most of the day",
        'hybrid': "I have a hybrid schedule - home some days, office others",
        'office_full_time': "I work in an office full-time but am home by evening",
        'varies': "My schedule varies but I can arrange care when needed",
      };

      // Auto-generate household members description from profile data
      let householdDesc = "";
      if (userProfile.hasOtherPets) {
        householdDesc = "I have other pets";
      }

      setFormData(prev => ({
        ...prev,
        phoneNumber: userProfile.phoneNumber || prev.phoneNumber,
        homeType: userProfile.homeType || prev.homeType,
        hasYard: userProfile.hasYard ?? prev.hasYard,
        hasOtherPets: userProfile.hasOtherPets ?? prev.hasOtherPets,
        otherPetsDescription: userProfile.otherPetsType || prev.otherPetsDescription,
        householdMembers: householdDesc || prev.householdMembers,
        workSchedule: workScheduleMap[userProfile.workSchedule || ''] || prev.workSchedule,
        experienceDescription: experienceMap[userProfile.experienceLevel || ''] || prev.experienceDescription,
      }));
    }
  }, [userProfile]);

  const submitApplicationMutation = useMutation({
    mutationFn: async () => {
      if (userProfile) {
        await apiRequest("PATCH", "/api/profile", {
          phoneNumber: formData.phoneNumber,
          homeType: formData.homeType,
          hasYard: formData.hasYard,
        });
      }

      const response = await apiRequest("POST", "/api/adoption-journeys", {
        dogId: params.id,
        applicationData: formData,
      });
      return response.json();
    },
    onSuccess: () => {
      // Clear the saved draft
      localStorage.removeItem(`adoption-draft-${params.id}`);
      
      toast({
        title: "Application Submitted!",
        description: `Your adoption application for ${dog?.name} has been submitted successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/adoption-journeys", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setLocation(`/dogs/${params.id}`);
    },
    onError: (error) => {
      console.error("Error submitting application:", error);
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  // Check if shelter-specific required questions are answered (for final submission validation)
  const areRequiredCustomQuestionsAnswered = () => {
    // Only check if there are shelter questions
    if (!shelterQuestions?.questions || shelterQuestions.questions.length === 0) {
      return true;
    }
    
    const requiredQuestions = shelterQuestions.questions.filter(q => q.isRequired);
    return requiredQuestions.every(q => {
      const response = formData.customResponses?.[q.id];
      if (Array.isArray(response)) return response.length > 0;
      return response && String(response).trim() !== "";
    });
  };

  const handleNext = () => {
    // Verify canProceed before advancing (safety check)
    if (!canProceed()) {
      toast({
        title: "Please complete this step",
        description: "Fill in all required fields before continuing.",
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final submission - verify required custom questions are answered
      if (!areRequiredCustomQuestionsAnswered()) {
        toast({
          title: "Application Incomplete",
          description: "Please complete all required shelter questions before submitting.",
          variant: "destructive",
        });
        return;
      }
      setIsSubmitting(true);
      submitApplicationMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation(`/dogs/${params.id}`);
    }
  };

  const handleSaveDraft = () => {
    toast({
      title: "Draft Saved",
      description: "You can continue this application anytime from the dog's profile.",
    });
    setLocation(`/dogs/${params.id}`);
  };

  const updateFormData = (key: keyof ApplicationData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const updateCustomResponse = (questionId: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      customResponses: {
        ...prev.customResponses,
        [questionId]: value,
      },
    }));
  };

  const canProceed = () => {
    const currentStepId = steps[currentStep]?.id;
    switch (currentStepId) {
      case "contact":
        return formData.phoneNumber.length >= 10;
      case "home":
        return formData.homeType !== "";
      case "household":
        return formData.householdMembers !== "";
      case "experience":
        return true;
      case "shelter":
        // Check that all required custom questions are answered
        const requiredQuestions = shelterQuestions?.questions.filter(q => q.isRequired) || [];
        return requiredQuestions.every(q => {
          const response = formData.customResponses?.[q.id];
          if (Array.isArray(response)) return response.length > 0;
          return response && response.trim() !== "";
        });
      case "why":
        return formData.whyThisDog.length >= 10;
      default:
        return true;
    }
  };

  if (isDogLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-6 pt-8">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!dog) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Dog not found</h2>
          <Button onClick={() => setLocation("/discover")} data-testid="button-back-discover">
            Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="shrink-0"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="font-semibold text-lg">Apply for {dog.name}</h1>
            </div>
            <div className="w-10" />
          </div>
          <FormStepper 
            currentStep={currentStep + 1} 
            totalSteps={steps.length}
            stepLabels={steps.map(s => s.title)}
          />
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <div
                key={step.id}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground scale-110"
                    : isCompleted
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
            );
          })}
        </div>

        <Card className="rounded-2xl shadow-lg border-0 bg-card">
          <CardContent className="p-6">
            {steps[currentStep]?.id === "contact" && (
              <div className="space-y-6">
                <FormSection
                  title="How can we reach you?"
                  description={`We'll use this to coordinate your meet & greet with ${dog.name}`}
                  icon={Phone}
                  variant="ai"
                />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="phone">Phone Number *</Label>
                    {userProfile?.phoneNumber && formData.phoneNumber === userProfile.phoneNumber && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        From your profile
                      </span>
                    )}
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.phoneNumber}
                    onChange={(e) => updateFormData("phoneNumber", e.target.value)}
                    data-testid="input-phone"
                  />
                </div>
              </div>
            )}

            {steps[currentStep]?.id === "home" && (
              <div className="space-y-6">
                <FormSection
                  title="Tell us about your home"
                  description={`This helps us ensure ${dog.name} will be comfortable`}
                  icon={Home}
                  variant="ai"
                >
                  {userProfile?.homeType && formData.homeType === userProfile.homeType && (
                    <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Auto-filled from your profile
                    </div>
                  )}
                </FormSection>
                <VisualCardSelector
                  options={[
                    { value: "house", label: "House", icon: Home, description: "Single family home" },
                    { value: "apartment", label: "Apartment", icon: Building2, description: "Apartment building" },
                    { value: "condo", label: "Condo", icon: Building2, description: "Condominium" },
                    { value: "townhouse", label: "Townhouse", icon: Home, description: "Row or townhouse" },
                  ]}
                  value={formData.homeType}
                  onChange={(value) => updateFormData("homeType", value)}
                  columns={2}
                  testIdPrefix="home-type"
                />
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => updateFormData("hasYard", !formData.hasYard)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all hover-elevate ${
                      formData.hasYard 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid="button-has-yard"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`w-5 h-5 ${formData.hasYard ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`font-medium ${formData.hasYard ? "text-primary" : ""}`}>
                        {formData.hasYard ? "I have a yard" : "I have a yard"}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {steps[currentStep]?.id === "household" && (
              <div className="space-y-6">
                <FormSection
                  title="Who lives with you?"
                  description={`${dog.name} will want to meet everyone!`}
                  icon={Users}
                  variant="ai"
                />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="household">Household members</Label>
                    <Input
                      id="household"
                      placeholder="e.g., 2 adults, 1 child (age 8)"
                      value={formData.householdMembers}
                      onChange={(e) => updateFormData("householdMembers", e.target.value)}
                      className="text-lg py-6"
                      data-testid="input-household"
                    />
                  </div>
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant={formData.hasOtherPets ? "default" : "outline"}
                      className="w-full h-14"
                      onClick={() => updateFormData("hasOtherPets", !formData.hasOtherPets)}
                      data-testid="button-has-pets"
                    >
                      {formData.hasOtherPets ? "✓ I have other pets" : "I have other pets"}
                    </Button>
                  </div>
                  {formData.hasOtherPets && (
                    <div className="space-y-2">
                      <Label htmlFor="otherPets">Tell us about your pets</Label>
                      <Textarea
                        id="otherPets"
                        placeholder="e.g., 1 cat (3 years old), very friendly"
                        value={formData.otherPetsDescription}
                        onChange={(e) => updateFormData("otherPetsDescription", e.target.value)}
                        className="min-h-[80px]"
                        data-testid="input-other-pets"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {steps[currentStep]?.id === "experience" && (
              <div className="space-y-6">
                <FormSection
                  title="Your pet experience"
                  description="Tell us about your experience with dogs"
                  icon={PawPrint}
                  variant="ai"
                >
                  {(userProfile?.workSchedule || userProfile?.experienceLevel) && (
                    <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Some answers pre-filled from your profile
                    </div>
                  )}
                </FormSection>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workSchedule">What's your typical day like?</Label>
                    <Textarea
                      id="workSchedule"
                      placeholder="e.g., I work from home, or I'm home by 5pm each day"
                      value={formData.workSchedule}
                      onChange={(e) => updateFormData("workSchedule", e.target.value)}
                      className="min-h-[80px]"
                      data-testid="input-schedule"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience">Previous pet experience (optional)</Label>
                    <Textarea
                      id="experience"
                      placeholder="e.g., I grew up with dogs, or this will be my first dog"
                      value={formData.experienceDescription}
                      onChange={(e) => updateFormData("experienceDescription", e.target.value)}
                      className="min-h-[80px]"
                      data-testid="input-experience"
                    />
                  </div>
                </div>
              </div>
            )}

            {steps[currentStep]?.id === "shelter" && shelterQuestions?.questions && (
              <div className="space-y-6">
                <FormSection
                  title="Additional Questions"
                  description="A few more questions from the shelter"
                  icon={ClipboardList}
                  variant="ai"
                />
                <div className="space-y-6">
                  {shelterQuestions.questions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <Label htmlFor={question.id}>
                        {question.questionText}
                        {question.isRequired && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {question.helperText && (
                        <p className="text-xs text-muted-foreground">{question.helperText}</p>
                      )}
                      
                      {question.questionType === "text" && (
                        <Input
                          id={question.id}
                          value={(formData.customResponses?.[question.id] as string) || ""}
                          onChange={(e) => updateCustomResponse(question.id, e.target.value)}
                          data-testid={`input-custom-${question.id}`}
                        />
                      )}
                      
                      {question.questionType === "textarea" && (
                        <Textarea
                          id={question.id}
                          value={(formData.customResponses?.[question.id] as string) || ""}
                          onChange={(e) => updateCustomResponse(question.id, e.target.value)}
                          className="min-h-[80px]"
                          data-testid={`input-custom-${question.id}`}
                        />
                      )}
                      
                      {question.questionType === "yes_no" && (
                        <RadioGroup
                          value={(formData.customResponses?.[question.id] as string) || ""}
                          onValueChange={(value) => updateCustomResponse(question.id, value)}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id={`${question.id}-yes`} />
                            <Label htmlFor={`${question.id}-yes`}>Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id={`${question.id}-no`} />
                            <Label htmlFor={`${question.id}-no`}>No</Label>
                          </div>
                        </RadioGroup>
                      )}
                      
                      {question.questionType === "select" && question.options && (
                        <Select
                          value={(formData.customResponses?.[question.id] as string) || ""}
                          onValueChange={(value) => updateCustomResponse(question.id, value)}
                        >
                          <SelectTrigger data-testid={`select-custom-${question.id}`}>
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      
                      {question.questionType === "multiselect" && question.options && (
                        <div className="space-y-2">
                          {question.options.map((option) => {
                            const currentValues = (formData.customResponses?.[question.id] as string[]) || [];
                            const isChecked = currentValues.includes(option);
                            return (
                              <div key={option} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${question.id}-${option}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      updateCustomResponse(question.id, [...currentValues, option]);
                                    } else {
                                      updateCustomResponse(question.id, currentValues.filter(v => v !== option));
                                    }
                                  }}
                                />
                                <Label htmlFor={`${question.id}-${option}`}>{option}</Label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {steps[currentStep]?.id === "why" && (
              <div className="space-y-6">
                <FormSection
                  title={`Why ${dog.name}?`}
                  description="Share what drew you to this special pup"
                  icon={Heart}
                  variant="ai"
                />
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl mb-4">
                  <img
                    src={dog.photos[0]}
                    alt={dog.name}
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-lg">{dog.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {dog.breed} • {dog.age}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="why">Why do you want to adopt {dog.name}?</Label>
                  <Textarea
                    id="why"
                    placeholder={`Share what makes you excited about bringing ${dog.name} home...`}
                    value={formData.whyThisDog}
                    onChange={(e) => updateFormData("whyThisDog", e.target.value)}
                    className="min-h-[120px]"
                    data-testid="input-why"
                  />
                  <p className={`text-xs ${formData.whyThisDog.length >= 10 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {formData.whyThisDog.length >= 10 ? '✓ Ready to submit' : `At least 10 characters (${formData.whyThisDog.length}/10)`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 space-y-3">
          <Button
            size="lg"
            className="w-full py-6 text-lg"
            onClick={handleNext}
            disabled={!canProceed() || isSubmitting}
            data-testid="button-continue"
          >
            {isSubmitting ? (
              <>
                <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : currentStep === steps.length - 1 ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Submit Application
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
          {currentStep < steps.length - 1 && (
            <Button
              size="lg"
              variant="outline"
              className="w-full py-6"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              Save Draft & Continue Later
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
