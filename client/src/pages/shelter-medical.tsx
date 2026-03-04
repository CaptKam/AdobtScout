import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow, addDays, isPast, isBefore } from "date-fns";
import { 
  Syringe, 
  Stethoscope, 
  Pill, 
  FileText, 
  Plus, 
  Calendar,
  AlertTriangle,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Dog as DogIcon,
  Scissors,
  Scale,
  Activity,
  Camera,
  Brain,
  Loader2,
  Heart,
  X,
  Upload,
  Scan,
  Sparkles,
  PawPrint,
  ClipboardList,
  ArrowRight,
  Building2,
  Phone,
  User,
  ExternalLink,
  ListTodo,
  Check,
  Eye
} from "lucide-react";
import { useFeatureFlags, useFeatureFlag } from "@/hooks/use-feature-flags";
import { HealthScreeningScanner } from "@/components/health-screening-scanner";
import type { Dog as DogType, MedicalRecord, MedicalTemplate, TreatmentPlan, TreatmentEntry, VetReferral } from "@shared/schema";
import type { ScanResult } from "@/hooks/use-animal-scanner";

type RecordType = "vaccine" | "treatment" | "exam" | "surgery" | "medication" | "weight_check" | "other";

const RECORD_TYPE_CONFIG: Record<RecordType, { label: string; icon: typeof Syringe; color: string }> = {
  vaccine: { label: "Vaccine", icon: Syringe, color: "bg-blue-500" },
  treatment: { label: "Treatment", icon: Activity, color: "bg-purple-500" },
  exam: { label: "Exam", icon: Stethoscope, color: "bg-green-500" },
  surgery: { label: "Surgery", icon: Scissors, color: "bg-red-500" },
  medication: { label: "Medication", icon: Pill, color: "bg-orange-500" },
  weight_check: { label: "Weight Check", icon: Scale, color: "bg-teal-500" },
  other: { label: "Other", icon: FileText, color: "bg-gray-500" },
};

const VACCINE_NAMES = [
  { value: "rabies", label: "Rabies" },
  { value: "dhpp", label: "DHPP (Distemper, Hepatitis, Parvo, Parainfluenza)" },
  { value: "bordetella", label: "Bordetella (Kennel Cough)" },
  { value: "leptospirosis", label: "Leptospirosis" },
  { value: "canine_influenza", label: "Canine Influenza" },
  { value: "lyme", label: "Lyme Disease" },
];

type HealthScreeningResult = {
  id: string;
  severity: "low" | "moderate" | "high" | "critical";
  recommendation: "home_care" | "monitor" | "vet_visit" | "emergency";
  conditions: string[];
  analysis: string;
  careInstructions?: string;
  disclaimer: string;
};

const PRIORITY_CONFIG = {
  low: { label: "Low", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const URGENCY_CONFIG = {
  routine: { label: "Routine", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  soon: { label: "Soon", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  urgent: { label: "Urgent", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  emergency: { label: "Emergency", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  active: { label: "Active", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  scheduled: { label: "Scheduled", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  on_hold: { label: "On Hold", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  no_show: { label: "No Show", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
};

export default function ShelterMedical() {
  const { toast } = useToast();
  const { data: featureFlags } = useFeatureFlags();
  const { isEnabled: healthScreeningEnabled } = useFeatureFlag('AI_HEALTH_SCREENING');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDog, setSelectedDog] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isHealthScreeningOpen, setIsHealthScreeningOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(healthScreeningEnabled ? "triage" : "treatments");
  const [triageSeverityFilter, setTriageSeverityFilter] = useState<string>("all");

  // Switch away from triage tab if health screening is disabled
  useEffect(() => {
    if (!healthScreeningEnabled && activeTab === "triage") {
      setActiveTab("treatments");
    }
  }, [healthScreeningEnabled]);
  
  const [healthScreeningDog, setHealthScreeningDog] = useState<string>("");
  const [healthScreeningSymptoms, setHealthScreeningSymptoms] = useState("");
  const [healthScreeningImages, setHealthScreeningImages] = useState<string[]>([]);
  const [healthScreeningType, setHealthScreeningType] = useState<"symptom_check" | "image_analysis" | "full_assessment">("symptom_check");
  const [healthScreeningResult, setHealthScreeningResult] = useState<HealthScreeningResult | null>(null);
  const [petScanResult, setPetScanResult] = useState<ScanResult | null>(null);
  const [isHealthScannerOpen, setIsHealthScannerOpen] = useState(false);

  const [isCreateTreatmentOpen, setIsCreateTreatmentOpen] = useState(false);
  const [isCreateReferralOpen, setIsCreateReferralOpen] = useState(false);
  const [selectedScreeningForAction, setSelectedScreeningForAction] = useState<any>(null);
  
  const [newRecord, setNewRecord] = useState({
    dogId: "",
    recordType: "vaccine" as RecordType,
    title: "",
    description: "",
    veterinarian: "",
    vaccineName: "",
    vaccineManufacturer: "",
    vaccineLotNumber: "",
    nextDueDate: "",
    medicationName: "",
    dosage: "",
    frequency: "",
    weight: "",
    temperature: "",
    cost: "",
  });

  const [newTreatmentPlan, setNewTreatmentPlan] = useState({
    dogId: "",
    title: "",
    description: "",
    condition: "",
    goal: "",
    priority: "normal",
    targetEndDate: "",
  });

  const [newVetReferral, setNewVetReferral] = useState({
    dogId: "",
    reason: "",
    urgency: "routine",
    symptoms: "",
    vetClinicName: "",
    vetName: "",
    vetPhone: "",
    appointmentDate: "",
    appointmentNotes: "",
  });

  const { data: dogs, isLoading: dogsLoading } = useQuery<DogType[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const { data: medicalRecords, isLoading: recordsLoading } = useQuery<MedicalRecord[]>({
    queryKey: ["/api/shelter/medical"],
  });

  const { data: upcomingVaccines, isLoading: vaccinesLoading } = useQuery<any[]>({
    queryKey: ["/api/shelter/medical/vaccines/upcoming"],
  });

  const { data: templates, isLoading: templatesLoading } = useQuery<MedicalTemplate[]>({
    queryKey: ["/api/shelter/medical-templates"],
  });

  const { data: healthScreenings, isLoading: healthScreeningsLoading } = useQuery<any[]>({
    queryKey: ["/api/shelter/health-screenings"],
  });

  const { data: treatmentPlans, isLoading: treatmentPlansLoading } = useQuery<TreatmentPlan[]>({
    queryKey: ["/api/shelter/treatment-plans"],
  });

  const { data: vetReferrals, isLoading: vetReferralsLoading } = useQuery<VetReferral[]>({
    queryKey: ["/api/shelter/vet-referrals"],
  });

  const createRecordMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/shelter/medical", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/medical"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/medical/vaccines/upcoming"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "Medical record created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create record", description: error.message, variant: "destructive" });
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async ({ templateId, dogId }: { templateId: string; dogId: string }) => {
      return apiRequest("POST", `/api/shelter/medical-templates/${templateId}/apply`, { dogId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/medical"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/medical/vaccines/upcoming"] });
      setIsTemplateDialogOpen(false);
      toast({ title: "Template applied successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to apply template", description: error.message, variant: "destructive" });
    },
  });

  const healthScreeningMutation = useMutation({
    mutationFn: async (data: { 
      dogId?: string; 
      symptoms?: string; 
      images?: string[]; 
      screeningType: string;
      petIdentification?: {
        breed: string;
        breedConfidence: string;
        size: string;
        ageCategory: string;
        coatColor: string;
        estimatedWeight: string;
      };
    }): Promise<HealthScreeningResult> => {
      try {
        const response = await apiRequest("POST", "/api/shelter/health-screening", data);
        const result = await response.json();
        console.log("[Health Screening] API Response:", result);
        return result;
      } catch (error: any) {
        console.error("[Health Screening] Mutation error:", error);
        throw error;
      }
    },
    onSuccess: (result: HealthScreeningResult) => {
      console.log("[Health Screening] Setting result state:", result);
      setHealthScreeningResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/health-screenings"] });
      
      const isConcerning = ['moderate', 'high', 'critical'].includes(result.severity);
      toast({ 
        title: isConcerning ? "Health Alert" : "Health Screening Complete", 
        description: `Severity: ${(result.severity || 'unknown').toUpperCase()} - ${(result.recommendation || 'unknown').replace("_", " ").toUpperCase()}`,
        variant: isConcerning ? "destructive" : "default"
      });
    },
    onError: (error: any) => {
      console.error("[Health Screening] Mutation error callback:", error);
      toast({ 
        title: "Health screening failed", 
        description: error instanceof Error ? error.message : "An unknown error occurred", 
        variant: "destructive" 
      });
    },
  });

  const createTreatmentPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/shelter/treatment-plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/treatment-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/health-screenings"] });
      setIsCreateTreatmentOpen(false);
      setSelectedScreeningForAction(null);
      resetTreatmentForm();
      toast({ title: "Treatment plan created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create treatment plan", description: error.message, variant: "destructive" });
    },
  });

  const createVetReferralMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/shelter/vet-referrals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/vet-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/health-screenings"] });
      setIsCreateReferralOpen(false);
      setSelectedScreeningForAction(null);
      resetReferralForm();
      toast({ title: "Vet referral created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create referral", description: error.message, variant: "destructive" });
    },
  });

  const markScreeningReviewedMutation = useMutation({
    mutationFn: async ({ screeningId, notes }: { screeningId: string; notes?: string }) => {
      return apiRequest("POST", `/api/shelter/health-screenings/${screeningId}/review`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/health-screenings"] });
      toast({ title: "Screening marked as reviewed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update screening", description: error.message, variant: "destructive" });
    },
  });

  const handleHealthScreeningSubmit = () => {
    if (healthScreeningType === "symptom_check" && !healthScreeningSymptoms.trim()) {
      toast({ title: "Please describe the symptoms", variant: "destructive" });
      return;
    }
    if (healthScreeningType === "image_analysis" && healthScreeningImages.length === 0) {
      toast({ title: "Please upload at least one image", variant: "destructive" });
      return;
    }
    if (healthScreeningType === "full_assessment" && !healthScreeningSymptoms.trim() && healthScreeningImages.length === 0) {
      toast({ title: "Please provide symptoms and/or images", variant: "destructive" });
      return;
    }

    healthScreeningMutation.mutate({
      dogId: healthScreeningDog || undefined,
      symptoms: healthScreeningSymptoms || undefined,
      images: healthScreeningImages.length > 0 ? healthScreeningImages : undefined,
      screeningType: healthScreeningType,
      petIdentification: petScanResult ? {
        breed: petScanResult.breed,
        breedConfidence: petScanResult.breedConfidence,
        size: petScanResult.size,
        ageCategory: petScanResult.ageCategory,
        coatColor: petScanResult.coatColor,
        estimatedWeight: petScanResult.estimatedWeight,
      } : undefined,
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setHealthScreeningImages((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setHealthScreeningImages((prev) => prev.filter((_, i) => i !== index));
  };

  const resetHealthScreening = () => {
    setHealthScreeningDog("");
    setHealthScreeningSymptoms("");
    setHealthScreeningImages([]);
    setHealthScreeningType("symptom_check");
    setHealthScreeningResult(null);
    setPetScanResult(null);
  };

  const resetTreatmentForm = () => {
    setNewTreatmentPlan({
      dogId: "",
      title: "",
      description: "",
      condition: "",
      goal: "",
      priority: "normal",
      targetEndDate: "",
    });
  };

  const resetReferralForm = () => {
    setNewVetReferral({
      dogId: "",
      reason: "",
      urgency: "routine",
      symptoms: "",
      vetClinicName: "",
      vetName: "",
      vetPhone: "",
      appointmentDate: "",
      appointmentNotes: "",
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "moderate": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "critical": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getRecommendationInfo = (recommendation: string) => {
    switch (recommendation) {
      case "home_care": return { label: "Home Care", color: "text-green-600", icon: Heart };
      case "monitor": return { label: "Monitor Closely", color: "text-yellow-600", icon: Clock };
      case "vet_visit": return { label: "Schedule Vet Visit", color: "text-orange-600", icon: Calendar };
      case "emergency": return { label: "Emergency - Seek Immediate Care", color: "text-red-600", icon: AlertTriangle };
      default: return { label: recommendation, color: "text-gray-600", icon: Stethoscope };
    }
  };

  const resetForm = () => {
    setNewRecord({
      dogId: "",
      recordType: "vaccine",
      title: "",
      description: "",
      veterinarian: "",
      vaccineName: "",
      vaccineManufacturer: "",
      vaccineLotNumber: "",
      nextDueDate: "",
      medicationName: "",
      dosage: "",
      frequency: "",
      weight: "",
      temperature: "",
      cost: "",
    });
  };

  const handleSubmitRecord = () => {
    if (!newRecord.dogId || !newRecord.title) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const data: any = {
      dogId: newRecord.dogId,
      recordType: newRecord.recordType,
      title: newRecord.title,
      description: newRecord.description || undefined,
      veterinarian: newRecord.veterinarian || undefined,
      cost: newRecord.cost ? parseFloat(newRecord.cost) : undefined,
    };

    if (newRecord.recordType === "vaccine") {
      data.vaccineName = newRecord.vaccineName || undefined;
      data.vaccineManufacturer = newRecord.vaccineManufacturer || undefined;
      data.vaccineLotNumber = newRecord.vaccineLotNumber || undefined;
      data.nextDueDate = newRecord.nextDueDate ? new Date(newRecord.nextDueDate).toISOString() : undefined;
    }

    if (newRecord.recordType === "medication") {
      data.medicationName = newRecord.medicationName || undefined;
      data.dosage = newRecord.dosage || undefined;
      data.frequency = newRecord.frequency || undefined;
    }

    if (newRecord.recordType === "exam" || newRecord.recordType === "weight_check") {
      data.weight = newRecord.weight ? parseInt(newRecord.weight) : undefined;
      data.temperature = newRecord.temperature ? parseFloat(newRecord.temperature) : undefined;
    }

    createRecordMutation.mutate(data);
  };

  const handleCreateTreatmentPlan = () => {
    if (!newTreatmentPlan.dogId || !newTreatmentPlan.title) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const data: any = {
      dogId: newTreatmentPlan.dogId,
      title: newTreatmentPlan.title,
      description: newTreatmentPlan.description || undefined,
      condition: newTreatmentPlan.condition || undefined,
      goal: newTreatmentPlan.goal || undefined,
      priority: newTreatmentPlan.priority,
      targetEndDate: newTreatmentPlan.targetEndDate ? new Date(newTreatmentPlan.targetEndDate).toISOString() : undefined,
      healthScreeningId: selectedScreeningForAction?.id || undefined,
    };

    createTreatmentPlanMutation.mutate(data);
  };

  const handleCreateVetReferral = () => {
    if (!newVetReferral.dogId || !newVetReferral.reason) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const data: any = {
      dogId: newVetReferral.dogId,
      reason: newVetReferral.reason,
      urgency: newVetReferral.urgency,
      symptoms: newVetReferral.symptoms || undefined,
      vetClinicName: newVetReferral.vetClinicName || undefined,
      vetName: newVetReferral.vetName || undefined,
      vetPhone: newVetReferral.vetPhone || undefined,
      appointmentDate: newVetReferral.appointmentDate ? new Date(newVetReferral.appointmentDate).toISOString() : undefined,
      appointmentNotes: newVetReferral.appointmentNotes || undefined,
      healthScreeningId: selectedScreeningForAction?.id || undefined,
      aiAnalysisSummary: selectedScreeningForAction?.aiAnalysis || undefined,
    };

    createVetReferralMutation.mutate(data);
  };

  const filteredRecords = medicalRecords?.filter((record) => {
    const matchesSearch = searchTerm === "" || 
      record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDog = !selectedDog || record.dogId === selectedDog;
    return matchesSearch && matchesDog;
  }) || [];

  const getDogName = (dogId: string) => {
    const dog = dogs?.find(d => d.id === dogId);
    return dog?.name || "Unknown Dog";
  };

  const overdueVaccines = upcomingVaccines?.filter(v => v.nextDueDate && isPast(new Date(v.nextDueDate))) || [];
  const dueSoonVaccines = upcomingVaccines?.filter(v => {
    if (!v.nextDueDate) return false;
    const dueDate = new Date(v.nextDueDate);
    return !isPast(dueDate) && isBefore(dueDate, addDays(new Date(), 14));
  }) || [];

  const aiIntakeAlerts = medicalRecords?.filter((record) => 
    record.source === 'ai_intake_screening' && record.status === 'pending'
  ) || [];

  const unreviewedScreenings = healthScreenings?.filter(s => !s.isReviewed) || [];
  const filteredTriageItems = unreviewedScreenings.filter(s => 
    triageSeverityFilter === "all" || s.severity === triageSeverityFilter
  );

  const activeTreatmentPlans = treatmentPlans?.filter(p => p.status === 'active') || [];
  const pendingReferrals = vetReferrals?.filter(r => ['pending', 'scheduled'].includes(r.status)) || [];

  if (dogsLoading || recordsLoading) {
    return (
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Medical Center</h1>
            <p className="text-sm md:text-base text-muted-foreground">Triage, treatments, and veterinary care management</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {featureFlags?.enabledFeatures?.includes('ai_health_screening') && (
              <Dialog open={isHealthScreeningOpen} onOpenChange={(open) => {
                setIsHealthScreeningOpen(open);
                if (!open) resetHealthScreening();
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-ai-health-screening">
                    <Brain className="h-4 w-4 mr-2" />
                    AI Health Check
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-500" />
                      AI Health Screening
                    </DialogTitle>
                  </DialogHeader>
                  
                  {!healthScreeningResult ? (
                    <div className="space-y-4 py-4">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            This AI tool provides preliminary health assessments only. Always consult a licensed veterinarian for diagnosis and treatment.
                          </p>
                        </div>
                      </div>

                      {featureFlags?.enabledFeatures?.includes('ai_breed_identification') && (
                        <div className="space-y-3 border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Scan className="h-5 w-5 text-purple-500" />
                              <Label className="text-base font-medium">AI Pet Scanner</Label>
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Optional
                              </Badge>
                            </div>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            Use live camera or upload a photo to auto-identify breed, size, age, and temperament
                          </p>
                          
                          {petScanResult ? (
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                              <div className="flex items-start gap-3">
                                {petScanResult.imageBase64 && (
                                  <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-green-300 shrink-0">
                                    <img 
                                      src={petScanResult.imageBase64} 
                                      alt="Scanned pet" 
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    <span className="font-semibold">{petScanResult.breed}</span>
                                    <Badge 
                                      variant="secondary" 
                                      className={
                                        petScanResult.breedConfidence === 'high' 
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                          : petScanResult.breedConfidence === 'medium'
                                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                                      }
                                    >
                                      {petScanResult.breedConfidence}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                                    <span>{petScanResult.ageCategory}</span>
                                    <span className="text-muted-foreground/50">•</span>
                                    <span>{petScanResult.size}</span>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setPetScanResult(null)}
                                  className="h-8 w-8"
                                  data-testid="button-clear-pet-scan"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsHealthScannerOpen(true)}
                              className="w-full gap-2"
                              data-testid="button-open-health-scanner"
                            >
                              <Camera className="w-4 h-4" />
                              <span>AI Health Scan</span>
                              <Badge variant="secondary" className="ml-1 text-xs bg-primary/10 text-primary">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Camera
                              </Badge>
                            </Button>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Pet (Optional)</Label>
                        <Select value={healthScreeningDog} onValueChange={setHealthScreeningDog}>
                          <SelectTrigger data-testid="select-health-screening-dog">
                            <SelectValue placeholder="Select a pet for context" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No specific pet</SelectItem>
                            {dogs?.map((dog) => (
                              <SelectItem key={dog.id} value={dog.id}>{dog.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Screening Type</Label>
                        <Select value={healthScreeningType} onValueChange={(v) => setHealthScreeningType(v as typeof healthScreeningType)}>
                          <SelectTrigger data-testid="select-screening-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="symptom_check">Symptom Check</SelectItem>
                            <SelectItem value="image_analysis">Image Analysis</SelectItem>
                            <SelectItem value="full_assessment">Full Assessment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(healthScreeningType === "symptom_check" || healthScreeningType === "full_assessment") && (
                        <div className="space-y-2">
                          <Label>Describe Symptoms</Label>
                          <Textarea
                            value={healthScreeningSymptoms}
                            onChange={(e) => setHealthScreeningSymptoms(e.target.value)}
                            placeholder="Describe the symptoms you've observed..."
                            className="min-h-24"
                            data-testid="textarea-symptoms"
                          />
                        </div>
                      )}

                      {(healthScreeningType === "image_analysis" || healthScreeningType === "full_assessment") && (
                        <div className="space-y-2">
                          <Label>Upload Images</Label>
                          <div className="flex flex-wrap gap-2">
                            {healthScreeningImages.map((img, i) => (
                              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-1 right-1 h-6 w-6"
                                  onClick={() => removeImage(i)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <label className="w-20 h-20 flex items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover-elevate">
                              <Upload className="h-6 w-6 text-muted-foreground" />
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={handleImageUpload}
                                data-testid="input-upload-images"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={handleHealthScreeningSubmit}
                        disabled={healthScreeningMutation.isPending}
                        className="w-full"
                        data-testid="button-run-screening"
                      >
                        {healthScreeningMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Brain className="h-4 w-4 mr-2" />
                            Run AI Screening
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 py-4">
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(healthScreeningResult.severity)}>
                          {healthScreeningResult.severity.toUpperCase()}
                        </Badge>
                        {(() => {
                          const recInfo = getRecommendationInfo(healthScreeningResult.recommendation);
                          const RecIcon = recInfo.icon;
                          return (
                            <span className={`flex items-center gap-1 text-sm ${recInfo.color}`}>
                              <RecIcon className="h-4 w-4" />
                              {recInfo.label}
                            </span>
                          );
                        })()}
                      </div>

                      <div className="space-y-2">
                        <Label>Analysis</Label>
                        <p className="text-sm">{healthScreeningResult.analysis}</p>
                      </div>

                      {healthScreeningResult.conditions?.length > 0 && (
                        <div className="space-y-2">
                          <Label>Possible Conditions</Label>
                          <div className="flex flex-wrap gap-2">
                            {healthScreeningResult.conditions.map((c, i) => (
                              <Badge key={i} variant="outline">{c}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {healthScreeningResult.careInstructions && (
                        <div className="space-y-2">
                          <Label>Care Instructions</Label>
                          <p className="text-sm">{healthScreeningResult.careInstructions}</p>
                        </div>
                      )}

                      <div className="bg-muted/50 rounded-md p-3">
                        <p className="text-xs text-muted-foreground">{healthScreeningResult.disclaimer}</p>
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => {
                          resetHealthScreening();
                        }}
                        className="w-full"
                      >
                        New Screening
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-record">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Medical Record</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Pet *</Label>
                    <Select value={newRecord.dogId} onValueChange={(v) => setNewRecord({ ...newRecord, dogId: v })}>
                      <SelectTrigger data-testid="select-record-dog">
                        <SelectValue placeholder="Select a pet" />
                      </SelectTrigger>
                      <SelectContent>
                        {dogs?.map((dog) => (
                          <SelectItem key={dog.id} value={dog.id}>{dog.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Record Type *</Label>
                    <Select value={newRecord.recordType} onValueChange={(v) => setNewRecord({ ...newRecord, recordType: v as RecordType })}>
                      <SelectTrigger data-testid="select-record-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RECORD_TYPE_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      value={newRecord.title}
                      onChange={(e) => setNewRecord({ ...newRecord, title: e.target.value })}
                      placeholder="e.g., Annual Rabies Vaccination"
                      data-testid="input-record-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newRecord.description}
                      onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                      placeholder="Additional notes..."
                      data-testid="textarea-record-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Veterinarian</Label>
                    <Input
                      value={newRecord.veterinarian}
                      onChange={(e) => setNewRecord({ ...newRecord, veterinarian: e.target.value })}
                      placeholder="Dr. Smith"
                      data-testid="input-veterinarian"
                    />
                  </div>

                  {newRecord.recordType === "vaccine" && (
                    <>
                      <div className="space-y-2">
                        <Label>Vaccine Name</Label>
                        <Select value={newRecord.vaccineName} onValueChange={(v) => setNewRecord({ ...newRecord, vaccineName: v })}>
                          <SelectTrigger data-testid="select-vaccine-name">
                            <SelectValue placeholder="Select vaccine" />
                          </SelectTrigger>
                          <SelectContent>
                            {VACCINE_NAMES.map((v) => (
                              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Next Due Date</Label>
                        <Input
                          type="date"
                          value={newRecord.nextDueDate}
                          onChange={(e) => setNewRecord({ ...newRecord, nextDueDate: e.target.value })}
                          data-testid="input-next-due-date"
                        />
                      </div>
                    </>
                  )}

                  {newRecord.recordType === "medication" && (
                    <>
                      <div className="space-y-2">
                        <Label>Medication Name</Label>
                        <Input
                          value={newRecord.medicationName}
                          onChange={(e) => setNewRecord({ ...newRecord, medicationName: e.target.value })}
                          placeholder="e.g., Amoxicillin"
                          data-testid="input-medication-name"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Dosage</Label>
                          <Input
                            value={newRecord.dosage}
                            onChange={(e) => setNewRecord({ ...newRecord, dosage: e.target.value })}
                            placeholder="e.g., 250mg"
                            data-testid="input-dosage"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Frequency</Label>
                          <Input
                            value={newRecord.frequency}
                            onChange={(e) => setNewRecord({ ...newRecord, frequency: e.target.value })}
                            placeholder="e.g., 2x daily"
                            data-testid="input-frequency"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Cost ($)</Label>
                    <Input
                      type="number"
                      value={newRecord.cost}
                      onChange={(e) => setNewRecord({ ...newRecord, cost: e.target.value })}
                      placeholder="0.00"
                      data-testid="input-cost"
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={handleSubmitRecord}
                    disabled={createRecordMutation.isPending}
                    data-testid="button-submit-record"
                  >
                    {createRecordMutation.isPending ? "Saving..." : "Save Record"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {healthScreeningEnabled && (
            <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("triage")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <ClipboardList className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Triage Queue</p>
                    <p className="text-2xl font-bold" data-testid="text-triage-count">{unreviewedScreenings.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("treatments")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Treatments</p>
                  <p className="text-2xl font-bold" data-testid="text-treatments-count">{activeTreatmentPlans.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("referrals")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Referrals</p>
                  <p className="text-2xl font-bold" data-testid="text-referrals-count">{pendingReferrals.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab("records")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold" data-testid="text-total-records">{medicalRecords?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
            {healthScreeningEnabled && (
              <TabsTrigger value="triage" className="flex-1 sm:flex-none" data-testid="tab-triage">
                Triage Queue
                {unreviewedScreenings.length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">
                    {unreviewedScreenings.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="treatments" className="flex-1 sm:flex-none" data-testid="tab-treatments">
              Treatment Plans
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex-1 sm:flex-none" data-testid="tab-referrals">
              Vet Referrals
            </TabsTrigger>
            <TabsTrigger value="records" className="flex-1 sm:flex-none" data-testid="tab-records">
              All Records
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1 sm:flex-none" data-testid="tab-upcoming">
              Upcoming
              {(overdueVaccines.length + dueSoonVaccines.length) > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">
                  {overdueVaccines.length + dueSoonVaccines.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TRIAGE QUEUE TAB */}
          {healthScreeningEnabled && (
            <TabsContent value="triage" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle>Triage Queue</CardTitle>
                      <CardDescription>Review health screenings and take action</CardDescription>
                    </div>
                    <Select value={triageSeverityFilter} onValueChange={setTriageSeverityFilter}>
                      <SelectTrigger className="w-full sm:w-40" data-testid="select-triage-filter">
                        <SelectValue placeholder="Filter severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severities</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
              <CardContent>
                {healthScreeningsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                ) : filteredTriageItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                    <p>No items in triage queue</p>
                    <p className="text-sm mt-1">All health screenings have been reviewed</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTriageItems.map((screening: any) => (
                      <div 
                        key={screening.id} 
                        className="p-4 rounded-lg border bg-card"
                        data-testid={`triage-item-${screening.id}`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <Badge className={getSeverityColor(screening.severity)}>
                                {(screening.severity || 'unknown').toUpperCase()}
                              </Badge>
                              {(() => {
                                const recInfo = getRecommendationInfo(screening.recommendation);
                                const RecIcon = recInfo.icon;
                                return (
                                  <span className={`flex items-center gap-1 text-sm ${recInfo.color}`}>
                                    <RecIcon className="h-4 w-4" />
                                    {recInfo.label}
                                  </span>
                                );
                              })()}
                              <span className="text-xs text-muted-foreground">
                                {screening.createdAt ? formatDistanceToNow(new Date(screening.createdAt), { addSuffix: true }) : 'N/A'}
                              </span>
                            </div>
                            
                            {screening.dogId && (
                              <div className="flex items-center gap-2 mb-2">
                                <DogIcon className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{getDogName(screening.dogId)}</span>
                              </div>
                            )}

                            {screening.aiAnalysis && (
                              <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                                {screening.aiAnalysis}
                              </p>
                            )}

                            {screening.conditions && screening.conditions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {screening.conditions.slice(0, 3).map((c: string, i: number) => (
                                  <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                                ))}
                                {screening.conditions.length > 3 && (
                                  <Badge variant="outline" className="text-xs">+{screening.conditions.length - 3} more</Badge>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 lg:flex-col">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedScreeningForAction(screening);
                                setNewTreatmentPlan({
                                  ...newTreatmentPlan,
                                  dogId: screening.dogId || "",
                                  condition: screening.conditions?.[0] || "",
                                  title: `Treatment for ${screening.conditions?.[0] || 'health concern'}`,
                                });
                                setIsCreateTreatmentOpen(true);
                              }}
                              data-testid={`button-create-treatment-${screening.id}`}
                            >
                              <ListTodo className="h-4 w-4 mr-2" />
                              Create Treatment
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedScreeningForAction(screening);
                                setNewVetReferral({
                                  ...newVetReferral,
                                  dogId: screening.dogId || "",
                                  reason: screening.conditions?.[0] || screening.aiAnalysis?.substring(0, 100) || "",
                                  symptoms: screening.symptoms || "",
                                  urgency: screening.recommendation === 'emergency' ? 'emergency' : 
                                           screening.recommendation === 'vet_visit' ? 'soon' : 'routine',
                                });
                                setIsCreateReferralOpen(true);
                              }}
                              data-testid={`button-refer-vet-${screening.id}`}
                            >
                              <Building2 className="h-4 w-4 mr-2" />
                              Refer to Vet
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markScreeningReviewedMutation.mutate({ screeningId: screening.id })}
                              disabled={markScreeningReviewedMutation.isPending}
                              data-testid={`button-mark-reviewed-${screening.id}`}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Mark Reviewed
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* TREATMENT PLANS TAB */}
          <TabsContent value="treatments" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>Treatment Plans</CardTitle>
                    <CardDescription>Active treatment protocols and progress tracking</CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      resetTreatmentForm();
                      setSelectedScreeningForAction(null);
                      setIsCreateTreatmentOpen(true);
                    }}
                    data-testid="button-new-treatment"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Treatment Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {treatmentPlansLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                ) : !treatmentPlans || treatmentPlans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No treatment plans yet</p>
                    <p className="text-sm mt-1">Create a treatment plan from the triage queue or add one manually</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {treatmentPlans.map((plan: TreatmentPlan) => (
                      <div
                        key={plan.id}
                        className="flex items-start gap-4 p-4 rounded-lg border hover-elevate"
                        data-testid={`treatment-plan-${plan.id}`}
                      >
                        <div className={`p-2 rounded-lg text-white ${
                          plan.priority === 'urgent' ? 'bg-red-500' :
                          plan.priority === 'high' ? 'bg-orange-500' :
                          plan.priority === 'normal' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}>
                          <Activity className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{plan.title}</span>
                            <Badge className={PRIORITY_CONFIG[plan.priority as keyof typeof PRIORITY_CONFIG]?.color || PRIORITY_CONFIG.normal.color}>
                              {PRIORITY_CONFIG[plan.priority as keyof typeof PRIORITY_CONFIG]?.label || plan.priority}
                            </Badge>
                            <Badge className={STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG]?.color || STATUS_CONFIG.pending.color}>
                              {STATUS_CONFIG[plan.status as keyof typeof STATUS_CONFIG]?.label || plan.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <DogIcon className="h-3 w-3" />
                            <span>{getDogName(plan.dogId)}</span>
                            {plan.condition && (
                              <>
                                <span className="mx-1">•</span>
                                <span>{plan.condition}</span>
                              </>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>Started: {format(new Date(plan.startDate), "MMM d, yyyy")}</span>
                            {plan.targetEndDate && (
                              <span>Target: {format(new Date(plan.targetEndDate), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* VET REFERRALS TAB */}
          <TabsContent value="referrals" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle>Vet Referrals</CardTitle>
                    <CardDescription>External veterinary consultations and appointments</CardDescription>
                  </div>
                  <Button
                    onClick={() => {
                      resetReferralForm();
                      setSelectedScreeningForAction(null);
                      setIsCreateReferralOpen(true);
                    }}
                    data-testid="button-new-referral"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Referral
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {vetReferralsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                ) : !vetReferrals || vetReferrals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No vet referrals yet</p>
                    <p className="text-sm mt-1">Create a referral from the triage queue or add one manually</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vetReferrals.map((referral: VetReferral) => (
                      <div
                        key={referral.id}
                        className="flex items-start gap-4 p-4 rounded-lg border hover-elevate"
                        data-testid={`vet-referral-${referral.id}`}
                      >
                        <div className={`p-2 rounded-lg text-white ${
                          referral.urgency === 'emergency' ? 'bg-red-500' :
                          referral.urgency === 'urgent' ? 'bg-orange-500' :
                          referral.urgency === 'soon' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}>
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{referral.reason}</span>
                            <Badge className={URGENCY_CONFIG[referral.urgency as keyof typeof URGENCY_CONFIG]?.color || URGENCY_CONFIG.routine.color}>
                              {URGENCY_CONFIG[referral.urgency as keyof typeof URGENCY_CONFIG]?.label || referral.urgency}
                            </Badge>
                            <Badge className={STATUS_CONFIG[referral.status as keyof typeof STATUS_CONFIG]?.color || STATUS_CONFIG.pending.color}>
                              {STATUS_CONFIG[referral.status as keyof typeof STATUS_CONFIG]?.label || referral.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <DogIcon className="h-3 w-3" />
                            <span>{getDogName(referral.dogId)}</span>
                            {referral.vetClinicName && (
                              <>
                                <span className="mx-1">•</span>
                                <Building2 className="h-3 w-3" />
                                <span>{referral.vetClinicName}</span>
                              </>
                            )}
                          </div>
                          {referral.appointmentDate && (
                            <div className="flex items-center gap-1 mt-2 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">
                                {format(new Date(referral.appointmentDate), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                          )}
                          {referral.vetPhone && (
                            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{referral.vetPhone}</span>
                            </div>
                          )}
                        </div>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ALL RECORDS TAB */}
          <TabsContent value="records" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search records..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                  <Select value={selectedDog || "all"} onValueChange={(v) => setSelectedDog(v === "all" ? null : v)}>
                    <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-dog">
                      <SelectValue placeholder="Filter by pet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Pets</SelectItem>
                      {dogs?.map((dog) => (
                        <SelectItem key={dog.id} value={dog.id}>{dog.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Stethoscope className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No medical records found</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRecords.map((record) => {
                      const config = RECORD_TYPE_CONFIG[record.recordType as RecordType] || RECORD_TYPE_CONFIG.other;
                      const Icon = config.icon;
                      return (
                        <div
                          key={record.id}
                          className="flex items-center gap-4 p-4 rounded-lg border hover-elevate cursor-pointer"
                          data-testid={`card-record-${record.id}`}
                        >
                          <div className={`p-2 rounded-lg ${config.color} text-white`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{record.title}</span>
                              <Badge variant="outline" className="text-xs">{config.label}</Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <DogIcon className="h-3 w-3" />
                              <span>{getDogName(record.dogId)}</span>
                              <span className="mx-1">•</span>
                              <span>{format(new Date(record.performedAt), "MMM d, yyyy")}</span>
                            </div>
                          </div>
                          {record.nextDueDate && (
                            <div className="text-right hidden sm:block">
                              <p className="text-xs text-muted-foreground">Next Due</p>
                              <p className={`text-sm font-medium ${isPast(new Date(record.nextDueDate)) ? "text-red-500" : ""}`}>
                                {format(new Date(record.nextDueDate), "MMM d, yyyy")}
                              </p>
                            </div>
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* UPCOMING TAB */}
          <TabsContent value="upcoming" className="mt-4 space-y-4">
            {overdueVaccines.length > 0 && (
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Overdue ({overdueVaccines.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueVaccines.map((record) => (
                      <VaccineCard key={record.id} record={record} dogName={getDogName(record.dogId)} isOverdue />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {dueSoonVaccines.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Due Within 14 Days ({dueSoonVaccines.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dueSoonVaccines.map((record) => (
                      <VaccineCard key={record.id} record={record} dogName={getDogName(record.dogId)} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {overdueVaccines.length === 0 && dueSoonVaccines.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p>All vaccinations are up to date!</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* CREATE TREATMENT PLAN DIALOG */}
        <Dialog open={isCreateTreatmentOpen} onOpenChange={(open) => {
          setIsCreateTreatmentOpen(open);
          if (!open) {
            resetTreatmentForm();
            setSelectedScreeningForAction(null);
          }
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Treatment Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Pet *</Label>
                <Select 
                  value={newTreatmentPlan.dogId} 
                  onValueChange={(v) => setNewTreatmentPlan({ ...newTreatmentPlan, dogId: v })}
                >
                  <SelectTrigger data-testid="select-treatment-dog">
                    <SelectValue placeholder="Select a pet" />
                  </SelectTrigger>
                  <SelectContent>
                    {dogs?.map((dog) => (
                      <SelectItem key={dog.id} value={dog.id}>{dog.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={newTreatmentPlan.title}
                  onChange={(e) => setNewTreatmentPlan({ ...newTreatmentPlan, title: e.target.value })}
                  placeholder="e.g., Antibiotics for skin infection"
                  data-testid="input-treatment-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Input
                  value={newTreatmentPlan.condition}
                  onChange={(e) => setNewTreatmentPlan({ ...newTreatmentPlan, condition: e.target.value })}
                  placeholder="e.g., Skin infection"
                  data-testid="input-treatment-condition"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newTreatmentPlan.description}
                  onChange={(e) => setNewTreatmentPlan({ ...newTreatmentPlan, description: e.target.value })}
                  placeholder="Treatment details and notes..."
                  data-testid="textarea-treatment-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Goal</Label>
                <Input
                  value={newTreatmentPlan.goal}
                  onChange={(e) => setNewTreatmentPlan({ ...newTreatmentPlan, goal: e.target.value })}
                  placeholder="e.g., Full recovery within 2 weeks"
                  data-testid="input-treatment-goal"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select 
                    value={newTreatmentPlan.priority} 
                    onValueChange={(v) => setNewTreatmentPlan({ ...newTreatmentPlan, priority: v })}
                  >
                    <SelectTrigger data-testid="select-treatment-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target End Date</Label>
                  <Input
                    type="date"
                    value={newTreatmentPlan.targetEndDate}
                    onChange={(e) => setNewTreatmentPlan({ ...newTreatmentPlan, targetEndDate: e.target.value })}
                    data-testid="input-treatment-target-date"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsCreateTreatmentOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreateTreatmentPlan}
                disabled={createTreatmentPlanMutation.isPending}
                data-testid="button-submit-treatment"
              >
                {createTreatmentPlanMutation.isPending ? "Creating..." : "Create Treatment Plan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CREATE VET REFERRAL DIALOG */}
        <Dialog open={isCreateReferralOpen} onOpenChange={(open) => {
          setIsCreateReferralOpen(open);
          if (!open) {
            resetReferralForm();
            setSelectedScreeningForAction(null);
          }
        }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Vet Referral</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Pet *</Label>
                <Select 
                  value={newVetReferral.dogId} 
                  onValueChange={(v) => setNewVetReferral({ ...newVetReferral, dogId: v })}
                >
                  <SelectTrigger data-testid="select-referral-dog">
                    <SelectValue placeholder="Select a pet" />
                  </SelectTrigger>
                  <SelectContent>
                    {dogs?.map((dog) => (
                      <SelectItem key={dog.id} value={dog.id}>{dog.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason for Referral *</Label>
                <Textarea
                  value={newVetReferral.reason}
                  onChange={(e) => setNewVetReferral({ ...newVetReferral, reason: e.target.value })}
                  placeholder="Describe the reason for the vet referral..."
                  data-testid="textarea-referral-reason"
                />
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select 
                  value={newVetReferral.urgency} 
                  onValueChange={(v) => setNewVetReferral({ ...newVetReferral, urgency: v })}
                >
                  <SelectTrigger data-testid="select-referral-urgency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="soon">Soon (within a few days)</SelectItem>
                    <SelectItem value="urgent">Urgent (within 24 hours)</SelectItem>
                    <SelectItem value="emergency">Emergency (immediate)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Symptoms</Label>
                <Textarea
                  value={newVetReferral.symptoms}
                  onChange={(e) => setNewVetReferral({ ...newVetReferral, symptoms: e.target.value })}
                  placeholder="Describe symptoms observed..."
                  data-testid="textarea-referral-symptoms"
                />
              </div>
              
              <div className="border-t pt-4 mt-4">
                <Label className="text-base font-medium">Vet Information (Optional)</Label>
              </div>
              
              <div className="space-y-2">
                <Label>Vet Clinic Name</Label>
                <Input
                  value={newVetReferral.vetClinicName}
                  onChange={(e) => setNewVetReferral({ ...newVetReferral, vetClinicName: e.target.value })}
                  placeholder="e.g., City Animal Hospital"
                  data-testid="input-vet-clinic"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Vet Name</Label>
                  <Input
                    value={newVetReferral.vetName}
                    onChange={(e) => setNewVetReferral({ ...newVetReferral, vetName: e.target.value })}
                    placeholder="Dr. Smith"
                    data-testid="input-vet-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={newVetReferral.vetPhone}
                    onChange={(e) => setNewVetReferral({ ...newVetReferral, vetPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-vet-phone"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Appointment Date/Time</Label>
                <Input
                  type="datetime-local"
                  value={newVetReferral.appointmentDate}
                  onChange={(e) => setNewVetReferral({ ...newVetReferral, appointmentDate: e.target.value })}
                  data-testid="input-appointment-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Appointment Notes</Label>
                <Textarea
                  value={newVetReferral.appointmentNotes}
                  onChange={(e) => setNewVetReferral({ ...newVetReferral, appointmentNotes: e.target.value })}
                  placeholder="Any special instructions or notes for the appointment..."
                  data-testid="textarea-appointment-notes"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsCreateReferralOpen(false)}>Cancel</Button>
              <Button
                onClick={handleCreateVetReferral}
                disabled={createVetReferralMutation.isPending}
                data-testid="button-submit-referral"
              >
                {createVetReferralMutation.isPending ? "Creating..." : "Create Referral"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isHealthScannerOpen && (
        <HealthScreeningScanner
          onScanComplete={(result) => {
            setPetScanResult(result);
          }}
          onClose={() => setIsHealthScannerOpen(false)}
        />
      )}
    </>
  );
}

function VaccineCard({ record, dogName, isOverdue = false }: { record: any; dogName: string; isOverdue?: boolean }) {
  const daysOverdue = record.nextDueDate ? Math.floor((Date.now() - new Date(record.nextDueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border ${isOverdue ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20" : ""}`}>
      <div className={`p-2 rounded-lg ${isOverdue ? "bg-red-500" : "bg-amber-500"} text-white`}>
        <Syringe className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{record.title}</span>
          {record.vaccineName && (
            <Badge variant="outline" className="text-xs uppercase">{record.vaccineName}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <DogIcon className="h-3 w-3" />
          <span>{dogName}</span>
        </div>
      </div>
      <div className="text-right">
        {isOverdue ? (
          <Badge variant="destructive">{daysOverdue} days overdue</Badge>
        ) : (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
            {formatDistanceToNow(new Date(record.nextDueDate), { addSuffix: true })}
          </Badge>
        )}
      </div>
    </div>
  );
}
