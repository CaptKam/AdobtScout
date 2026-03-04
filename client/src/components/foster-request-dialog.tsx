import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, MapPin, AlertTriangle, Dog, Clock, FileText } from "lucide-react";
import { FormStepper, FormSection, VisualCardSelector } from "@/components/form-templates";
import type { FosterProfile, Dog as DogType } from "@shared/schema";

interface FosterRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foster: FosterProfile;
}

export function FosterRequestDialog({ open, onOpenChange, foster }: FosterRequestDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"dog-info" | "request-details">("dog-info");
  
  const [dogInfo, setDogInfo] = useState({
    dogName: "",
    dogBreed: "",
    dogAge: "",
    dogSize: "",
    dogWeight: "",
    dogEnergyLevel: "",
    dogGoodWithKids: false,
    dogGoodWithDogs: false,
    dogGoodWithCats: false,
    dogSpecialNeeds: "",
    existingDogId: "",
  });
  
  const [requestDetails, setRequestDetails] = useState({
    duration: "",
    urgency: "normal",
    reason: "",
    additionalNotes: "",
  });

  const { data: myDogs } = useQuery<DogType[]>({
    queryKey: ["/api/dogs/user"],
    enabled: open,
  });

  const createRequest = useMutation({
    mutationFn: async () => {
      const payload = {
        fosterId: foster.id,
        dogId: dogInfo.existingDogId || undefined,
        dogName: dogInfo.dogName || undefined,
        dogBreed: dogInfo.dogBreed || undefined,
        dogAge: dogInfo.dogAge ? parseInt(dogInfo.dogAge) : undefined,
        dogSize: dogInfo.dogSize || undefined,
        dogWeight: dogInfo.dogWeight ? parseInt(dogInfo.dogWeight) : undefined,
        dogEnergyLevel: dogInfo.dogEnergyLevel || undefined,
        dogGoodWithKids: dogInfo.dogGoodWithKids,
        dogGoodWithDogs: dogInfo.dogGoodWithDogs,
        dogGoodWithCats: dogInfo.dogGoodWithCats,
        dogSpecialNeeds: dogInfo.dogSpecialNeeds || undefined,
        duration: requestDetails.duration,
        urgency: requestDetails.urgency,
        reason: requestDetails.reason,
        additionalNotes: requestDetails.additionalNotes || undefined,
      };
      
      return apiRequest("POST", "/api/foster-requests", payload);
    },
    onSuccess: () => {
      toast({
        title: "Request Sent",
        description: `Your foster request has been sent to ${foster.firstName}. They will review it and respond soon.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/foster-requests/sent"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send foster request",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setStep("dog-info");
    setDogInfo({
      dogName: "",
      dogBreed: "",
      dogAge: "",
      dogSize: "",
      dogWeight: "",
      dogEnergyLevel: "",
      dogGoodWithKids: false,
      dogGoodWithDogs: false,
      dogGoodWithCats: false,
      dogSpecialNeeds: "",
      existingDogId: "",
    });
    setRequestDetails({
      duration: "",
      urgency: "normal",
      reason: "",
      additionalNotes: "",
    });
  };

  const handleExistingDogSelect = (dogId: string) => {
    const selectedDog = myDogs?.find(d => d.id === dogId);
    if (selectedDog) {
      setDogInfo({
        ...dogInfo,
        existingDogId: dogId,
        dogName: selectedDog.name,
        dogBreed: selectedDog.breed,
        dogAge: selectedDog.age.toString(),
        dogSize: selectedDog.size,
        dogWeight: selectedDog.weight?.toString() || "",
        dogEnergyLevel: selectedDog.energyLevel,
        dogGoodWithKids: selectedDog.goodWithKids,
        dogGoodWithDogs: selectedDog.goodWithDogs,
        dogGoodWithCats: selectedDog.goodWithCats,
        dogSpecialNeeds: selectedDog.specialNeeds || "",
      });
    }
  };

  const initials = `${foster.firstName?.[0] || ""}${foster.lastName?.[0] || ""}`.toUpperCase() || "F";
  const displayName = [foster.firstName, foster.lastName].filter(Boolean).join(" ") || "Foster Parent";

  const canProceed = step === "dog-info" 
    ? dogInfo.dogName && dogInfo.dogBreed && dogInfo.dogSize
    : requestDetails.duration && requestDetails.reason;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Foster Help</DialogTitle>
          <DialogDescription>
            Send a request to {displayName} to foster your dog
          </DialogDescription>
        </DialogHeader>

        <FormStepper 
          currentStep={step === "dog-info" ? 1 : 2} 
          totalSteps={2}
          stepLabels={["Dog Information", "Request Details"]}
        />

        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg my-4">
          <Avatar className="w-12 h-12">
            <AvatarImage src={foster.profileImage || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{displayName}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {[foster.city, foster.state].filter(Boolean).join(", ")}
              {foster.distance && <span>• {foster.distance} mi away</span>}
            </div>
          </div>
        </div>

        {step === "dog-info" ? (
          <div className="space-y-4">
            <FormSection
              title="Tell us about your dog"
              description="We'll share this information with the foster volunteer"
              icon={Dog}
              variant="ai"
            />

            {myDogs && myDogs.length > 0 && (
              <div className="space-y-2">
                <Label>Select from your listed dogs (optional)</Label>
                <Select
                  value={dogInfo.existingDogId}
                  onValueChange={handleExistingDogSelect}
                >
                  <SelectTrigger data-testid="select-existing-dog">
                    <SelectValue placeholder="Choose an existing dog listing" />
                  </SelectTrigger>
                  <SelectContent>
                    {myDogs.map(dog => (
                      <SelectItem key={dog.id} value={dog.id}>
                        {dog.name} - {dog.breed}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Or fill in the details below for a new dog</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dog's Name *</Label>
                <Input
                  value={dogInfo.dogName}
                  onChange={e => setDogInfo({ ...dogInfo, dogName: e.target.value })}
                  placeholder="Max"
                  data-testid="input-dog-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Breed *</Label>
                <Input
                  value={dogInfo.dogBreed}
                  onChange={e => setDogInfo({ ...dogInfo, dogBreed: e.target.value })}
                  placeholder="Golden Retriever"
                  data-testid="input-dog-breed"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Age (years)</Label>
                <Input
                  type="number"
                  value={dogInfo.dogAge}
                  onChange={e => setDogInfo({ ...dogInfo, dogAge: e.target.value })}
                  placeholder="3"
                  data-testid="input-dog-age"
                />
              </div>
              <div className="space-y-2">
                <Label>Size *</Label>
                <Select
                  value={dogInfo.dogSize}
                  onValueChange={v => setDogInfo({ ...dogInfo, dogSize: v })}
                >
                  <SelectTrigger data-testid="select-dog-size">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Weight (lbs)</Label>
                <Input
                  type="number"
                  value={dogInfo.dogWeight}
                  onChange={e => setDogInfo({ ...dogInfo, dogWeight: e.target.value })}
                  placeholder="50"
                  data-testid="input-dog-weight"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Energy Level</Label>
              <Select
                value={dogInfo.dogEnergyLevel}
                onValueChange={v => setDogInfo({ ...dogInfo, dogEnergyLevel: v })}
              >
                <SelectTrigger data-testid="select-dog-energy">
                  <SelectValue placeholder="Select energy level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Couch potato</SelectItem>
                  <SelectItem value="moderate">Moderate - Regular walks</SelectItem>
                  <SelectItem value="high">High - Very active</SelectItem>
                  <SelectItem value="very_high">Very High - Needs lots of exercise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Compatibility</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="goodWithKids"
                    checked={dogInfo.dogGoodWithKids}
                    onCheckedChange={c => setDogInfo({ ...dogInfo, dogGoodWithKids: !!c })}
                  />
                  <Label htmlFor="goodWithKids" className="text-sm font-normal">Good with kids</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="goodWithDogs"
                    checked={dogInfo.dogGoodWithDogs}
                    onCheckedChange={c => setDogInfo({ ...dogInfo, dogGoodWithDogs: !!c })}
                  />
                  <Label htmlFor="goodWithDogs" className="text-sm font-normal">Good with dogs</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="goodWithCats"
                    checked={dogInfo.dogGoodWithCats}
                    onCheckedChange={c => setDogInfo({ ...dogInfo, dogGoodWithCats: !!c })}
                  />
                  <Label htmlFor="goodWithCats" className="text-sm font-normal">Good with cats</Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Special Needs or Notes</Label>
              <Textarea
                value={dogInfo.dogSpecialNeeds}
                onChange={e => setDogInfo({ ...dogInfo, dogSpecialNeeds: e.target.value })}
                placeholder="Any medical conditions, behavioral notes, or special care requirements..."
                data-testid="textarea-special-needs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => setStep("request-details")}
                disabled={!canProceed}
                data-testid="button-next-step"
              >
                Next
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FormSection
              title="Request Details"
              description="Let the foster know what you need"
              icon={FileText}
              variant="ai"
            />

            <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Dog className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{dogInfo.dogName}</p>
                <p className="text-sm text-muted-foreground">{dogInfo.dogBreed} • {dogInfo.dogSize}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>How long do you need fostering? *</Label>
              <Select
                value={requestDetails.duration}
                onValueChange={v => setRequestDetails({ ...requestDetails, duration: v })}
              >
                <SelectTrigger data-testid="select-duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_term">Short Term (2-4 weeks)</SelectItem>
                  <SelectItem value="medium_term">Medium Term (1-2 months)</SelectItem>
                  <SelectItem value="long_term">Long Term (2+ months)</SelectItem>
                  <SelectItem value="indefinite">Indefinite / Until adopted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select
                value={requestDetails.urgency}
                onValueChange={v => setRequestDetails({ ...requestDetails, urgency: v })}
              >
                <SelectTrigger data-testid="select-urgency">
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal - Within a week or two</SelectItem>
                  <SelectItem value="urgent">Urgent - Within a few days</SelectItem>
                  <SelectItem value="emergency">Emergency - ASAP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Why do you need foster help? *</Label>
              <Textarea
                value={requestDetails.reason}
                onChange={e => setRequestDetails({ ...requestDetails, reason: e.target.value })}
                placeholder="Moving, medical emergency, temporary housing situation, etc."
                data-testid="textarea-reason"
              />
            </div>

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                value={requestDetails.additionalNotes}
                onChange={e => setRequestDetails({ ...requestDetails, additionalNotes: e.target.value })}
                placeholder="Any other information the foster should know..."
                data-testid="textarea-additional-notes"
              />
            </div>

            {requestDetails.urgency === "emergency" && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-300">
                    For emergencies, we'll notify the foster immediately. They may contact you directly.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep("dog-info")}>
                Back
              </Button>
              <Button 
                onClick={() => createRequest.mutate()}
                disabled={!canProceed || createRequest.isPending}
                data-testid="button-send-request"
              >
                {createRequest.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Request"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
