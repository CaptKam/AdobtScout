import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Upload, X, ImagePlus, Loader2, Sparkles, Wand2, Camera, ChevronDown, MapPin, Heart, AlertTriangle, Check, PawPrint, User } from "lucide-react";
import { AnimalScanner, ScannerTriggerButton } from "@/components/animal-scanner";
import { FormSection } from "@/components/form-templates";
import type { ScanResult } from "@/hooks/use-animal-scanner";

// Form validation schema
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

export default function DogForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const searchParams = new URLSearchParams(window.location.search);
  const editDogId = searchParams.get('edit');
  const isEditMode = !!editDogId;
  const isEmbedded = searchParams.get('embedded') === 'true';

  const userModifiedIsPublic = useRef(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/me"],
  });

  const { data: existingDog, isLoading: loadingDog } = useQuery<any>({
    queryKey: ["/api/dogs", editDogId],
    enabled: isEditMode,
  });

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
  const [photoBase64Data, setPhotoBase64Data] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [generatingName, setGeneratingName] = useState(false);
  const [suggestedNames, setSuggestedNames] = useState<string[]>([]);

  // Generate AI pet name suggestions
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

  const handleScanComplete = async (result: ScanResult) => {
    setAnalysisResult(result);
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
    
    if (result.suggestedGoodWithKids !== null && result.suggestedGoodWithKids !== undefined) {
      form.setValue('goodWithKids', result.suggestedGoodWithKids);
    }
    if (result.suggestedGoodWithDogs !== null && result.suggestedGoodWithDogs !== undefined) {
      form.setValue('goodWithDogs', result.suggestedGoodWithDogs);
    }
    if (result.suggestedGoodWithCats !== null && result.suggestedGoodWithCats !== undefined) {
      form.setValue('goodWithCats', result.suggestedGoodWithCats);
    }
    
    if (result.estimatedWeight) {
      const weightMatch = result.estimatedWeight.match(/(\d+)/);
      if (weightMatch) {
        form.setValue('weight', parseInt(weightMatch[1]));
      }
    }
    
    // Handle image from scanner if available
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

  useEffect(() => {
    if (existingDog) {
      form.reset({
        animalType: existingDog.animalType || "dog",
        name: existingDog.name,
        breed: existingDog.breed,
        age: existingDog.age,
        ageCategory: existingDog.ageCategory,
        size: existingDog.size,
        weight: existingDog.weight || 50,
        energyLevel: existingDog.energyLevel,
        temperament: existingDog.temperament || [],
        goodWithKids: existingDog.goodWithKids,
        goodWithDogs: existingDog.goodWithDogs,
        goodWithCats: existingDog.goodWithCats,
        bio: existingDog.bio,
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
  }, [existingDog, form, isPublicDefault]);

  useEffect(() => {
    if (currentUser && !existingDog && !userModifiedIsPublic.current) {
      form.setValue('isPublic', currentUser.role === 'shelter');
    }
  }, [currentUser, existingDog, form]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setUploadingPhoto(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          setPhotoBase64Data(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');

        const { url } = await response.json();
        setPhotos(prev => [...prev, url]);
        form.setValue('photos', [...photos, url]);
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload photo. Please try again.",
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
    setPhotoBase64Data(prev => prev.filter((_, i) => i !== index));
  };

  const analyzePhotoWithAI = async () => {
    if (photoBase64Data.length === 0 && photos.length === 0) {
      toast({
        title: "No photo available",
        description: "Please upload a photo first to use AI analysis.",
        variant: "destructive",
      });
      return;
    }

    setAnalyzingPhoto(true);
    try {
      const imageToAnalyze = photoBase64Data[0] || photos[0];
      const response = await apiRequest("POST", "/api/ai/analyze-photo", {
        image: imageToAnalyze,
      });

      if (!response.ok) throw new Error('Analysis failed');

      const result = await response.json();
      setAnalysisResult(result);

      if (result.breed) form.setValue('breed', result.breed);
      if (result.size) form.setValue('size', result.size);
      if (result.ageCategory) form.setValue('ageCategory', result.ageCategory);
      if (result.energyLevel) form.setValue('energyLevel', result.energyLevel);
      if (result.suggestedTemperament) {
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

      toast({
        title: "Analysis Complete",
        description: `Identified as ${result.breed}. Fields have been auto-filled.`,
      });
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: "Failed to analyze photo. Please fill in details manually.",
        variant: "destructive",
      });
    } finally {
      setAnalyzingPhoto(false);
    }
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
      
      if (isEmbedded) {
        window.parent.postMessage({ type: 'DOG_FORM_SUCCESS' }, '*');
      } else if (currentUser?.role === 'shelter') {
        navigate('/shelter-dashboard/dogs');
      } else {
        navigate('/profile');
      }
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

  if (loadingDog) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const temperamentValue = form.watch('temperament') || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      {!isEmbedded && (
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.history.back()}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold" data-testid="text-page-title">
                {isEditMode ? 'Edit Profile' : 'Add a Pet'}
              </h1>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 pb-32">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Photo Upload - Clean Card */}
            <Card className="overflow-hidden">
              <CardContent className="p-4 sm:p-6 space-y-4">
                <FormSection
                  title="Pet Photos"
                  description="Add photos to help adopters fall in love"
                  icon={Camera}
                  variant="ai"
                />
                {/* AI Scanner */}
                {showScanner && (
                  <AnimalScanner
                    onScanComplete={handleScanComplete}
                    onClose={() => setShowScanner(false)}
                  />
                )}
                
                {/* Photo Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3" data-testid="grid-photos">
                  {/* Add Photo Button - First position */}
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
                      data-testid="input-photo-file"
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

                  {/* AI Scan Button - Second position */}
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
                  
                  {/* Existing Photos */}
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
                        data-testid={`img-photo-${index}`}
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-photo-${index}`}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                      {index === 0 && (
                        <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-medium" data-testid="badge-main-photo">
                          Main
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* AI Actions */}
                {photos.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => analyzePhotoWithAI()}
                      disabled={analyzingPhoto}
                      className="gap-1.5"
                      data-testid="button-analyze-photo"
                    >
                      {analyzingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                      Auto-fill
                    </Button>
                    {analysisResult && (
                      <Badge variant="secondary" className="gap-1">
                        <Check className="w-3 h-3" />
                        {analysisResult.breed}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Basic Info */}
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <FormSection
                  title="Basic Information"
                  description="Core details about your pet"
                  icon={PawPrint}
                  variant="ai"
                />
                {/* Animal Type - only if multiple types enabled */}
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
                              <SelectValue placeholder="Select type" />
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

                {/* Name & Breed */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input placeholder="Buddy" {...field} data-testid="input-dog-name" />
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
                                onClick={() => form.setValue('name', name)}
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
                    control={form.control}
                    name="breed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Breed</FormLabel>
                        <FormControl>
                          <Input placeholder="Golden Retriever" {...field} data-testid="input-dog-breed" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Age, Size, Energy - Single Row */}
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="ageCategory"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Age</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-age-category">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="puppy">Puppy</SelectItem>
                            <SelectItem value="young">Young</SelectItem>
                            <SelectItem value="adult">Adult</SelectItem>
                            <SelectItem value="senior">Senior</SelectItem>
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
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="energyLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Energy</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-energy-level">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="very_high">Very High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Personality - Toggle Chips */}
            <Card>
              <CardContent className="p-4 sm:p-6 space-y-4">
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
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                const current = form.getValues('temperament') || [];
                                if (isSelected) {
                                  form.setValue('temperament', current.filter((v) => v !== option.value));
                                } else {
                                  form.setValue('temperament', [...current, option.value]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                              }`}
                              data-testid={`chip-temperament-${option.value}`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Good With - Inline */}
                <div className="pt-2">
                  <FormLabel className="text-sm">Good with</FormLabel>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <FormField
                      control={form.control}
                      name="goodWithKids"
                      render={({ field }) => (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-good-with-kids" />
                          <span className="text-sm">Children</span>
                        </label>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="goodWithDogs"
                      render={({ field }) => (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-good-with-dogs" />
                          <span className="text-sm">Dogs</span>
                        </label>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="goodWithCats"
                      render={({ field }) => (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-good-with-cats" />
                          <span className="text-sm">Cats</span>
                        </label>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bio */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>About</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Share what makes this pet special..."
                          className="min-h-24 resize-none"
                          {...field}
                          data-testid="textarea-bio"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Map Visibility Toggle */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${field.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">Show on map</div>
                          <div className="text-xs text-muted-foreground">
                            {field.value ? 'Visible to adopters' : 'Hidden from searches'}
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          userModifiedIsPublic.current = true;
                          field.onChange(checked);
                        }}
                        data-testid="switch-is-public"
                      />
                    </div>
                  )}
                />
              </CardContent>
            </Card>

            {/* Advanced Options - Collapsible */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between text-muted-foreground" type="button">
                  <span>More options</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Detailed Info */}
                <Card>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Age (years)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} data-testid="input-dog-age" />
                            </FormControl>
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
                              <Input type="number" {...field} data-testid="input-dog-weight" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="specialNeeds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Needs</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Medical conditions, dietary needs..."
                              className="min-h-16 resize-none"
                              {...field}
                              data-testid="textarea-special-needs"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Health */}
                    <div className="flex flex-wrap gap-4">
                      <FormField
                        control={form.control}
                        name="vaccinated"
                        render={({ field }) => (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-vaccinated" />
                            <span className="text-sm">Vaccinated</span>
                          </label>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="spayedNeutered"
                        render={({ field }) => (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-spayed-neutered" />
                            <span className="text-sm">Spayed/Neutered</span>
                          </label>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Location */}
                <Card>
                  <CardContent className="p-4 sm:p-6 space-y-4">
                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} data-testid="input-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="Austin" {...field} data-testid="input-city" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="state"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="TX" {...field} data-testid="input-state" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="zipCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zip</FormLabel>
                            <FormControl>
                              <Input placeholder="78701" {...field} data-testid="input-zip" />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Urgency - Shelters Only */}
                {currentUser?.role === 'shelter' && (
                  <Card className="border-amber-200 dark:border-amber-800">
                    <CardContent className="p-4 sm:p-6 space-y-4">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium text-sm">Urgency Status</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          control={form.control}
                          name="urgencyLevel"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Level</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-urgency-level">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="normal">Normal</SelectItem>
                                  <SelectItem value="urgent">Urgent</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="urgencyDeadline"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Deadline</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} data-testid="input-urgency-deadline" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="urgencyReason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reason</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || "none"}>
                              <FormControl>
                                <SelectTrigger data-testid="select-urgency-reason">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="space">Space constraints</SelectItem>
                                <SelectItem value="medical">Medical needs</SelectItem>
                                <SelectItem value="behavior">Behavior concerns</SelectItem>
                                <SelectItem value="euthanasia_list">On euthanasia list</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Submit Button - Fixed at bottom */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t">
              <div className="max-w-2xl mx-auto flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.history.back()}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createDogMutation.isPending}
                  data-testid="button-submit"
                >
                  {createDogMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isEditMode ? (
                    'Save Changes'
                  ) : (
                    'Create Profile'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
