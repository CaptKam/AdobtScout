import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Heart, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface ShelterInfo {
  shelterName: string;
  location: string;
  email: string;
  phone: string;
  licenseNumber: string;
  description: string;
}

export default function ShelterOnboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [formData, setFormData] = useState<ShelterInfo>({
    shelterName: "",
    location: "",
    email: "",
    phone: "",
    licenseNumber: "",
    description: "",
  });

  const mutation = useMutation({
    mutationFn: async (data: ShelterInfo) => {
      return await apiRequest("POST", "/api/shelter/onboard", data);
    },
    onSuccess: () => {
      toast({
        title: "Welcome to Scout!",
        description: "Your shelter profile has been created successfully.",
      });
      setLocation("/shelter/operations");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create shelter profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (field: keyof ShelterInfo, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Heart className="w-8 h-8 text-primary-foreground fill-current" />
          </div>
          <h1 className="font-serif text-4xl font-bold mb-2">Welcome to Scout</h1>
          <p className="text-muted-foreground text-lg">
            Let's set up your shelter profile to start connecting dogs with their perfect families
          </p>
        </div>

        {/* Form Card */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Shelter Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="shelterName">Shelter Name *</Label>
                  <Input
                    id="shelterName"
                    placeholder="Happy Tails Rescue"
                    value={formData.shelterName}
                    onChange={(e) => handleChange("shelterName", e.target.value)}
                    required
                    data-testid="input-shelter-name"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location (City, State) *</Label>
                  <Input
                    id="location"
                    placeholder="Austin, TX"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    required
                    data-testid="input-location"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Contact Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="contact@shelter.org"
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
                  <Label htmlFor="licenseNumber">License / Registration Number</Label>
                  <Input
                    id="licenseNumber"
                    placeholder="Optional - helps verify your shelter"
                    value={formData.licenseNumber}
                    onChange={(e) => handleChange("licenseNumber", e.target.value)}
                    data-testid="input-license"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Verified shelters receive a trust badge
                  </p>
                </div>

                <div>
                  <Label htmlFor="description">About Your Shelter</Label>
                  <Textarea
                    id="description"
                    placeholder="Tell adopters about your mission, the pets you rescue, and what makes your shelter special..."
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    rows={4}
                    data-testid="input-description"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={mutation.isPending}
                data-testid="button-complete-setup"
              >
                {mutation.isPending ? "Creating Profile..." : "Complete Setup"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          After setup, you'll be able to add pets, manage listings, and connect with adopters
        </p>
      </div>
    </div>
  );
}
