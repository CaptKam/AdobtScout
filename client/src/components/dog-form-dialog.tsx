import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, X, ImagePlus, Loader2, Sparkles, Wand2, Camera, ChevronDown, MapPin, Heart, AlertTriangle, Check, PawPrint } from "lucide-react";
import { AnimalScanner } from "@/components/animal-scanner";
import { FormSection, FormStepper } from "@/components/form-templates";
import type { ScanResult } from "@/hooks/use-animal-scanner";

const dogFormSchema = z.object({
  animalType: z.string().min(1, "Animal type is required"),
  name: z.string().min(1, "Name is required"),
  breed: z.string().min(1, "Breed is required"),
  age: z.coerce.number().min(0).max(25, "Age must be between 0 and 25"),
  ageCategory: z.enum(["puppy", "young", "adult", "senior"]),
  size: z.enum(["small", "medium", "large"]),
  weight: z.coerce.number().min(1).max(300, "Weight must be between 1 and 300 lbs"),
  energyLevel: z.enum(["low", "moderate", "high", "very_high"]),
  temperament: z.array(z.string()).min(1, "Select at least one temperament trait"),
  goodWithKids: z.boolean(),
  goodWithDogs: z.boolean(),
  goodWithCats: z.boolean(),
  bio: z.string().min(20, "Bio must be at least 20 characters"),
  specialNeeds: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  isPublic: z.boolean(),
  vaccinated: z.boolean(),
  spayedNeutered: z.boolean(),
  urgencyLevel: z.enum(["normal", "urgent", "critical"]),
  urgencyDeadline: z.string().optional(),
  urgencyReason: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

type DogFormData = z.infer<typeof dogFormSchema>;

const TEMPERAMENT_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "playful", label: "Playful" },
  { value: "calm", label: "Calm" },
  { value: "loyal", label: "Loyal" },
  { value: "gentle", label: "Gentle" },
  { value: "protective", label: "Protective" },
  { value: "energetic", label: "Energetic" },
  { value: "independent", label: "Independent" },
];

const STEP_LABELS = ["Photos", "Basic Info", "Personality"];

interface DogFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDogId?: string | null;
  initialDogData?: any; // Pass dog data directly to avoid extra fetch
  onSuccess?: () => void;
}

export function DogFormDialog({ open, onOpenChange, editDogId, initialDogData, onSuccess }: DogFormDialogProps) {
  const { toast } = useToast();
  const isEditMode = !!editDogId;
  const [currentStep, setCurrentStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(true);

  const userModifiedIsPublic = useRef(false);

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/me"],
  });

  // Use passed data if available, otherwise fetch (fallback for direct navigation)
  const { data: fetchedDog, isLoading: loadingDog } = useQuery<any>({
    queryKey: ["/api/dogs", editDogId],
    enabled: isEditMode && open && !initialDogData,
  });
  
  const existingDog = initialDogData || fetchedDog;

  const { data: enabledAnimalTypes } = useQuery<{ id: string; label: string }[]>({
    queryKey: ["/api/animal-types"],
  });

  const isPublicDefault = currentUser?.role === 'shelter';

  const form = useForm<DogFormData>({
    resolver: zodResolver(dogFormSchema),
    defaultValues: {
      animalType: "dog",
      name: "",
      breed: "",
      age: 0,
      ageCategory: "adult",
      size: "medium",
      weight: 50,
      energyLevel: "moderate",
      temperament: [],
      goodWithKids: true,
      goodWithDogs: true,
      goodWithCats: true,
      bio: "",
      specialNeeds: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      isPublic: isPublicDefault,
      vaccinated: true,
      spayedNeutered: true,
      urgencyLevel: "normal",
      urgencyDeadline: "",
      urgencyReason: "none",
      photos: [],
    },
  });

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [generatingName, setGeneratingName] = useState(false);
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);

  useEffect(() => {
    if (existingDog && isEditMode) {
      form.reset({
        animalType: existingDog.animalType || "dog",
        name: existingDog.name,
        breed: existingDog.breed,
        age: existingDog.age,
        ageCategory: existingDog.ageCategory || "adult",
        size: existingDog.size,
        weight: existingDog.weight || 50,
        energyLevel: existingDog.energyLevel || "moderate",
        temperament: existingDog.temperament || [],
        goodWithKids: existingDog.goodWithKids ?? true,
        goodWithDogs: existingDog.goodWithDogs ?? true,
        goodWithCats: existingDog.goodWithCats ?? true,
        bio: existingDog.bio || "",
        specialNeeds: existingDog.specialNeeds || "",
        address: existingDog.address || "",
        city: existingDog.city || "",
        state: existingDog.state || "",
        zipCode: existingDog.zipCode || "",
        isPublic: existingDog.isPublic ?? isPublicDefault,
        vaccinated: existingDog.vaccinated ?? true,
        spayedNeutered: existingDog.spayedNeutered ?? true,
        urgencyLevel: existingDog.urgencyLevel || "normal",
        urgencyDeadline: existingDog.urgencyDeadline || "",
        urgencyReason: existingDog.urgencyReason || "none",
        photos: existingDog.photos || [],
      });
      setPhotos(existingDog.photos || []);
    }
  }, [existingDog, isEditMode, form, isPublicDefault]);

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setPhotos([]);
      setSuggestedNames([]);
      setShowAdvanced(false);
      form.reset();
    }
  }, [open, form]);

  const handleGenerateName = async () => {
    setGeneratingName(true);
    try {
      const breed = form.getValues('breed') || 'mixed breed dog';
      const size = form.getValues('size') || 'medium';
      
      const response = await fetch('/api/generate-pet-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breed, size }),
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.names && data.names.length > 0) {
          setSuggestedNames(data.names);
          form.setValue('name', data.names[0]);
          toast({
            title: "Names generated!",
            description: `Try "${data.names[0]}" or pick another from the suggestions.`,
          });
        }
      }
    } catch (error) {
      toast({
        title: "Couldn't generate names",
        description: "Please enter a name manually.",
        variant: "destructive",
      });
    } finally {
      setGeneratingName(false);
    }
  };

  const handleScanComplete = async (result: ScanResult) => {
    if (result.breed) form.setValue('breed', result.breed);
    if (result.size) form.setValue('size', result.size);
    if (result.ageCategory) form.setValue('ageCategory', result.ageCategory);
    if (result.energyLevel) form.setValue('energyLevel', result.energyLevel);
    
    if (result.suggestedTemperament && result.suggestedTemperament.length > 0) {
      const validTemperaments = result.suggestedTemperament.filter((t: string) => 
        TEMPERAMENT_OPTIONS.some(opt => opt.value === t.toLowerCase())
      ).map((t: string) => t.toLowerCase());
      if (validTemperaments.length > 0) {
        form.setValue('temperament', validTemperaments);
      }
    }
    
    if (result.estimatedWeight) {
      const weightMatch = result.estimatedWeight.match(/(\d+)/);
      if (weightMatch) {
        form.setValue('weight', parseInt(weightMatch[1]));
      }
    }

    const resultWithImage = result as ScanResult & { imageBase64?: string };
    if (resultWithImage.imageBase64) {
      setPhotos(prev => [resultWithImage.imageBase64!, ...prev]);
      form.setValue('photos', [resultWithImage.imageBase64!, ...photos]);
    }
    
    setShowScanner(false);
    toast({
      title: "AI Analysis Complete",
      description: `Identified as ${result.breed}. Form fields have been auto-filled.`,
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    
    try {
      const newPhotos: string[] = [];
      
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newPhotos.push(base64);
      }
      
      setPhotos(prev => [...prev, ...newPhotos]);
      form.setValue('photos', [...photos, ...newPhotos]);
      
      toast({
        title: "Photos uploaded",
        description: `${newPhotos.length} photo(s) added successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload photos. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    form.setValue('photos', newPhotos);
  };

  const createDogMutation = useMutation({
    mutationFn: async (data: DogFormData) => {
      const endpoint = isEditMode ? `/api/dogs/${editDogId}` : '/api/dogs';
      const method = isEditMode ? 'PUT' : 'POST';
      
      const response = await apiRequest(method, endpoint, {
        ...data,
        photos: photos,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save pet');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/dogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/dogs'] });
      
      toast({
        title: isEditMode ? "Pet Updated" : "Pet Created",
        description: isEditMode 
          ? "The pet profile has been updated successfully."
          : "The pet profile has been created successfully.",
      });
      
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DogFormData) => {
    createDogMutation.mutate(data);
  };

  const temperamentValue = form.watch('temperament') || [];

  const nextStep = () => {
    if (currentStep < STEP_LABELS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden" data-testid="dialog-dog-form">
        <DialogHeader className="p-4 sm:p-6 pb-0 space-y-4">
          <DialogTitle data-testid="text-dialog-title">
            {isEditMode ? 'Edit Pet Profile' : 'Add a New Pet'}
          </DialogTitle>
          <FormStepper totalSteps={3} currentStep={currentStep} stepLabels={STEP_LABELS} />
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] px-4 sm:px-6">
          {loadingDog && !initialDogData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <Form {...form}>
              <form id="dog-form-dialog" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">
                
                {currentStep === 0 && (
                  <Card className="overflow-hidden">
                    <CardContent className="p-4 space-y-4">
                      <FormSection
                        title="Pet Photos"
                        description="Add photos to help adopters fall in love"
                        icon={Camera}
                        variant="ai"
                      />
                      
                      {showScanner && (
                        <AnimalScanner
                          onScanComplete={handleScanComplete}
                          onClose={() => setShowScanner(false)}
                        />
                      )}
                      
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3" data-testid="grid-photos">
                        <label 
                          className={`aspect-square rounded-xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all ${uploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}
                          data-testid="button-add-photo"
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            className="hidden"
                            disabled={uploadingPhoto}
                          />
                          {uploadingPhoto ? (
                            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                          ) : (
                            <>
                              <ImagePlus className="w-6 h-6 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground mt-1">Add</span>
                            </>
                          )}
                        </label>

                        <button
                          type="button"
                          onClick={() => setShowScanner(true)}
                          className="aspect-square rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/10 transition-all relative"
                          data-testid="button-open-scanner"
                        >
                          <Camera className="w-6 h-6 text-primary" />
                          <span className="text-xs text-primary mt-1 font-medium">AI Scan</span>
                          <Badge variant="secondary" className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            New
                          </Badge>
                        </button>
                        
                        {photos.map((photo, index) => (
                          <div 
                            key={index} 
                            className="relative aspect-square rounded-xl overflow-hidden bg-muted group"
                            data-testid={`photo-thumbnail-${index}`}
                          >
                            <img 
                              src={photo} 
                              alt={`Photo ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                              data-testid={`button-remove-photo-${index}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {currentStep === 1 && (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <FormSection
                        title="Basic Information"
                        description="Core details about your pet"
                        icon={PawPrint}
                        variant="ai"
                      />

                      {enabledAnimalTypes && enabledAnimalTypes.length > 1 && (
                        <FormField
                          control={form.control}
                          name="animalType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Animal Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-animal-type">
                                    <SelectValue placeholder="Select animal type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {enabledAnimalTypes.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <div className="flex gap-2">
                                <FormControl>
                                  <Input placeholder="Pet name" {...field} data-testid="input-name" />
                                </FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={handleGenerateName}
                                  disabled={generatingName}
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
                                  {suggestedNames.map((name, i) => (
                                    <Badge
                                      key={i}
                                      variant="secondary"
                                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                      onClick={() => form.setValue('name', name)}
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
                          control={form.control}
                          name="breed"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Breed</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Golden Retriever" {...field} data-testid="input-breed" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="age"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Age (years)</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} max={25} {...field} data-testid="input-age" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ageCategory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Age Category</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-age-category">
                                    <SelectValue placeholder="Select age category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="puppy">Puppy (0-1 year)</SelectItem>
                                  <SelectItem value="young">Young (1-3 years)</SelectItem>
                                  <SelectItem value="adult">Adult (3-7 years)</SelectItem>
                                  <SelectItem value="senior">Senior (7+ years)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="size"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Size</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-size">
                                    <SelectValue placeholder="Select size" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="small">Small (under 25 lbs)</SelectItem>
                                  <SelectItem value="medium">Medium (25-50 lbs)</SelectItem>
                                  <SelectItem value="large">Large (50+ lbs)</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="weight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Weight (lbs)</FormLabel>
                              <FormControl>
                                <Input type="number" min={1} max={300} {...field} data-testid="input-weight" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bio</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Tell adopters about this pet's personality, history, and what makes them special..."
                                className="min-h-[100px]"
                                {...field} 
                                data-testid="textarea-bio"
                              />
                            </FormControl>
                            <FormDescription>Minimum 20 characters</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                )}

                {currentStep === 2 && (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <FormSection
                        title="Personality & Compatibility"
                        description="Help adopters understand your pet's character"
                        icon={Heart}
                        variant="ai"
                      />

                      <FormField
                        control={form.control}
                        name="temperament"
                        render={() => (
                          <FormItem>
                            <FormLabel>Personality Traits</FormLabel>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {TEMPERAMENT_OPTIONS.map((option) => {
                                const isSelected = temperamentValue.includes(option.value);
                                return (
                                  <Badge
                                    key={option.value}
                                    variant={isSelected ? "default" : "outline"}
                                    className={`cursor-pointer ${isSelected ? "" : "hover:bg-muted"}`}
                                    onClick={() => {
                                      const newValue = isSelected
                                        ? temperamentValue.filter((v) => v !== option.value)
                                        : [...temperamentValue, option.value];
                                      form.setValue('temperament', newValue);
                                    }}
                                    data-testid={`badge-temperament-${option.value}`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 mr-1" />}
                                    {option.label}
                                  </Badge>
                                );
                              })}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="energyLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Energy Level</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-energy-level">
                                  <SelectValue placeholder="Select energy level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low - Couch potato</SelectItem>
                                <SelectItem value="moderate">Moderate - Daily walks</SelectItem>
                                <SelectItem value="high">High - Active lifestyle</SelectItem>
                                <SelectItem value="very_high">Very High - Athlete</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-3">
                        <FormLabel>Good With</FormLabel>
                        <div className="flex flex-wrap gap-4">
                          <FormField
                            control={form.control}
                            name="goodWithKids"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-good-with-kids"
                                  />
                                </FormControl>
                                <FormLabel className="!mt-0 cursor-pointer">Kids</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="goodWithDogs"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-good-with-dogs"
                                  />
                                </FormControl>
                                <FormLabel className="!mt-0 cursor-pointer">Dogs</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="goodWithCats"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    data-testid="checkbox-good-with-cats"
                                  />
                                </FormControl>
                                <FormLabel className="!mt-0 cursor-pointer">Cats</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="w-full justify-between" type="button">
                            <span>Advanced Options</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vaccinated"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2">
                                  <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="!mt-0">Vaccinated</FormLabel>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="spayedNeutered"
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2">
                                  <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                  </FormControl>
                                  <FormLabel className="!mt-0">Spayed/Neutered</FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="isPublic"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <FormLabel className="!mt-0">Public listing</FormLabel>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="urgencyLevel"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Urgency Level</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-urgency">
                                      <SelectValue placeholder="Select urgency" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                    <SelectItem value="critical">Critical</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {form.getValues('urgencyLevel') !== 'normal' && (
                            <>
                              <FormField
                                control={form.control}
                                name="urgencyDeadline"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Deadline (Optional)</FormLabel>
                                    <FormControl>
                                      <Input type="date" {...field} data-testid="input-urgency-deadline" />
                                    </FormControl>
                                    <FormDescription>Target adoption date if applicable</FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="urgencyReason"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Why Urgent? (Optional)</FormLabel>
                                    <FormControl>
                                      <Textarea 
                                        placeholder="Space constraints, medical urgency, behavioral concerns, etc."
                                        className="min-h-[60px]"
                                        {...field} 
                                        data-testid="textarea-urgency-reason"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </>
                          )}

                          <div className="pt-4 border-t">
                            <FormLabel className="text-base font-semibold mb-4 block">Location Information (Optional)</FormLabel>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Address</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Street address" {...field} data-testid="input-address" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">City</FormLabel>
                                    <FormControl>
                                      <Input placeholder="City" {...field} data-testid="input-city" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="state"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">State</FormLabel>
                                    <FormControl>
                                      <Input placeholder="State" {...field} data-testid="input-state" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="zipCode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-sm">Zip Code</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Zip code" {...field} data-testid="input-zip-code" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          <FormField
                            control={form.control}
                            name="specialNeeds"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Special Needs (Optional)</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Any medical conditions, behavioral notes, or special requirements..."
                                    className="min-h-[80px]"
                                    {...field} 
                                    data-testid="textarea-special-needs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>
                )}
              </form>
            </Form>
          )}
        </ScrollArea>

        <div className="p-4 sm:p-6 pt-0 border-t bg-background flex justify-between gap-3">
          {currentStep > 0 ? (
            <Button type="button" variant="outline" onClick={prevStep} data-testid="button-prev-step">
              Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Cancel
            </Button>
          )}
          
          {currentStep < STEP_LABELS.length - 1 ? (
            <Button type="button" onClick={nextStep} data-testid="button-next-step">
              Continue
            </Button>
          ) : (
            <Button 
              type="submit"
              form="dog-form-dialog"
              disabled={createDogMutation.isPending}
              data-testid="button-submit"
            >
              {createDogMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditMode ? 'Update Pet' : 'Create Pet'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
