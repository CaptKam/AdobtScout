
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { User, Heart, ArrowRight, ArrowLeft, Dog, Home, Calendar, Zap, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";

interface OwnerInfo {
  fullName: string;
  location: string;
  email: string;
  phone: string;
  reason: string;
  // Dog information
  dogName: string;
  dogAge: string;
  dogSize: string;
  dogEnergy: string;
  goodWith: string[];
  specialNeeds: string;
}

export default function OwnerOnboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [formData, setFormData] = useState<OwnerInfo>({
    fullName: "",
    location: "",
    email: "",
    phone: "",
    reason: "",
    dogName: "",
    dogAge: "",
    dogSize: "",
    dogEnergy: "",
    goodWith: [],
    specialNeeds: "",
  });

  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  // Check if owner profile already exists
  const { data: ownerProfile } = useQuery({
    queryKey: ["/api/owner/profile"],
    retry: false,
  });

  // Redirect to dashboard if profile already exists
  useEffect(() => {
    if (ownerProfile) {
      console.log("[OwnerOnboarding] Profile already exists, redirecting to dashboard");
      setLocation("/owner-dashboard");
    }
  }, [ownerProfile, setLocation]);

  // Auto-detect location when component mounts
  useEffect(() => {
    const getLocation = async () => {
      if (!navigator.geolocation) {
        toast({
          title: "Location not supported",
          description: "Please enter your location manually.",
        });
        return;
      }

      setIsLoadingLocation(true);
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // Use OpenStreetMap's Nominatim API for reverse geocoding
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            
            // Extract city and state
            const city = data.address?.city || data.address?.town || data.address?.village || "";
            const state = data.address?.state || "";
            
            if (city && state) {
              handleChange("location", `${city}, ${state}`);
              toast({
                title: "Location detected!",
                description: `${city}, ${state}`,
              });
            } else {
              toast({
                title: "Location found",
                description: "Please verify the location below.",
              });
              handleChange("location", data.display_name || "");
            }
          } catch (error) {
            console.error("Reverse geocoding error:", error);
            toast({
              title: "Could not detect city",
              description: "Please enter your location manually.",
            });
          } finally {
            setIsLoadingLocation(false);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setIsLoadingLocation(false);
          
          let message = "Please enter your location manually.";
          if (error.code === error.PERMISSION_DENIED) {
            message = "Location permission denied. Please enter manually.";
          }
          
          toast({
            title: "Location unavailable",
            description: message,
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    };

    getLocation();
  }, []);

  const mutation = useMutation({
    mutationFn: async (data: OwnerInfo) => {
      return await apiRequest("POST", "/api/owner/onboard", data);
    },
    onSuccess: () => {
      toast({
        title: "Welcome to Scout!",
        description: "Your profile is ready. You can now add photos and more details about your dog.",
      });
      setLocation("/owner-dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create owner profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (field: keyof OwnerInfo, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMultiSelect = (field: keyof OwnerInfo, value: string) => {
    const current = formData[field] as string[] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    handleChange(field, updated);
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  // Step 0: Owner Contact Information
  if (step === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <Progress value={progress} className="mb-8" />

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Heart className="w-8 h-8 text-primary-foreground fill-current" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">Step {step + 1} of {totalSteps}</p>
            <h1 className="font-serif text-4xl font-bold mb-2">Find Your Dog a Loving Home</h1>
            <p className="text-muted-foreground text-lg">
              We'll help you find the perfect match for your beloved companion
            </p>
          </div>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Your Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Your Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                    required
                    data-testid="input-full-name"
                  />
                </div>

                <div>
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Location (City, State) *
                  </Label>
                  <Input
                    id="location"
                    placeholder={isLoadingLocation ? "Detecting your location..." : "Austin, TX"}
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    required
                    disabled={isLoadingLocation}
                    data-testid="input-location"
                  />
                  {isLoadingLocation && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Getting your location...
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Contact Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      required
                      data-testid="input-email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      required
                      data-testid="input-phone"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="reason">Why are you rehoming your dog? *</Label>
                  <Textarea
                    id="reason"
                    placeholder="Help adopters understand your situation. This helps us find the right home for your dog..."
                    value={formData.reason}
                    onChange={(e) => handleChange("reason", e.target.value)}
                    rows={4}
                    required
                    data-testid="input-reason"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This information is kept private and helps us match your dog with the right family
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 0}
              >
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!formData.fullName || !formData.location || !formData.email || !formData.phone || !formData.reason}
                data-testid="button-continue"
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Step 1: About Your Dog
  if (step === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <Progress value={progress} className="mb-8" />

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Dog className="w-8 h-8 text-primary-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">Step {step + 1} of {totalSteps}</p>
            <h2 className="font-serif text-3xl font-bold mb-2">Tell Us About Your Dog</h2>
            <p className="text-muted-foreground">
              Help us understand your dog's personality and needs
            </p>
          </div>

          <Card className="shadow-xl">
            <CardContent className="pt-6 space-y-6">
              <div>
                <Label htmlFor="dogName">Dog's Name *</Label>
                <Input
                  id="dogName"
                  placeholder="Buddy"
                  value={formData.dogName}
                  onChange={(e) => handleChange("dogName", e.target.value)}
                  required
                  data-testid="input-dog-name"
                />
              </div>

              <div>
                <Label>Age Range *</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: "puppy", label: "Puppy (0-1 year)", icon: Calendar },
                    { value: "young", label: "Young (1-3 years)", icon: Calendar },
                    { value: "adult", label: "Adult (3-7 years)", icon: Calendar },
                    { value: "senior", label: "Senior (7+ years)", icon: Calendar },
                  ].map((option) => {
                    const isSelected = formData.dogAge === option.value;
                    return (
                      <Card
                        key={option.value}
                        className={`cursor-pointer transition-all border-2 ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-card-border hover-elevate"
                        }`}
                        onClick={() => handleChange("dogAge", option.value)}
                      >
                        <CardContent className="p-3 flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected ? "bg-primary/20" : "bg-card/50"
                          }`}>
                            <option.icon className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <span className={`text-sm ${isSelected ? "font-semibold" : ""}`}>
                            {option.label}
                          </span>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Size *</Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[
                    { value: "small", label: "Small", sublabel: "Under 25 lbs" },
                    { value: "medium", label: "Medium", sublabel: "25-60 lbs" },
                    { value: "large", label: "Large", sublabel: "Over 60 lbs" },
                  ].map((option) => {
                    const isSelected = formData.dogSize === option.value;
                    return (
                      <Card
                        key={option.value}
                        className={`cursor-pointer transition-all border-2 ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-card-border hover-elevate"
                        }`}
                        onClick={() => handleChange("dogSize", option.value)}
                      >
                        <CardContent className="p-3 text-center">
                          <Dog className={`w-6 h-6 mx-auto mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <div className={`text-sm font-semibold ${isSelected ? "text-primary" : ""}`}>
                            {option.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{option.sublabel}</div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Energy Level *</Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[
                    { value: "low", label: "Calm & cuddly 💤", icon: Home },
                    { value: "medium", label: "Balanced energy", icon: Dog },
                    { value: "high", label: "Playful & active 🎾", icon: Zap },
                  ].map((option) => {
                    const isSelected = formData.dogEnergy === option.value;
                    return (
                      <Card
                        key={option.value}
                        className={`cursor-pointer transition-all border-2 ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-card-border hover-elevate"
                        }`}
                        onClick={() => handleChange("dogEnergy", option.value)}
                      >
                        <CardContent className="p-3 flex flex-col items-center gap-1">
                          <option.icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs text-center ${isSelected ? "font-semibold" : ""}`}>
                            {option.label}
                          </span>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={!formData.dogName || !formData.dogAge || !formData.dogSize || !formData.dogEnergy}
              >
                Continue
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Step 2: Compatibility & Special Needs
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <Progress value={progress} className="mb-8" />

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Heart className="w-8 h-8 text-primary-foreground fill-current" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">Step {step + 1} of {totalSteps}</p>
            <h2 className="font-serif text-3xl font-bold mb-2">Almost Done!</h2>
            <p className="text-muted-foreground">
              Final details to help find the perfect match
            </p>
          </div>

          <Card className="shadow-xl">
            <CardContent className="pt-6 space-y-6">
              <div>
                <Label>Good With (Select all that apply)</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: "kids", label: "Children" },
                    { value: "dogs", label: "Other Dogs" },
                    { value: "cats", label: "Cats" },
                    { value: "seniors", label: "Seniors" },
                  ].map((option) => {
                    const isSelected = formData.goodWith.includes(option.value);
                    return (
                      <Card
                        key={option.value}
                        className={`cursor-pointer transition-all border-2 ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-card-border hover-elevate"
                        }`}
                        onClick={() => handleMultiSelect("goodWith", option.value)}
                      >
                        <CardContent className="p-3 flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected ? "bg-primary/20" : "bg-card/50"
                          }`}>
                            {isSelected ? (
                              <Heart className="w-4 h-4 text-primary fill-primary" />
                            ) : (
                              <Heart className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className={`text-sm ${isSelected ? "font-semibold" : ""}`}>
                            {option.label}
                          </span>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="specialNeeds">Any Special Needs or Medical Conditions?</Label>
                <Textarea
                  id="specialNeeds"
                  placeholder="E.g., needs medication, has dietary restrictions, anxiety issues, etc. Leave blank if none."
                  value={formData.specialNeeds}
                  onChange={(e) => handleChange("specialNeeds", e.target.value)}
                  rows={4}
                  data-testid="input-special-needs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Being honest about special needs helps us find the best prepared home
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={mutation.isPending}
                data-testid="button-complete-setup"
              >
                {mutation.isPending ? "Creating Profile..." : "Complete Setup"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            After setup, you can add photos and more details about your dog
          </p>
        </div>
      </div>
    );
  }

  return null;
}
