import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, User, Shield, Camera, Home, FileCheck, ClipboardCheck, Save, Dog, Cat, Bird, Rabbit, Fish, Tractor, PawPrint } from "lucide-react";
import { FaHorse } from "react-icons/fa";
import { LuMouse } from "react-icons/lu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ANIMAL_TYPES } from "@shared/schema";

interface AdoptionRequirements {
  id?: string;
  requireCompletedProfile: boolean;
  requirePhoneNumber: boolean;
  requireProfilePhoto: boolean;
  requireIdVerification: boolean;
  requireBackgroundCheck: boolean;
  requireHomePhotos: boolean;
  requirePetPolicyVerification: boolean;
  requirementsMessage: string | null;
}

interface AnimalTypeSetting {
  id: string;
  enabled: boolean;
}

const ANIMAL_ICON_MAP: Record<string, any> = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  mouse: LuMouse,
  fish: Fish,
  horse: FaHorse,
  tractor: Tractor,
  paw: PawPrint,
};

export default function AdminSettings() {
  const { toast } = useToast();
  const [requirements, setRequirements] = useState<AdoptionRequirements>({
    requireCompletedProfile: true,
    requirePhoneNumber: true,
    requireProfilePhoto: false,
    requireIdVerification: false,
    requireBackgroundCheck: false,
    requireHomePhotos: false,
    requirePetPolicyVerification: false,
    requirementsMessage: null,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [animalTypes, setAnimalTypes] = useState<AnimalTypeSetting[]>(
    ANIMAL_TYPES.map(t => ({ id: t.id, enabled: t.enabled }))
  );
  const [hasAnimalChanges, setHasAnimalChanges] = useState(false);

  const { data, isLoading } = useQuery<AdoptionRequirements>({
    queryKey: ['/api/admin/adoption-requirements'],
  });

  const { data: animalTypesData, isLoading: isLoadingAnimals } = useQuery<AnimalTypeSetting[]>({
    queryKey: ['/api/admin/animal-types'],
  });

  useEffect(() => {
    if (data) {
      setRequirements(data);
    }
  }, [data]);

  useEffect(() => {
    if (animalTypesData) {
      setAnimalTypes(animalTypesData);
    }
  }, [animalTypesData]);

  const updateMutation = useMutation({
    mutationFn: async (newRequirements: Partial<AdoptionRequirements>) => {
      const response = await apiRequest("PUT", "/api/admin/adoption-requirements", newRequirements);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/adoption-requirements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/adoption-requirements'] });
      setHasChanges(false);
      toast({
        title: "Settings saved",
        description: "Adoption requirements have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof AdoptionRequirements, value: boolean) => {
    setRequirements(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleMessageChange = (value: string) => {
    setRequirements(prev => ({ ...prev, requirementsMessage: value || null }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(requirements);
  };

  const updateAnimalTypesMutation = useMutation({
    mutationFn: async (types: AnimalTypeSetting[]) => {
      const response = await apiRequest("PUT", "/api/admin/animal-types", types);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/animal-types'] });
      queryClient.invalidateQueries({ queryKey: ['/api/animal-types'] });
      setHasAnimalChanges(false);
      toast({
        title: "Settings saved",
        description: "Animal type settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save animal type settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAnimalTypeToggle = (id: string, enabled: boolean) => {
    setAnimalTypes(prev => prev.map(t => t.id === id ? { ...t, enabled } : t));
    setHasAnimalChanges(true);
  };

  const handleSaveAnimalTypes = () => {
    updateAnimalTypesMutation.mutate(animalTypes);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-6 w-11" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const requirementOptions = [
    {
      key: 'requireCompletedProfile' as const,
      label: 'Completed Profile Questionnaire',
      description: 'User must complete all onboarding questions about their lifestyle and living situation',
      icon: ClipboardCheck,
    },
    {
      key: 'requirePhoneNumber' as const,
      label: 'Phone Number',
      description: 'User must provide a valid phone number',
      icon: User,
    },
    {
      key: 'requireProfilePhoto' as const,
      label: 'Profile Photo',
      description: 'User must upload a profile photo',
      icon: Camera,
    },
    {
      key: 'requireIdVerification' as const,
      label: 'ID Verification',
      description: 'User must verify their identity (future feature)',
      icon: Shield,
      disabled: true,
    },
    {
      key: 'requireBackgroundCheck' as const,
      label: 'Background Check',
      description: 'User must pass a background check (future feature)',
      icon: FileCheck,
      disabled: true,
    },
    {
      key: 'requireHomePhotos' as const,
      label: 'Home Photos',
      description: 'User must upload photos of their home (future feature)',
      icon: Home,
      disabled: true,
    },
    {
      key: 'requirePetPolicyVerification' as const,
      label: 'Pet Policy Verification (Renters)',
      description: 'Renters must verify their landlord allows pets (future feature)',
      icon: FileCheck,
      disabled: true,
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-admin-settings">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Configure adoption requirements and platform settings
            </p>
          </div>
        </div>

        {hasChanges && (
          <Button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            data-testid="button-save-settings"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      <Card data-testid="card-adoption-requirements">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Adoption Application Requirements
          </CardTitle>
          <CardDescription>
            Configure what users must complete before they can apply for adoption.
            These requirements help ensure adopters are prepared and vetted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {requirementOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div 
                key={option.key} 
                className={`flex items-start justify-between gap-4 p-4 rounded-lg border ${
                  option.disabled ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/30'
                } transition-colors`}
                data-testid={`requirement-${option.key}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    requirements[option.key] ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <Label 
                      htmlFor={option.key} 
                      className="text-base font-medium cursor-pointer"
                    >
                      {option.label}
                      {option.disabled && (
                        <span className="ml-2 text-xs text-muted-foreground">(Coming Soon)</span>
                      )}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>
                </div>
                <Switch
                  id={option.key}
                  checked={requirements[option.key]}
                  onCheckedChange={(checked) => handleToggle(option.key, checked)}
                  disabled={option.disabled}
                  data-testid={`switch-${option.key}`}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card data-testid="card-custom-message">
        <CardHeader>
          <CardTitle>Custom Requirements Message</CardTitle>
          <CardDescription>
            This message will be shown to users who don't meet the requirements when they try to apply for adoption.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Example: To apply for adoption, please complete your profile and add a phone number. This helps us ensure the best match for you and your future companion."
            value={requirements.requirementsMessage || ''}
            onChange={(e) => handleMessageChange(e.target.value)}
            rows={3}
            data-testid="input-requirements-message"
          />
        </CardContent>
      </Card>

      <Card data-testid="card-animal-types">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PawPrint className="w-5 h-5 text-primary" />
              Allowed Animal Types
            </CardTitle>
            <CardDescription>
              Enable different animal types to allow shelters and rehomers to list them on the platform.
              Dogs are always enabled by default.
            </CardDescription>
          </div>
          {hasAnimalChanges && (
            <Button 
              onClick={handleSaveAnimalTypes} 
              disabled={updateAnimalTypesMutation.isPending}
              data-testid="button-save-animal-types"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateAnimalTypesMutation.isPending ? "Saving..." : "Save"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingAnimals ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-11" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {ANIMAL_TYPES.map((animalType) => {
                const Icon = ANIMAL_ICON_MAP[animalType.icon] || PawPrint;
                const currentSetting = animalTypes.find(t => t.id === animalType.id);
                const isEnabled = currentSetting?.enabled ?? animalType.enabled;
                const isDog = animalType.id === 'dog';

                return (
                  <div 
                    key={animalType.id} 
                    className={`flex items-center justify-between gap-4 p-4 rounded-lg border ${
                      isDog ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/30'
                    } transition-colors`}
                    data-testid={`animal-type-${animalType.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <Label 
                          htmlFor={`animal-${animalType.id}`} 
                          className="text-base font-medium cursor-pointer"
                        >
                          {animalType.label}
                          {isDog && (
                            <span className="ml-2 text-xs text-primary">(Always On)</span>
                          )}
                        </Label>
                      </div>
                    </div>
                    <Switch
                      id={`animal-${animalType.id}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleAnimalTypeToggle(animalType.id, checked)}
                      disabled={isDog}
                      data-testid={`switch-animal-${animalType.id}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">
            Note: Enabling new animal types will allow shelters to create listings for those animals. 
            The platform's matching algorithms and profiles will adapt accordingly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}