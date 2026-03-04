import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  PawPrint, Plus, Search, Filter, Clock, AlertCircle, CheckCircle2, XCircle,
  ChevronRight, Calendar, Scale, Heart, FileText, ArrowUpDown, Clipboard,
  Edit, Eye, Building2, UserCircle, MapPin, Phone, Truck, RotateCcw, Baby,
  Camera, Sparkles, Loader2, ImagePlus, X, RefreshCw, SlidersHorizontal, Trash2, Wand2,
  Ear, SmilePlus, User, Stethoscope
} from "lucide-react";
import { AnimalScanner, ScannerTriggerButton } from "@/components/animal-scanner";
import type { ScanResult } from "@/hooks/use-animal-scanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { ShelterCheckbox } from "@/components/ui/shelter-checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlag } from "@/hooks/use-feature-flags";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Dog, IntakeRecord } from "@shared/schema";

interface DogWithIntake extends Dog {
  intake?: IntakeRecord | null;
}

const INTAKE_TYPES = [
  { value: "stray", label: "Stray", icon: MapPin, description: "Found wandering without owner" },
  { value: "owner_surrender", label: "Owner Surrender", icon: UserCircle, description: "Surrendered by owner" },
  { value: "transfer", label: "Transfer", icon: Truck, description: "Transferred from another organization" },
  { value: "return", label: "Return", icon: RotateCcw, description: "Returned by adopter" },
  { value: "rescue", label: "Rescue", icon: Heart, description: "Rescued from dangerous situation" },
  { value: "born_in_care", label: "Born in Care", icon: Baby, description: "Born at the shelter" },
];

const CONDITION_LEVELS = [
  { value: "critical", label: "Critical", color: "bg-red-500" },
  { value: "poor", label: "Poor", color: "bg-orange-500" },
  { value: "fair", label: "Fair", color: "bg-yellow-500" },
  { value: "good", label: "Good", color: "bg-green-500" },
  { value: "excellent", label: "Excellent", color: "bg-emerald-500" },
];

const PIPELINE_STATUSES = [
  { value: "intake", label: "Intake", color: "bg-blue-500" },
  { value: "medical_hold", label: "Medical Hold", color: "bg-red-500" },
  { value: "behavior_eval", label: "Behavior Eval", color: "bg-purple-500" },
  { value: "ready", label: "Ready", color: "bg-green-500" },
  { value: "adopted", label: "Adopted", color: "bg-emerald-500" },
  { value: "transferred", label: "Transferred", color: "bg-orange-500" },
  { value: "other", label: "Other", color: "bg-gray-500" },
];

const HOLD_TYPES = [
  { value: "stray_hold", label: "Stray Hold", duration: 72 },
  { value: "medical_hold", label: "Medical Hold", duration: null },
  { value: "legal_hold", label: "Legal Hold", duration: null },
  { value: "behavior_hold", label: "Behavior Hold", duration: null },
];

const OUTCOME_TYPES = [
  { value: "adopted", label: "Adopted", icon: Heart },
  { value: "transferred", label: "Transferred", icon: Truck },
  { value: "returned_to_owner", label: "Returned to Owner", icon: UserCircle },
  { value: "euthanized", label: "Euthanized", icon: XCircle },
  { value: "died_in_care", label: "Died in Care", icon: AlertCircle },
  { value: "other", label: "Other", icon: FileText },
];

const newDogSchema = z.object({
  name: z.string().min(1, "Name is required"),
  breed: z.string().min(1, "Breed is required"),
  age: z.coerce.number().min(0, "Age must be positive"),
  gender: z.enum(["male", "female"]),
  size: z.enum(["small", "medium", "large", "extra_large"]),
  weight: z.coerce.number().min(0).optional(),
  color: z.string().optional(),
  microchipId: z.string().optional(),
  description: z.string().optional(),
  // Temperament & personality (populated from AI scan)
  energyLevel: z.enum(["low", "moderate", "high", "very_high"]).optional(),
  temperament: z.array(z.string()).optional(),
  temperamentNotes: z.string().optional(), // Notes about observed behavior
  goodWithKids: z.boolean().optional(),
  goodWithDogs: z.boolean().optional(),
  goodWithCats: z.boolean().optional(),
  // Health defaults
  vaccinated: z.boolean().optional(),
  spayedNeutered: z.boolean().optional(),
});

const intakeSchema = z.object({
  intakeType: z.string().min(1, "Intake type is required"),
  intakeReason: z.string().optional(),
  sourceInfo: z.string().optional(),
  initialCondition: z.string().min(1, "Initial condition is required"),
  initialWeight: z.coerce.number().min(0).optional(),
  initialNotes: z.string().optional(),
  pipelineStatus: z.string().default("intake"),
  holdType: z.string().optional(),
  holdNotes: z.string().optional(),
  holdDays: z.coerce.number().min(0).optional(),
});

const outcomeSchema = z.object({
  outcomeType: z.string().min(1, "Outcome type is required"),
  outcomeNotes: z.string().optional(),
});

type NewDogForm = z.infer<typeof newDogSchema>;
type IntakeForm = z.infer<typeof intakeSchema>;
type OutcomeForm = z.infer<typeof outcomeSchema>;

function IntakeCard({ intake, dog }: { intake: IntakeRecord; dog?: Dog }) {
  const pipelineStatus = PIPELINE_STATUSES.find(s => s.value === intake.pipelineStatus);
  const condition = CONDITION_LEVELS.find(c => c.value === intake.initialCondition);
  const intakeType = INTAKE_TYPES.find(t => t.value === intake.intakeType);

  return (
    <Card className="hover-elevate" data-testid={`card-intake-${intake.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
            {dog?.photos && dog.photos.length > 0 ? (
              <img 
                src={dog.photos[0]} 
                alt={dog.name || "Pet"} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                <PawPrint className="w-6 h-6 text-primary" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold truncate">{dog?.name || "Unknown Dog"}</h3>
              <Badge variant="outline" className={`${pipelineStatus?.color} text-white shrink-0`}>
                {pipelineStatus?.label || intake.pipelineStatus}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(intake.intakeDate), "MMM d, yyyy")}
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span>{intakeType?.label || intake.intakeType}</span>
              {condition && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <Badge variant="secondary" className="text-xs">
                    {condition.label}
                  </Badge>
                </>
              )}
            </div>
            {intake.holdType && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                  <Clock className="w-3 h-3 mr-1" />
                  {HOLD_TYPES.find(h => h.value === intake.holdType)?.label || intake.holdType}
                </Badge>
                {intake.holdExpiresAt && (
                  <span className="text-xs text-muted-foreground">
                    Expires {formatDistanceToNow(new Date(intake.holdExpiresAt), { addSuffix: true })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IntakeTypeSelector({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
      {INTAKE_TYPES.map((type) => {
        const Icon = type.icon;
        const isSelected = value === type.value;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={`p-3 sm:p-4 rounded-lg border-2 text-left transition-all hover-elevate ${
              isSelected 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
            data-testid={`intake-type-${type.value}`}
          >
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
            <p className={`font-medium text-xs sm:text-sm ${isSelected ? "text-primary" : ""}`}>{type.label}</p>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{type.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function NewIntakeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(1);
  const { toast } = useToast();
  const { isEnabled: healthScreeningEnabled } = useFeatureFlag('AI_HEALTH_SCREENING');
  const [showScanner, setShowScanner] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [generatingName, setGeneratingName] = useState(false);
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flexible Health Concerns state for AI screening
  const [healthConcerns, setHealthConcerns] = useState<{
    id: string;
    photo: string;
    bodyArea: string;
    description: string;
  }[]>([]);
  const [showAddConcern, setShowAddConcern] = useState(false);
  const [uploadingConcernPhoto, setUploadingConcernPhoto] = useState(false);
  const [newConcern, setNewConcern] = useState<{
    photo: string;
    bodyArea: string;
    description: string;
  }>({ photo: '', bodyArea: '', description: '' });
  const concernPhotoInputRef = useRef<HTMLInputElement>(null);

  const CONCERN_BODY_AREAS = [
    { value: 'eye_left', label: 'Left Eye' },
    { value: 'eye_right', label: 'Right Eye' },
    { value: 'ear_left', label: 'Left Ear' },
    { value: 'ear_right', label: 'Right Ear' },
    { value: 'teeth_mouth', label: 'Teeth/Mouth' },
    { value: 'skin_coat', label: 'Skin/Coat' },
    { value: 'leg_paw', label: 'Leg/Paw' },
    { value: 'belly_chest', label: 'Belly/Chest' },
    { value: 'tail', label: 'Tail' },
    { value: 'back_spine', label: 'Back/Spine' },
    { value: 'full_body', label: 'Full Body' },
    { value: 'other', label: 'Other' },
  ];

  // Generate AI pet name suggestions
  const handleGenerateName = async () => {
    setGeneratingName(true);
    try {
      const breed = dogForm.getValues('breed') || 'mixed breed dog';
      const size = dogForm.getValues('size') || 'medium';
      const color = dogForm.getValues('color') || '';

      const response = await fetch('/api/generate-pet-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breed, size, color }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.names && data.names.length > 0) {
          setSuggestedNames(data.names);
          // Auto-fill first name
          dogForm.setValue('name', data.names[0]);
          toast({
            title: "Names generated!",
            description: `Try "${data.names[0]}" or pick another from the suggestions.`,
          });
        }
      } else {
        throw new Error('Failed to generate names');
      }
    } catch (error) {
      console.error('Name generation error:', error);
      toast({
        title: "Couldn't generate names",
        description: "Please enter a name manually.",
        variant: "destructive",
      });
    } finally {
      setGeneratingName(false);
    }
  };

  const dogForm = useForm<NewDogForm>({
    resolver: zodResolver(newDogSchema),
    defaultValues: {
      name: "",
      breed: "",
      age: 1,
      gender: "male",
      size: "medium",
      weight: undefined,
      color: "",
      microchipId: "",
      description: "",
      energyLevel: undefined,
      temperament: [],
      temperamentNotes: "",
      goodWithKids: undefined,
      goodWithDogs: undefined,
      goodWithCats: undefined,
      vaccinated: false,
      spayedNeutered: false,
    },
  });

  // Handle scan completion from AI scanner
  const handleScanComplete = async (result: ScanResult) => {
    setAnalysisResult(result);

    // Auto-fill form fields with scan results
    if (result.breed) dogForm.setValue('breed', result.breed);
    if (result.size) dogForm.setValue('size', result.size as any);
    if (result.coatColor) dogForm.setValue('color', result.coatColor);
    if (result.estimatedWeight) {
      const weightMatch = result.estimatedWeight.match(/(\d+)/);
      if (weightMatch) {
        dogForm.setValue('weight', parseInt(weightMatch[1], 10));
      }
    }

    // Set age based on age category
    if (result.ageCategory) {
      const ageMap: Record<string, number> = {
        puppy: 0.5,
        young: 1.5,
        adult: 4,
        senior: 10
      };
      dogForm.setValue('age', ageMap[result.ageCategory] || 3);
    }

    // Set energy level from temperament analysis
    if (result.energyLevel) {
      dogForm.setValue('energyLevel', result.energyLevel);
    } else if (result.temperament?.energyEstimate) {
      // Map energy estimate to energy level
      const energyMap: Record<string, "low" | "moderate" | "high" | "very_high"> = {
        low: "low",
        medium: "moderate",
        high: "high"
      };
      dogForm.setValue('energyLevel', energyMap[result.temperament.energyEstimate] || "moderate");
    }

    // Set temperament traits from AI analysis
    if (result.suggestedTemperament && result.suggestedTemperament.length > 0) {
      dogForm.setValue('temperament', result.suggestedTemperament);
    }

    // Set compatibility suggestions
    if (result.suggestedGoodWithKids !== null) {
      dogForm.setValue('goodWithKids', result.suggestedGoodWithKids);
    }
    if (result.suggestedGoodWithDogs !== null) {
      dogForm.setValue('goodWithDogs', result.suggestedGoodWithDogs);
    }
    if (result.suggestedGoodWithCats !== null) {
      dogForm.setValue('goodWithCats', result.suggestedGoodWithCats);
    }

    // Build comprehensive temperament notes from body language and temperament scores
    const temperamentNotes: string[] = [];
    if (result.temperament) {
      const t = result.temperament;
      if (t.calmLevel > 0.7) temperamentNotes.push("Very calm demeanor");
      else if (t.calmLevel < 0.3) temperamentNotes.push("Excitable/energetic");

      if (t.friendlinessScore > 0.7) temperamentNotes.push("Very friendly and approachable");
      else if (t.friendlinessScore < 0.3) temperamentNotes.push("May be reserved with strangers");

      if (t.confidenceScore > 0.7) temperamentNotes.push("Confident body language");
      else if (t.confidenceScore < 0.3) temperamentNotes.push("Shows some anxiety/shyness");

      if (t.stressScore > 0.5) temperamentNotes.push("Showing stress indicators - needs calm environment");
    }
    if (result.bodyLanguage) {
      const bl = result.bodyLanguage;
      if (bl.tailPosition) temperamentNotes.push(`Tail: ${bl.tailPosition}`);
      if (bl.earPosition) temperamentNotes.push(`Ears: ${bl.earPosition}`);
      if (bl.posture) temperamentNotes.push(`Posture: ${bl.posture}`);
    }
    if (temperamentNotes.length > 0) {
      dogForm.setValue('temperamentNotes', temperamentNotes.join(". "));
    }

    // Create description from observations
    if (result.observations) {
      let description = result.observations;
      if (result.temperament) {
        const energyDesc = result.temperament.energyEstimate === 'high' ? 'energetic' : 
                          result.temperament.energyEstimate === 'low' ? 'calm and relaxed' : 'moderately active';
        description = `This ${result.breed} appears to be ${energyDesc}. ${description}`;
      }
      dogForm.setValue('description', description);
    }

    // Handle image from scanner if available (same as pets form)
    if (result.imageBase64) {
      setPhotos(prev => [result.imageBase64!, ...prev]);
    }

    toast({
      title: "Scan Complete!",
      description: `Identified ${result.breed} with temperament notes. Review the details below.`,
    });
  };

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    for (const file of Array.from(files)) {
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        const base64Data = await base64Promise;

        const response = await apiRequest("POST", "/api/upload/dog-photo", { image: base64Data });
        const responseData = await response.json();
        if (responseData.url) {
          setPhotos(prev => [...prev, responseData.url]);
        }
      } catch (error: any) {
        toast({
          title: "Upload Failed",
          description: error.message || "Failed to upload photo",
          variant: "destructive",
        });
      }
    }
    setUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Handle concern photo upload
  const handleConcernPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingConcernPhoto(true);
    try {
      const file = files[0];
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await apiRequest("POST", "/api/upload/dog-photo", { image: base64Data });
      const responseData = await response.json();
      if (responseData.url) {
        setNewConcern(prev => ({ ...prev, photo: responseData.url }));
      }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload concern photo",
        variant: "destructive",
      });
    }
    setUploadingConcernPhoto(false);
    if (concernPhotoInputRef.current) {
      concernPhotoInputRef.current.value = '';
    }
  };

  const addHealthConcern = () => {
    if (!newConcern.photo || !newConcern.bodyArea) {
      toast({
        title: "Missing Information",
        description: "Please add a photo and select the body area",
        variant: "destructive",
      });
      return;
    }

    const concern = {
      id: crypto.randomUUID(),
      photo: newConcern.photo,
      bodyArea: newConcern.bodyArea,
      description: newConcern.description,
    };

    setHealthConcerns(prev => [...prev, concern]);
    setNewConcern({ photo: '', bodyArea: '', description: '' });
    setShowAddConcern(false);
    toast({
      title: "Concern Added",
      description: `Health concern for ${CONCERN_BODY_AREAS.find(a => a.value === concern.bodyArea)?.label || concern.bodyArea} saved`,
    });
  };

  const removeHealthConcern = (concernId: string) => {
    setHealthConcerns(prev => prev.filter(c => c.id !== concernId));
  };

  const intakeForm = useForm<IntakeForm>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      intakeType: "",
      intakeReason: "",
      sourceInfo: "",
      initialCondition: "good",
      initialWeight: undefined,
      initialNotes: "",
      pipelineStatus: "intake",
      holdType: "",
      holdNotes: "",
      holdDays: undefined,
    },
  });

  const createIntakeMutation = useMutation({
    mutationFn: async (data: { 
      dog: NewDogForm; 
      intake: IntakeForm; 
      photos: string[];
      healthConcerns: typeof healthConcerns;
    }) => {
      try {
        console.log("[Intake] Step 1: Creating dog...");
        // Derive age category from age
        const age = parseInt(data.dog.age?.toString() || "0") || 0;
        let ageCategory = "adult";
        if (age < 1) ageCategory = "puppy";
        else if (age >= 7) ageCategory = "senior";

        // Derive default weight from size if not provided
        const sizeToWeight: Record<string, number> = {
          small: 15,
          medium: 35,
          large: 60,
          giant: 100,
        };
        const weight = data.dog.weight || sizeToWeight[data.dog.size || "medium"] || 35;

        // Step 1: Create the dog using the correct endpoint with all required fields
        // Build bio from description and temperament notes
        let bio = data.dog.description || "";
        if (data.dog.temperamentNotes) {
          bio = bio ? `${bio}\n\nBehavior Notes: ${data.dog.temperamentNotes}` : `Behavior Notes: ${data.dog.temperamentNotes}`;
        }
        if (!bio) {
          bio = `${data.dog.name} is looking for their forever home.`;
        }

        const dogPayload = {
          // Basic info from form
          name: data.dog.name,
          breed: data.dog.breed || "Mixed Breed",
          age: age,
          size: data.dog.size || "medium",
          gender: data.dog.gender || "unknown",
          // Derived fields
          ageCategory,
          weight,
          // Required defaults for personality & traits (using form values from AI scan)
          energyLevel: data.dog.energyLevel || "moderate",
          temperament: data.dog.temperament && data.dog.temperament.length > 0 ? data.dog.temperament : ["friendly"],
          goodWithKids: data.dog.goodWithKids ?? true,
          goodWithDogs: data.dog.goodWithDogs ?? true,
          goodWithCats: data.dog.goodWithCats ?? false,
          // Description (using form's description field as bio)
          bio: bio,
          // Photos
          photos: data.photos.length > 0 ? data.photos : ["/placeholder-dog.jpg"],
          // Health (defaults for intake)
          vaccinated: data.dog.vaccinated ?? false,
          spayedNeutered: data.dog.spayedNeutered ?? false,
          // Status
          status: "available",
          isPublic: true,
        };

        console.log("[Intake] Dog payload:", JSON.stringify(dogPayload));
        const dogResponse = await apiRequest("POST", "/api/dogs", dogPayload);
        console.log("[Intake] Dog response status:", dogResponse.status);
        const dogResult = await dogResponse.json();
        console.log("[Intake] Dog created with ID:", dogResult.id);

        if (!dogResult.id) {
          throw new Error("Dog creation failed: no ID returned");
        }

        // Step 2: Create the intake record
        const intakePayload = {
          dogId: dogResult.id,
          intakeType: data.intake.intakeType || "owner_surrender",
          intakeReason: data.intake.intakeReason || null,
          sourceInfo: data.intake.sourceInfo || null,
          initialCondition: data.intake.initialCondition || "good",
          initialWeight: data.intake.initialWeight || null,
          initialNotes: data.intake.initialNotes || null,
          pipelineStatus: data.intake.pipelineStatus || "intake",
          holdType: data.intake.holdType || null,
          holdNotes: data.intake.holdNotes || null,
          holdExpiresAt: data.intake.holdDays 
            ? new Date(Date.now() + data.intake.holdDays * 24 * 60 * 60 * 1000).toISOString()
            : null,
        };

        console.log("[Intake] Step 2: Creating intake with payload:", JSON.stringify(intakePayload));
        const intakeResponse = await fetch("/api/shelter/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(intakePayload),
          credentials: "include",
        });

        console.log("[Intake] Intake response status:", intakeResponse.status);
        console.log("[Intake] Intake response headers:", Object.fromEntries(intakeResponse.headers.entries()));

        if (!intakeResponse.ok) {
          const text = await intakeResponse.text();
          console.error("[Intake] API error response:", text.substring(0, 500));
          throw new Error(`Intake creation failed: ${intakeResponse.status}`);
        }

        const intakeResult = await intakeResponse.json();
        console.log("[Intake] Intake created successfully:", intakeResult.id);

        // Step 3: If health concerns exist, trigger AI health screening
        if (data.healthConcerns.length > 0) {
          console.log("[Intake] Step 3: Running AI health screening on", data.healthConcerns.length, "concerns...");
          try {
            const healthScreeningPayload = {
              dogId: dogResult.id,
              intakeRecordId: intakeResult.id,
              concerns: data.healthConcerns.map(c => ({
                photo: c.photo,
                bodyArea: c.bodyArea,
                description: c.description,
              })),
            };

            const healthResponse = await fetch("/api/shelter/intake-health-screening", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(healthScreeningPayload),
              credentials: "include",
            });

            if (healthResponse.ok) {
              const healthResult = await healthResponse.json();
              console.log("[Intake] Health screening complete:", healthResult);
            } else {
              console.warn("[Intake] Health screening failed, but intake was successful");
            }
          } catch (healthError) {
            console.warn("[Intake] Health screening error:", healthError);
            // Don't fail the whole intake if health screening fails
          }
        }

        return intakeResult;
      } catch (error: any) {
        console.error("[Intake] Error in mutation:", error.message);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/intake"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/medical"] });
      toast({
        title: "Intake Complete",
        description: "Dog has been added to the system successfully.",
      });
      onOpenChange(false);
      setStep(1);
      dogForm.reset();
      intakeForm.reset();
      setPhotos([]);
      setAnalysisResult(null);
      setHealthConcerns([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create intake record",
        variant: "destructive",
      });
    },
  });

  const handleNext = async () => {
    if (step === 1) {
      const valid = await dogForm.trigger();
      if (valid) {
        setStep(2);
      } else {
        // Show which fields have errors
        const errors = dogForm.formState.errors;
        const errorFields = Object.keys(errors);
        if (errorFields.length > 0) {
          const fieldNames = errorFields.map(f => f === 'name' ? 'Pet Name' : f === 'breed' ? 'Breed' : f).join(', ');
          toast({
            title: "Missing Required Fields",
            description: `Please fill in: ${fieldNames}`,
            variant: "destructive",
          });
        }
      }
    } else if (step === 2) {
      const valid = await intakeForm.trigger();
      if (valid) {
        setStep(3);
      } else {
        const errors = intakeForm.formState.errors;
        const errorFields = Object.keys(errors);
        if (errorFields.length > 0) {
          const fieldNames = errorFields.map(f => 
            f === 'intakeType' ? 'Intake Type' : 
            f === 'initialCondition' ? 'Condition' : f
          ).join(', ');
          toast({
            title: "Missing Required Fields",
            description: `Please fill in: ${fieldNames}`,
            variant: "destructive",
          });
        }
      }
    }
  };

  const handleSubmit = () => {
    const dogData = dogForm.getValues();
    const intakeData = intakeForm.getValues();
    createIntakeMutation.mutate({ dog: dogData, intake: intakeData, photos, healthConcerns });
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
    dogForm.reset();
    intakeForm.reset();
    setPhotos([]);
    setAnalysisResult(null);
    setHealthConcerns([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] md:w-full flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-2">
            <PawPrint className="w-5 h-5 text-primary" />
            New Intake
          </DialogTitle>
          <DialogDescription className="text-xs">
            Step {step} of 3: {step === 1 ? "Pet Information" : step === 2 ? "Intake Details" : "Review & Confirm"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* AI Scanner Modal */}
        {showScanner && (
          <AnimalScanner
            onScanComplete={handleScanComplete}
            onClose={() => setShowScanner(false)}
          />
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          {step === 1 && (
            <Form {...dogForm}>
              <form className="space-y-3 pr-2">
                {/* Photo Upload Section */}
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium">Photos</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {/* AI Scan Box */}
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="aspect-square rounded-lg border-2 border-dashed border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors p-2"
                    >
                      <Sparkles className="w-5 h-5 text-primary mb-1" />
                      <span className="text-xs text-center font-medium text-primary">AI Scan</span>
                      <span className="text-[10px] text-muted-foreground text-center mt-0.5">New</span>
                    </button>
                    {photos.map((photo, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                        <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button type="button" variant="destructive" size="icon" onClick={() => removePhoto(index)} className="h-6 w-6">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <label className={`aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors ${uploadingPhoto ? 'opacity-50' : ''}`}>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploadingPhoto} />
                      {uploadingPhoto ? (
                        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="w-5 h-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Add</span>
                        </>
                      )}
                    </label>
                  </div>

                  {/* AI Analysis Result */}
                  {analysisResult && (
                    <div className="p-3 rounded-md bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 space-y-2" data-testid="panel-scan-result">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Scan Complete
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Breed:</span> <span className="font-medium">{analysisResult.breed}</span></div>
                        <div><span className="text-muted-foreground">Size:</span> <span className="font-medium capitalize">{analysisResult.size}</span></div>
                        {analysisResult.coatColor && (
                          <div><span className="text-muted-foreground">Color:</span> <span className="font-medium">{analysisResult.coatColor}</span></div>
                        )}
                        {analysisResult.ageCategory && (
                          <div><span className="text-muted-foreground">Age:</span> <span className="font-medium capitalize">{analysisResult.ageCategory}</span></div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={dogForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input placeholder="Enter pet name" {...field} data-testid="input-dog-name" />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleGenerateName}
                            disabled={generatingName}
                            title="Generate AI name suggestions"
                            data-testid="button-generate-name"
                          >
                            {generatingName ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        {suggestedNames.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {suggestedNames.map((name) => (
                              <Badge
                                key={name}
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary/20"
                                onClick={() => dogForm.setValue('name', name)}
                                data-testid={`badge-name-${name}`}
                              >
                                {name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dogForm.control}
                    name="breed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Breed *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Labrador Mix" {...field} data-testid="input-dog-breed" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={dogForm.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age (years) *</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={0.5} {...field} data-testid="input-dog-age" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dogForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-dog-gender">
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dogForm.control}
                    name="size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Size *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-dog-size">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="small">Small (0-25 lbs)</SelectItem>
                            <SelectItem value="medium">Medium (26-50 lbs)</SelectItem>
                            <SelectItem value="large">Large (51-90 lbs)</SelectItem>
                            <SelectItem value="extra_large">Extra Large (90+ lbs)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={dogForm.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} placeholder="Optional" {...field} data-testid="input-dog-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={dogForm.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color/Markings</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Black and tan" {...field} data-testid="input-dog-color" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={dogForm.control}
                  name="microchipId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Microchip ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter microchip number if available" {...field} data-testid="input-microchip" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={dogForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the dog's appearance, temperament, etc." 
                          className="min-h-[80px]"
                          {...field} 
                          data-testid="input-dog-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          )}

          {step === 2 && (
            <Form {...intakeForm}>
              <form className="space-y-4 pr-2">
                <FormField
                  control={intakeForm.control}
                  name="intakeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intake Type *</FormLabel>
                      <FormControl>
                        <IntakeTypeSelector value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={intakeForm.control}
                  name="sourceInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Information</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={
                            intakeForm.watch("intakeType") === "stray" ? "Location where found" :
                            intakeForm.watch("intakeType") === "owner_surrender" ? "Previous owner name & contact" :
                            intakeForm.watch("intakeType") === "transfer" ? "Transfer organization name" :
                            intakeForm.watch("intakeType") === "return" ? "Previous adopter info" :
                            "Source details"
                          } 
                          {...field} 
                          data-testid="input-source-info"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={intakeForm.control}
                  name="intakeReason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reason for Intake</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Why is this dog being taken in?" 
                          className="min-h-[60px]"
                          {...field} 
                          data-testid="input-intake-reason"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={intakeForm.control}
                    name="initialCondition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Condition *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-condition">
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CONDITION_LEVELS.map((condition) => (
                              <SelectItem key={condition.value} value={condition.value}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${condition.color}`} />
                                  {condition.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={intakeForm.control}
                    name="initialWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight at Intake (lbs)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} placeholder="Optional" {...field} data-testid="input-intake-weight" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={intakeForm.control}
                  name="initialNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intake Assessment Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Notes from initial health and behavior assessment" 
                          className="min-h-[80px]"
                          {...field} 
                          data-testid="input-intake-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                {/* Health Concerns Section - Flexible AI-Powered (Feature Flag Controlled) */}
                {healthScreeningEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary" />
                      <h4 className="font-medium">Health Concerns</h4>
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI-Powered
                      </Badge>
                    </div>
                    {!showAddConcern && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAddConcern(true)}
                        data-testid="button-add-health-concern"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Concern
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add photos of any areas you're worried about. AI will analyze each concern and flag for medical review.
                  </p>

                  {/* Add Concern Form */}
                  {showAddConcern && (
                    <Card className="border-dashed border-primary/50">
                      <CardContent className="p-3 space-y-3">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          ref={concernPhotoInputRef}
                          className="hidden"
                          onChange={handleConcernPhotoUpload}
                          data-testid="input-concern-photo"
                        />

                        {/* Photo upload area */}
                        <div 
                          onClick={() => concernPhotoInputRef.current?.click()}
                          className={`cursor-pointer border-2 border-dashed rounded-lg p-4 text-center transition-all hover-elevate ${
                            newConcern.photo ? "border-green-500 bg-green-500/5" : "border-muted-foreground/30"
                          }`}
                        >
                          {uploadingConcernPhoto ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                              <span className="text-xs text-muted-foreground">Uploading...</span>
                            </div>
                          ) : newConcern.photo ? (
                            <div className="relative inline-block">
                              <img 
                                src={newConcern.photo} 
                                alt="Concern photo" 
                                className="w-20 h-20 object-cover rounded-lg mx-auto"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNewConcern(prev => ({ ...prev, photo: '' }));
                                }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <Camera className="w-6 h-6 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Take or upload photo</span>
                            </div>
                          )}
                        </div>

                        {/* Body area dropdown */}
                        <Select 
                          value={newConcern.bodyArea} 
                          onValueChange={(v) => setNewConcern(prev => ({ ...prev, bodyArea: v }))}
                        >
                          <SelectTrigger data-testid="select-concern-body-area">
                            <SelectValue placeholder="Select body area" />
                          </SelectTrigger>
                          <SelectContent>
                            {CONCERN_BODY_AREAS.map((area) => (
                              <SelectItem key={area.value} value={area.value}>
                                {area.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Description textarea */}
                        <Textarea
                          placeholder="Describe what you're worried about (e.g., redness, swelling, discharge...)"
                          value={newConcern.description}
                          onChange={(e) => setNewConcern(prev => ({ ...prev, description: e.target.value }))}
                          className="min-h-[60px]"
                          data-testid="input-concern-description"
                        />

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowAddConcern(false);
                              setNewConcern({ photo: '', bodyArea: '', description: '' });
                            }}
                            className="flex-1"
                            data-testid="button-cancel-concern"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={addHealthConcern}
                            disabled={!newConcern.photo || !newConcern.bodyArea}
                            className="flex-1"
                            data-testid="button-save-concern"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* List of added concerns */}
                  {healthConcerns.length > 0 && (
                    <div className="space-y-2">
                      {healthConcerns.map((concern) => (
                        <div 
                          key={concern.id}
                          className="flex items-start gap-3 p-2 rounded-lg border bg-card"
                          data-testid={`card-health-concern-${concern.id}`}
                        >
                          <img 
                            src={concern.photo} 
                            alt={concern.bodyArea} 
                            className="w-12 h-12 object-cover rounded-md shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <Badge variant="secondary" className="text-xs mb-1">
                              {CONCERN_BODY_AREAS.find(a => a.value === concern.bodyArea)?.label || concern.bodyArea}
                            </Badge>
                            {concern.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{concern.description}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => removeHealthConcern(concern.id)}
                            className="shrink-0"
                            data-testid={`button-remove-concern-${concern.id}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  {healthConcerns.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      {healthConcerns.length} health concern{healthConcerns.length !== 1 ? 's' : ''} will be analyzed by AI
                    </div>
                  )}
                </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={intakeForm.control}
                    name="holdType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hold Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-hold-type">
                              <SelectValue placeholder="No hold" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Hold</SelectItem>
                            {HOLD_TYPES.map((hold) => (
                              <SelectItem key={hold.value} value={hold.value}>
                                {hold.label} {hold.duration ? `(${hold.duration}h)` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {intakeForm.watch("holdType") && intakeForm.watch("holdType") !== "none" && (
                    <FormField
                      control={intakeForm.control}
                      name="holdDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hold Duration (days)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1} 
                              placeholder={
                                intakeForm.watch("holdType") === "stray_hold" ? "3" : "Enter days"
                              }
                              {...field} 
                              data-testid="input-hold-days"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {intakeForm.watch("holdType") && intakeForm.watch("holdType") !== "none" && (
                  <FormField
                    control={intakeForm.control}
                    name="holdNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hold Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Additional notes about the hold" 
                            className="min-h-[60px]"
                            {...field} 
                            data-testid="input-hold-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </form>
            </Form>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PawPrint className="w-4 h-4" />
                    Pet Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div><span className="text-muted-foreground">Name:</span> {dogForm.getValues("name")}</div>
                    <div><span className="text-muted-foreground">Breed:</span> {dogForm.getValues("breed")}</div>
                    <div><span className="text-muted-foreground">Age:</span> {dogForm.getValues("age")} years</div>
                    <div><span className="text-muted-foreground">Gender:</span> {dogForm.getValues("gender")}</div>
                    <div><span className="text-muted-foreground">Size:</span> {dogForm.getValues("size")}</div>
                    {dogForm.getValues("weight") && (
                      <div><span className="text-muted-foreground">Weight:</span> {dogForm.getValues("weight")} lbs</div>
                    )}
                    {dogForm.getValues("color") && (
                      <div><span className="text-muted-foreground">Color:</span> {dogForm.getValues("color")}</div>
                    )}
                    {dogForm.getValues("microchipId") && (
                      <div><span className="text-muted-foreground">Microchip:</span> {dogForm.getValues("microchipId")}</div>
                    )}
                  </div>
                  {dogForm.getValues("description") && (
                    <div className="pt-2 border-t mt-2">
                      <span className="text-muted-foreground">Notes:</span> {dogForm.getValues("description")}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clipboard className="w-4 h-4" />
                    Intake Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      {INTAKE_TYPES.find(t => t.value === intakeForm.getValues("intakeType"))?.label}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Condition:</span>{" "}
                      <Badge variant="secondary">
                        {CONDITION_LEVELS.find(c => c.value === intakeForm.getValues("initialCondition"))?.label}
                      </Badge>
                    </div>
                    {intakeForm.getValues("sourceInfo") && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Source:</span> {intakeForm.getValues("sourceInfo")}
                      </div>
                    )}
                    {intakeForm.getValues("intakeReason") && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Reason:</span> {intakeForm.getValues("intakeReason")}
                      </div>
                    )}
                    {intakeForm.getValues("initialWeight") && (
                      <div>
                        <span className="text-muted-foreground">Weight:</span> {intakeForm.getValues("initialWeight")} lbs
                      </div>
                    )}
                  </div>
                  {intakeForm.getValues("holdType") && intakeForm.getValues("holdType") !== "none" && (
                    <div className="pt-2 border-t mt-2">
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                        <Clock className="w-3 h-3 mr-1" />
                        {HOLD_TYPES.find(h => h.value === intakeForm.getValues("holdType"))?.label}
                        {intakeForm.getValues("holdDays") && ` - ${intakeForm.getValues("holdDays")} days`}
                      </Badge>
                    </div>
                  )}
                  {intakeForm.getValues("initialNotes") && (
                    <div className="pt-2 border-t mt-2">
                      <span className="text-muted-foreground">Notes:</span> {intakeForm.getValues("initialNotes")}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Health Concerns Summary */}
              {healthConcerns.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" />
                      Health Concerns
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI will analyze
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {healthConcerns.map((concern) => (
                      <div 
                        key={concern.id}
                        className="flex items-start gap-3 p-2 rounded-lg border bg-muted/30"
                      >
                        <img 
                          src={concern.photo} 
                          alt={concern.bodyArea} 
                          className="w-10 h-10 object-cover rounded-md shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <Badge variant="outline" className="text-xs mb-1">
                            {CONCERN_BODY_AREAS.find(a => a.value === concern.bodyArea)?.label || concern.bodyArea}
                          </Badge>
                          {concern.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{concern.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t">
          <div className="flex gap-2 w-full sm:w-auto">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 sm:flex-none" data-testid="button-back">
                Back
              </Button>
            )}
          </div>
          <div className="flex-1 hidden sm:block" />
          <div className="w-full sm:w-auto">
            {step < 3 ? (
              <Button onClick={handleNext} className="w-full sm:w-auto" data-testid="button-next">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={createIntakeMutation.isPending}
                className="w-full sm:w-auto"
                data-testid="button-submit-intake"
              >
                {createIntakeMutation.isPending ? "Creating..." : "Complete Intake"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordOutcomeDialog({ 
  intake, 
  dog, 
  open, 
  onOpenChange 
}: { 
  intake: IntakeRecord; 
  dog?: Dog;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<OutcomeForm>({
    resolver: zodResolver(outcomeSchema),
    defaultValues: {
      outcomeType: "",
      outcomeNotes: "",
    },
  });

  const recordOutcomeMutation = useMutation({
    mutationFn: async (data: OutcomeForm) => {
      const response = await apiRequest("PATCH", `/api/shelter/intake/${intake.id}/outcome`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/intake"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      toast({
        title: "Outcome Recorded",
        description: "The outcome has been recorded successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record outcome",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    recordOutcomeMutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Outcome</DialogTitle>
          <DialogDescription>
            Record the outcome for {dog?.name || "this pet"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="outcomeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Outcome Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-outcome-type">
                        <SelectValue placeholder="Select outcome" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OUTCOME_TYPES.map((outcome) => {
                        const Icon = outcome.icon;
                        return (
                          <SelectItem key={outcome.value} value={outcome.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {outcome.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="outcomeNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional details about the outcome" 
                      className="min-h-[80px]"
                      {...field} 
                      data-testid="input-outcome-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={recordOutcomeMutation.isPending} data-testid="button-record-outcome">
                {recordOutcomeMutation.isPending ? "Recording..." : "Record Outcome"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function ShelterIntake() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("all");
  const [showNewIntake, setShowNewIntake] = useState(false);
  const [selectedIntake, setSelectedIntake] = useState<IntakeRecord | null>(null);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const { toast } = useToast();

  // Bulk selection state
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");

  // Advanced filter state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [intakeTypeFilter, setIntakeTypeFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [holdFilter, setHoldFilter] = useState<string>("all");

  // Bulk delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: intakeRecords = [], isLoading } = useQuery<(IntakeRecord & { dog?: Dog })[]>({
    queryKey: ["/api/shelter/intake"],
  });

  const { data: dogs = [] } = useQuery<Dog[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const dogMap = useMemo(() => {
    const map = new Map<string, Dog>();
    dogs.forEach((dog) => map.set(dog.id, dog));
    return map;
  }, [dogs]);

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const intakeIds = Array.from(selectedRecords);
      const updates: Record<string, any> = {};

      if (bulkAction === "pipelineStatus") updates.pipelineStatus = bulkValue;
      if (bulkAction === "holdType") updates.holdType = bulkValue === "none" ? null : bulkValue;
      if (bulkAction === "initialCondition") updates.initialCondition = bulkValue;

      return apiRequest("PATCH", "/api/shelter/bulk/intake/status", { intakeIds, updates });
    },
    onSuccess: () => {
      toast({ 
        title: "Records Updated", 
        description: `Successfully updated ${selectedRecords.size} intake records` 
      });
      setSelectedRecords(new Set());
      setBulkAction("");
      setBulkValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/intake"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update records", 
        variant: "destructive" 
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const intakeIds = Array.from(selectedRecords);
      return apiRequest("DELETE", "/api/shelter/bulk/intake", { intakeIds });
    },
    onSuccess: () => {
      toast({ 
        title: "Records Deleted", 
        description: `Successfully deleted ${selectedRecords.size} intake records` 
      });
      setSelectedRecords(new Set());
      setBulkAction("");
      setShowDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/intake"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete records", 
        variant: "destructive" 
      });
      setShowDeleteConfirm(false);
    },
  });

  const filteredRecords = useMemo(() => {
    let records = intakeRecords;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      records = records.filter((record) => {
        const dog = dogMap.get(record.dogId);
        return (
          dog?.name?.toLowerCase().includes(query) ||
          record.intakeType.toLowerCase().includes(query) ||
          record.pipelineStatus.toLowerCase().includes(query)
        );
      });
    }

    if (selectedTab !== "all") {
      records = records.filter((record) => record.pipelineStatus === selectedTab);
    }

    // Advanced filters
    if (intakeTypeFilter !== "all") {
      records = records.filter((record) => record.intakeType === intakeTypeFilter);
    }

    if (conditionFilter !== "all") {
      records = records.filter((record) => record.initialCondition === conditionFilter);
    }

    if (holdFilter !== "all") {
      if (holdFilter === "on_hold") {
        records = records.filter((record) => record.holdType && record.holdType !== "none");
      } else if (holdFilter === "no_hold") {
        records = records.filter((record) => !record.holdType || record.holdType === "none");
      } else {
        records = records.filter((record) => record.holdType === holdFilter);
      }
    }

    return records.sort((a, b) => new Date(b.intakeDate).getTime() - new Date(a.intakeDate).getTime());
  }, [intakeRecords, searchQuery, selectedTab, dogMap, intakeTypeFilter, conditionFilter, holdFilter]);

  // Check if any advanced filters are active
  const hasActiveFilters = intakeTypeFilter !== "all" || conditionFilter !== "all" || holdFilter !== "all";

  const activeFilterCount = [
    intakeTypeFilter !== "all",
    conditionFilter !== "all",
    holdFilter !== "all",
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setIntakeTypeFilter("all");
    setConditionFilter("all");
    setHoldFilter("all");
    setSearchQuery("");
  };

  const toggleSelectAll = () => {
    if (selectedRecords.size === filteredRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSet = new Set(selectedRecords);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecords(newSet);
  };

  const stats = useMemo(() => {
    const total = intakeRecords.length;
    const byStatus = PIPELINE_STATUSES.reduce((acc, status) => {
      acc[status.value] = intakeRecords.filter(r => r.pipelineStatus === status.value).length;
      return acc;
    }, {} as Record<string, number>);
    const onHold = intakeRecords.filter(r => r.holdType && r.holdType !== "none").length;
    const outcomes = intakeRecords.filter(r => r.outcomeType).length;

    return { total, byStatus, onHold, outcomes };
  }, [intakeRecords]);

  const handleRecordOutcome = (intake: IntakeRecord) => {
    setSelectedIntake(intake);
    setShowOutcomeDialog(true);
  };

  // Today's arrivals - intake records from today
  const todaysArrivals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return intakeRecords.filter(record => {
      const intakeDate = new Date(record.intakeDate);
      intakeDate.setHours(0, 0, 0, 0);
      return intakeDate.getTime() === today.getTime();
    }).sort((a, b) => new Date(b.intakeDate).getTime() - new Date(a.intakeDate).getTime());
  }, [intakeRecords]);

  // Records still in intake status (need processing)
  const inIntakeRecords = useMemo(() => {
    return intakeRecords
      .filter(r => r.pipelineStatus === "intake")
      .sort((a, b) => new Date(b.intakeDate).getTime() - new Date(a.intakeDate).getTime());
  }, [intakeRecords]);

  // Blocking alerts - legal holds or duplicates
  const blockingAlerts = useMemo(() => {
    return intakeRecords.filter(r => 
      r.holdType === "legal_hold" || 
      (r.holdType && r.pipelineStatus === "intake")
    );
  }, [intakeRecords]);

  return (
    
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto" data-testid="page-shelter-intake">
        {/* Primary CTA - Start New Intake */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-6 md:p-8 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <PawPrint className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold mb-2" data-testid="text-page-title">
              Pet Intake
            </h1>
            <p className="text-muted-foreground mb-6">
              Process new arrivals quickly and accurately
            </p>
            <Button 
              size="lg" 
              onClick={() => setShowNewIntake(true)} 
              className="text-lg px-8"
              data-testid="button-new-intake"
            >
              <Plus className="w-5 h-5 mr-2" />
              Start New Intake
            </Button>
          </CardContent>
        </Card>

        {/* Blocking Alerts - Only show if there are issues */}
        {blockingAlerts.length > 0 && (
          <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                Attention Required ({blockingAlerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {blockingAlerts.slice(0, 3).map((record) => {
                  const dog = dogMap.get(record.dogId);
                  return (
                    <div key={record.id} className="flex items-center justify-between p-2 bg-background rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{dog?.name || "Unknown"}</span>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">
                          {HOLD_TYPES.find(h => h.value === record.holdType)?.label || record.holdType}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => dog && setLocation(`/shelter/pipeline?focus=${dog.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's Arrivals */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                Today's Arrivals
              </CardTitle>
              <Badge variant="secondary">{todaysArrivals.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {todaysArrivals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No arrivals today yet
              </p>
            ) : (
              <div className="space-y-2">
                {todaysArrivals.map((record) => {
                  const dog = dogMap.get(record.dogId);
                  const intakeType = INTAKE_TYPES.find(t => t.value === record.intakeType);
                  return (
                    <div 
                      key={record.id} 
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                      onClick={() => dog && setLocation(`/shelter/pipeline?focus=${dog.id}`)}
                      data-testid={`card-today-intake-${record.id}`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                        {dog?.photos && dog.photos.length > 0 ? (
                          <img src={dog.photos[0]} alt={dog.name || "Pet"} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                            <PawPrint className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{dog?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">{intakeType?.label || record.intakeType}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* In Intake - Needs Processing */}
        {inIntakeRecords.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Needs Processing
                </CardTitle>
                <Badge variant="secondary">{inIntakeRecords.length}</Badge>
              </div>
              <CardDescription>Recent intakes awaiting medical evaluation</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {inIntakeRecords.slice(0, 5).map((record) => {
                  const dog = dogMap.get(record.dogId);
                  const condition = CONDITION_LEVELS.find(c => c.value === record.initialCondition);
                  return (
                    <div 
                      key={record.id} 
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                      onClick={() => dog && setLocation(`/shelter/pipeline?focus=${dog.id}`)}
                      data-testid={`card-intake-pending-${record.id}`}
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                        {dog?.photos && dog.photos.length > 0 ? (
                          <img src={dog.photos[0]} alt={dog.name || "Pet"} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                            <PawPrint className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{dog?.name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(record.intakeDate), { addSuffix: true })}
                        </p>
                      </div>
                      {condition && (
                        <Badge variant="secondary" className="text-xs">{condition.label}</Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  );
                })}
                {inIntakeRecords.length > 5 && (
                  <Button 
                    variant="ghost" 
                    className="w-full text-sm"
                    onClick={() => setLocation("/shelter/pipeline?filter=intake")}
                  >
                    View all {inIntakeRecords.length} in Pipeline
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bulk Edit Toolbar */}
        {selectedRecords.size > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <ShelterCheckbox
                    checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all-toolbar"
                  />
                  <Badge variant="secondary" data-testid="badge-selected-count">
                    {selectedRecords.size} selected
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <Select value={bulkAction} onValueChange={(v) => { setBulkAction(v); setBulkValue(""); }}>
                    <SelectTrigger className="w-[180px]" data-testid="select-bulk-action">
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pipelineStatus">Set Account Status</SelectItem>
                      <SelectItem value="holdType">Set Hold Type</SelectItem>
                      <SelectItem value="initialCondition">Set Condition</SelectItem>
                      <SelectItem value="delete" className="text-destructive">Delete Records</SelectItem>
                    </SelectContent>
                  </Select>

                  {bulkAction === "pipelineStatus" && (
                    <Select value={bulkValue} onValueChange={setBulkValue}>
                      <SelectTrigger className="w-[140px]" data-testid="select-bulk-pipeline">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {bulkAction === "initialCondition" && (
                    <Select value={bulkValue} onValueChange={setBulkValue}>
                      <SelectTrigger className="w-[140px]" data-testid="select-bulk-condition">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITION_LEVELS.map((cond) => (
                          <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {bulkAction && bulkAction !== "delete" && bulkValue && (
                    <Button 
                      onClick={() => bulkUpdateMutation.mutate()}
                      disabled={bulkUpdateMutation.isPending}
                      data-testid="button-apply-bulk"
                    >
                      {bulkUpdateMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Apply to {selectedRecords.size}
                    </Button>
                  )}

                  {bulkAction === "delete" && (
                    <Button 
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete {selectedRecords.size} Records
                    </Button>
                  )}
                </div>

                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setSelectedRecords(new Set()); setBulkAction(""); setBulkValue(""); }}
                  data-testid="button-clear-selection"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Intake Records</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>

                {/* Advanced Filters Sheet */}
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="relative" data-testid="button-advanced-filters">
                      <SlidersHorizontal className="w-4 h-4 mr-2" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader>
                      <SheetTitle>Advanced Filters</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-6 py-6">
                      {/* Intake Type Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Intake Type</label>
                        <Select value={intakeTypeFilter} onValueChange={setIntakeTypeFilter}>
                          <SelectTrigger data-testid="select-intake-type-filter">
                            <SelectValue placeholder="All Intake Types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Intake Types</SelectItem>
                            {INTAKE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Condition Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Condition</label>
                        <Select value={conditionFilter} onValueChange={setConditionFilter}>
                          <SelectTrigger data-testid="select-condition-filter">
                            <SelectValue placeholder="All Conditions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Conditions</SelectItem>
                            {CONDITION_LEVELS.map((cond) => (
                              <SelectItem key={cond.value} value={cond.value}>{cond.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Hold Status Filter */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Hold Status</label>
                        <Select value={holdFilter} onValueChange={setHoldFilter}>
                          <SelectTrigger data-testid="select-hold-filter">
                            <SelectValue placeholder="All Hold Statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Hold Statuses</SelectItem>
                            <SelectItem value="on_hold">On Hold (Any)</SelectItem>
                            <SelectItem value="no_hold">No Hold</SelectItem>
                            {HOLD_TYPES.map((hold) => (
                              <SelectItem key={hold.value} value={hold.value}>{hold.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Clear All Filters */}
                      {hasActiveFilters && (
                        <Button 
                          variant="outline" 
                          className="w-full" 
                          onClick={clearAllFilters}
                          data-testid="button-clear-filters"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid grid-cols-4 lg:grid-cols-7 mb-4">
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="intake" data-testid="tab-intake">Intake</TabsTrigger>
                <TabsTrigger value="medical_hold" data-testid="tab-medical-hold">Medical</TabsTrigger>
                <TabsTrigger value="behavior_eval" data-testid="tab-behavior">Behavior</TabsTrigger>
                <TabsTrigger value="ready" data-testid="tab-ready" className="hidden lg:flex">Ready</TabsTrigger>
                <TabsTrigger value="adopted" data-testid="tab-adopted" className="hidden lg:flex">Adopted</TabsTrigger>
                <TabsTrigger value="transferred" data-testid="tab-transferred" className="hidden lg:flex">Transfer</TabsTrigger>
              </TabsList>

              <TabsContent value={selectedTab} className="mt-0">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-12">
                    <PawPrint className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-1">No intake records found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery ? "Try adjusting your search" : "Start by adding a new intake"}
                    </p>
                    {!searchQuery && (
                      <Button onClick={() => setShowNewIntake(true)} data-testid="button-new-intake-empty">
                        <Plus className="w-4 h-4 mr-2" />
                        New Intake
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRecords.map((record) => {
                      const dog = dogMap.get(record.dogId);
                      const isSelected = selectedRecords.has(record.id);
                      return (
                        <div key={record.id} className="relative group flex items-start gap-3">
                          <div className="pt-4">
                            <ShelterCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(record.id)}
                              data-testid={`checkbox-intake-${record.id}`}
                            />
                          </div>
                          <div className="flex-1">
                            <IntakeCard intake={record} dog={dog} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <NewIntakeDialog open={showNewIntake} onOpenChange={setShowNewIntake} />

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedRecords.size} Intake Records?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the selected intake records and their associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => bulkDeleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Records
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    
  );
}