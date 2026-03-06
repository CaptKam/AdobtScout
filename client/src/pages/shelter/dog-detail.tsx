import { useState, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DetailPageSkeleton } from "@/components/shelter-skeletons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, Dog, Camera, Heart, Clock, AlertTriangle,
  Syringe, Stethoscope, Brain, Home, FileText, CheckCircle,
  Calendar, Edit, Save, X, Plus, User, MapPin, Weight, Ruler,
  Sparkles, Activity, Shield, PawPrint, ClipboardList, ExternalLink
} from "lucide-react";
import { EmptyState } from "@/components/shelter/empty-state";
import type { Dog as DogType, IntakeRecord, MedicalRecord, TreatmentPlan, VetReferral } from "@shared/schema";

interface ApplicationBasic {
  id: string;
  status: string;
  createdAt: Date | null;
}

interface DogWithDetails extends DogType {
  intake: IntakeRecord | null;
  medicalRecords?: MedicalRecord[];
  applications?: ApplicationBasic[];
}

export default function ShelterDogDetail() {
  const [, params] = useRoute("/shelter/dogs/:id");
  const dogId = params?.id;
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [medicalFilters, setMedicalFilters] = useState({
    records: true,
    treatments: true,
    referrals: true,
  });
  const [, setLocation] = useLocation();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [showAddRecordDialog, setShowAddRecordDialog] = useState(false);
  const [showAddTreatmentDialog, setShowAddTreatmentDialog] = useState(false);
  const [showAddReferralDialog, setShowAddReferralDialog] = useState(false);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);

  const [recordForm, setRecordForm] = useState({ recordType: "", description: "", veterinarian: "", notes: "" });
  const [treatmentForm, setTreatmentForm] = useState({ title: "", condition: "", description: "", priority: "normal" });
  const [referralForm, setReferralForm] = useState({ reason: "", urgency: "routine", vetClinicName: "", symptoms: "" });
  const [outcomeForm, setOutcomeForm] = useState({ outcomeType: "", outcomeDate: format(new Date(), "yyyy-MM-dd"), notes: "" });

  const { data: dog, isLoading } = useQuery<DogWithDetails>({
    queryKey: ["/api/dogs", dogId],
    enabled: !!dogId,
  });

  const { data: medicalRecords = [] } = useQuery<MedicalRecord[]>({
    queryKey: ["/api/shelter/medical/dog", dogId],
    enabled: !!dogId,
  });

  const { data: treatmentPlans = [] } = useQuery<TreatmentPlan[]>({
    queryKey: ["/api/shelter/dogs", dogId, "treatment-plans"],
    enabled: !!dogId,
  });

  const { data: vetReferrals = [] } = useQuery<VetReferral[]>({
    queryKey: ["/api/shelter/dogs", dogId, "vet-referrals"],
    enabled: !!dogId,
  });

  // Fetch all applications and filter client-side for this dog
  const { data: allApplications = [] } = useQuery<ApplicationBasic[]>({
    queryKey: ["/api/shelter/applications"],
    enabled: !!dogId,
  });
  const applications = allApplications.filter((app: any) => app.dogId === dogId);

  const updateDogMutation = useMutation({
    mutationFn: async (updates: Partial<DogType>) => {
      return apiRequest("PATCH", `/api/dogs/${dogId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dogs", dogId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      toast({ title: "Pet updated", description: "Changes saved successfully." });
      setIsEditing(false);
    },
  });

  // Behavior notes - store in dog bio field for now (no dedicated endpoint)
  const addBehaviorNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const currentBio = dog?.bio || '';
      const timestamp = new Date().toLocaleDateString();
      const newBio = `${currentBio}\n\n[${timestamp}] ${note}`.trim();
      return apiRequest("PATCH", `/api/dogs/${dogId}`, { bio: newBio });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dogs", dogId] });
      toast({ title: "Note added", description: "Behavior note recorded." });
      setBehaviorNotes("");
    },
  });

  const addMedicalRecordMutation = useMutation({
    mutationFn: async (data: typeof recordForm) => {
      return apiRequest("POST", "/api/shelter/medical", { dogId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/medical/dog", dogId] });
      toast({ title: "Record added", description: "Medical record saved successfully." });
      setShowAddRecordDialog(false);
      setRecordForm({ recordType: "", description: "", veterinarian: "", notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add record", variant: "destructive" });
    },
  });

  const addTreatmentPlanMutation = useMutation({
    mutationFn: async (data: typeof treatmentForm) => {
      return apiRequest("POST", "/api/shelter/treatment-plans", { dogId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs", dogId, "treatment-plans"] });
      toast({ title: "Treatment plan added", description: "Treatment plan created successfully." });
      setShowAddTreatmentDialog(false);
      setTreatmentForm({ title: "", condition: "", description: "", priority: "normal" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add treatment plan", variant: "destructive" });
    },
  });

  const addVetReferralMutation = useMutation({
    mutationFn: async (data: typeof referralForm) => {
      return apiRequest("POST", "/api/shelter/vet-referrals", { dogId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs", dogId, "vet-referrals"] });
      toast({ title: "Referral added", description: "Vet referral created successfully." });
      setShowAddReferralDialog(false);
      setReferralForm({ reason: "", urgency: "routine", vetClinicName: "", symptoms: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add referral", variant: "destructive" });
    },
  });

  const recordOutcomeMutation = useMutation({
    mutationFn: async (data: typeof outcomeForm) => {
      return apiRequest("PATCH", `/api/shelter/intake/${dog?.intake?.id}`, {
        outcomeType: data.outcomeType,
        outcomeDate: new Date(data.outcomeDate),
        outcomeNotes: data.notes,
        pipelineStatus: "adopted",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dogs", dogId] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/intake"] });
      toast({ title: "Outcome recorded", description: "Adoption outcome saved successfully." });
      setShowOutcomeDialog(false);
      setOutcomeForm({ outcomeType: "", outcomeDate: format(new Date(), "yyyy-MM-dd"), notes: "" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to record outcome", variant: "destructive" });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('photos', file));

    try {
      const response = await fetch(`/api/dogs/${dogId}/photos`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/dogs", dogId] });
        toast({ title: "Photos uploaded", description: "Photos added successfully." });
      } else {
        const error = await response.json();
        toast({ title: "Upload failed", description: error.message || "Failed to upload photos", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Failed to upload photos", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6">
        <DetailPageSkeleton />
      </div>
    );
  }

  if (!dog) {
    return (
      <div className="p-6">
        <p>Pet not found</p>
        <Button asChild className="mt-4">
          <Link href="/shelter/dogs">Back to Pets</Link>
        </Button>
      </div>
    );
  }

  const pipelineStatus = dog.intake?.pipelineStatus || 'intake';

  return (
    <>
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b bg-background">
          <div className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild className="h-11 w-11 sm:h-9 sm:w-9">
                  <Link href="/shelter/dogs">
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                </Button>
                <div className="flex-1 sm:flex-none">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-bold">{dog.name}</h1>
                    {dog.urgencyLevel === 'urgent' && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Urgent
                      </Badge>
                    )}
                    {dog.urgencyLevel === 'critical' && (
                      <Badge variant="destructive" className="gap-1 bg-red-600">
                        <AlertTriangle className="w-3 h-3" />
                        Critical
                      </Badge>
                    )}
                    {(dog.holdType || dog.intake?.holdType) && (
                      <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/30" data-testid="badge-hold-status">
                        <Shield className="w-3 h-3" />
                        {(dog.holdType || dog.intake?.holdType || '').replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm sm:text-base text-muted-foreground">{dog.breed} · {dog.age} years · {dog.size}</p>
                </div>
              </div>
              <Badge variant="outline" className="capitalize self-start sm:self-auto sm:ml-auto">
                {pipelineStatus.replace('_', ' ')}
              </Badge>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
                <TabsTrigger value="profile" className="gap-1 sm:gap-2 min-w-fit px-2 sm:px-3">
                  <Dog className="w-4 h-4 hidden sm:block" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="intake" className="gap-1 sm:gap-2 min-w-fit px-2 sm:px-3">
                  <FileText className="w-4 h-4 hidden sm:block" />
                  <span className="hidden sm:inline">Intake & Holds</span>
                  <span className="sm:hidden">Intake</span>
                </TabsTrigger>
                <TabsTrigger value="medical" className="gap-1 sm:gap-2 min-w-fit px-2 sm:px-3">
                  <Stethoscope className="w-4 h-4 hidden sm:block" />
                  Medical
                </TabsTrigger>
                <TabsTrigger value="behavior" className="gap-1 sm:gap-2 min-w-fit px-2 sm:px-3">
                  <Brain className="w-4 h-4 hidden sm:block" />
                  Behavior
                </TabsTrigger>
                <TabsTrigger value="foster" className="gap-1 sm:gap-2 min-w-fit px-2 sm:px-3">
                  <Home className="w-4 h-4 hidden sm:block" />
                  Foster
                </TabsTrigger>
                <TabsTrigger value="applications" className="gap-1 sm:gap-2 min-w-fit px-2 sm:px-3">
                  <Heart className="w-4 h-4 hidden sm:block" />
                  <span className="hidden sm:inline">Applications</span>
                  <span className="sm:hidden">Apps</span>
                  {applications.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{applications.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="outcome" className="gap-1 sm:gap-2 min-w-fit px-2 sm:px-3">
                  <CheckCircle className="w-4 h-4 hidden sm:block" />
                  Outcome
                </TabsTrigger>
                <TabsTrigger value="log" className="gap-1 sm:gap-2 min-w-fit px-2 sm:px-3">
                  <Sparkles className="w-4 h-4 hidden sm:block" />
                  <span className="hidden sm:inline">Activity Log</span>
                  <span className="sm:hidden">Log</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="profile" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1">
                    <Card>
                      <CardContent className="p-4">
                        <div className="aspect-square rounded-lg bg-muted overflow-hidden mb-4">
                          {dog.photos && dog.photos.length > 0 ? (
                            <img
                              src={dog.photos[0]}
                              alt={dog.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="w-16 h-16 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {dog.photos && dog.photos.length > 1 && (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {dog.photos.slice(1, 5).map((photo, i) => (
                              <div key={i} className="aspect-square rounded-md bg-muted overflow-hidden">
                                <img src={photo} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                        <input
                          type="file"
                          ref={photoInputRef}
                          onChange={handlePhotoUpload}
                          accept="image/*"
                          multiple
                          className="hidden"
                          data-testid="input-photo-upload"
                        />
                        <Button className="w-full mt-4" variant="outline" onClick={() => photoInputRef.current?.click()} data-testid="button-upload-photos">
                          <Camera className="w-4 h-4 mr-2" />
                          Upload Photos
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Basic Information</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditing(!isEditing)}
                        >
                          {isEditing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                        </Button>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Age</Label>
                          <p className="font-medium">{dog.age} years</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Spayed/Neutered</Label>
                          <p className="font-medium">{dog.spayedNeutered ? 'Yes' : 'No'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Size</Label>
                          <p className="font-medium capitalize">{dog.size}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Weight</Label>
                          <p className="font-medium">{dog.weight || 'Not recorded'} lbs</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Vaccinated</Label>
                          <p className="font-medium">{dog.vaccinated ? 'Yes' : 'No'}</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Energy Level</Label>
                          <p className="font-medium capitalize">{dog.energyLevel}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Personality & Traits</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <p className="mt-1">{dog.bio || 'No description available'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {dog.goodWithKids && (
                            <Badge variant="secondary">Good with Kids</Badge>
                          )}
                          {dog.goodWithDogs && (
                            <Badge variant="secondary">Good with Dogs</Badge>
                          )}
                          {dog.goodWithCats && (
                            <Badge variant="secondary">Good with Cats</Badge>
                          )}
                          {dog.specialNeeds && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                              Special Needs
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="intake" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Intake Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {dog.intake ? (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">Intake Date</Label>
                              <p className="font-medium">
                                {dog.intake.intakeDate
                                  ? format(new Date(dog.intake.intakeDate), 'MMM d, yyyy')
                                  : 'Unknown'}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Intake Type</Label>
                              <p className="font-medium capitalize">
                                {dog.intake.intakeType?.replace('_', ' ') || 'Not specified'}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Initial Condition</Label>
                              <p className="font-medium capitalize">
                                {dog.intake.initialCondition || 'Not recorded'}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Pipeline Status</Label>
                              <Badge variant="outline" className="capitalize">
                                {dog.intake.pipelineStatus?.replace('_', ' ') || 'Intake'}
                              </Badge>
                            </div>
                          </div>
                          {dog.intake.intakeReason && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Reason</Label>
                              <p className="mt-1">{dog.intake.intakeReason}</p>
                            </div>
                          )}
                          {dog.intake.initialNotes && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Notes</Label>
                              <p className="mt-1">{dog.intake.initialNotes}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No intake record</p>
                          <Button className="mt-4">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Intake Record
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Holds</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dog.intake?.holdType ? (
                        <div className="space-y-4">
                          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="w-5 h-5 text-yellow-600" />
                              <span className="font-semibold capitalize">
                                {dog.intake.holdType.replace('_', ' ')}
                              </span>
                            </div>
                            {dog.intake.holdExpiresAt && (
                              <p className="text-sm text-muted-foreground">
                                Expires: {format(new Date(dog.intake.holdExpiresAt), 'MMM d, yyyy')}
                              </p>
                            )}
                            {dog.intake.holdNotes && (
                              <p className="text-sm mt-2">{dog.intake.holdNotes}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No active holds</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="medical" className="mt-0 space-y-4">
                {/* Quick Action Ribbon */}
                <Card>
                  <CardContent className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-muted-foreground">Show:</span>
                        <Button 
                          size="sm" 
                          variant={medicalFilters.records ? "default" : "outline"} 
                          onClick={() => setMedicalFilters(f => ({...f, records: !f.records}))}
                          data-testid="filter-records"
                          className="gap-1"
                        >
                          <Syringe className="w-3 h-3" /> Records
                        </Button>
                        <Button 
                          size="sm" 
                          variant={medicalFilters.treatments ? "default" : "outline"} 
                          onClick={() => setMedicalFilters(f => ({...f, treatments: !f.treatments}))}
                          data-testid="filter-treatments"
                          className="gap-1"
                        >
                          <ClipboardList className="w-3 h-3" /> Treatments
                        </Button>
                        <Button 
                          size="sm" 
                          variant={medicalFilters.referrals ? "default" : "outline"} 
                          onClick={() => setMedicalFilters(f => ({...f, referrals: !f.referrals}))}
                          data-testid="filter-referrals"
                          className="gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Referrals
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" data-testid="button-add-medical-record" className="gap-1" onClick={() => setShowAddRecordDialog(true)}>
                          <Plus className="w-3 h-3" />Record
                        </Button>
                        <Button size="sm" variant="outline" data-testid="button-add-treatment-plan" className="gap-1" onClick={() => setShowAddTreatmentDialog(true)}>
                          <Plus className="w-3 h-3" />Treatment
                        </Button>
                        <Button size="sm" variant="outline" data-testid="button-add-vet-referral" className="gap-1" onClick={() => setShowAddReferralDialog(true)}>
                          <Plus className="w-3 h-3" />Referral
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Unified Care Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle>Care Timeline</CardTitle>
                    <CardDescription>Complete medical history in chronological order</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Build unified timeline items
                      type TimelineItem = {
                        id: string;
                        type: 'record' | 'treatment' | 'referral';
                        date: Date;
                        title: string;
                        subtitle?: string;
                        description?: string;
                        status?: string;
                        priority?: string;
                        urgency?: string;
                      };

                      const timelineItems: TimelineItem[] = [];

                      // Add medical records
                      if (medicalFilters.records) {
                        medicalRecords.forEach(record => {
                          timelineItems.push({
                            id: `record-${record.id}`,
                            type: 'record',
                            date: record.performedAt ? new Date(record.performedAt) : 
                                  record.createdAt ? new Date(record.createdAt) : new Date(),
                            title: record.title || record.recordType || 'Medical Record',
                            description: record.description || undefined,
                          });
                        });
                      }

                      // Add treatment plans
                      if (medicalFilters.treatments) {
                        treatmentPlans.forEach(plan => {
                          timelineItems.push({
                            id: `treatment-${plan.id}`,
                            type: 'treatment',
                            date: plan.startDate ? new Date(plan.startDate) : new Date(),
                            title: plan.title || 'Treatment Plan',
                            subtitle: plan.condition || undefined,
                            status: plan.status || undefined,
                            priority: plan.priority || undefined,
                          });
                        });
                      }

                      // Add vet referrals
                      if (medicalFilters.referrals) {
                        vetReferrals.forEach(referral => {
                          timelineItems.push({
                            id: `referral-${referral.id}`,
                            type: 'referral',
                            date: referral.appointmentDate ? new Date(referral.appointmentDate) : 
                                  referral.createdAt ? new Date(referral.createdAt) : new Date(),
                            title: referral.reason || 'Vet Referral',
                            subtitle: referral.vetClinicName || undefined,
                            status: referral.status || undefined,
                            urgency: referral.urgency || undefined,
                          });
                        });
                      }

                      // Sort by date descending (most recent first)
                      timelineItems.sort((a, b) => b.date.getTime() - a.date.getTime());

                      if (timelineItems.length === 0) {
                        return (
                          <div className="text-center py-12 text-muted-foreground">
                            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No medical history yet</p>
                            <p className="text-xs mt-1">Add records, treatments, or referrals to see them here</p>
                          </div>
                        );
                      }

                      return (
                        <div className="relative">
                          {/* Timeline line */}
                          <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-border" />
                          
                          <div className="space-y-4">
                            {timelineItems.map((item, index) => {
                              const iconClasses = {
                                record: 'bg-primary/10 text-primary',
                                treatment: 'bg-blue-500/10 text-blue-500',
                                referral: 'bg-green-500/10 text-green-600',
                              };
                              const Icon = item.type === 'record' ? Syringe : 
                                           item.type === 'treatment' ? ClipboardList : ExternalLink;

                              return (
                                <div 
                                  key={item.id} 
                                  className="relative flex items-start gap-4 pl-0"
                                  data-testid={`timeline-item-${item.id}`}
                                >
                                  {/* Icon */}
                                  <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconClasses[item.type]}`}>
                                    <Icon className="w-4 h-4" />
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0 pb-4">
                                    <div className="p-3 border rounded-lg hover-elevate">
                                      <div className="flex items-start justify-between gap-2 flex-wrap">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-medium text-sm">{item.title}</p>
                                            {item.status && (
                                              <Badge 
                                                variant={
                                                  item.status === 'completed' ? 'secondary' : 
                                                  item.status === 'active' || item.status === 'scheduled' ? 'default' : 
                                                  'outline'
                                                }
                                                className="text-xs"
                                              >
                                                {item.status}
                                              </Badge>
                                            )}
                                            {item.priority === 'urgent' && (
                                              <Badge variant="destructive" className="text-xs">Urgent</Badge>
                                            )}
                                            {(item.urgency === 'urgent' || item.urgency === 'emergency') && (
                                              <Badge variant="destructive" className="text-xs capitalize">{item.urgency}</Badge>
                                            )}
                                          </div>
                                          {item.subtitle && (
                                            <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>
                                          )}
                                          {item.description && (
                                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                                          {format(item.date, 'MMM d, yyyy')}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="behavior" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Behavior Assessment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Energy Level</Label>
                          <p className="font-medium capitalize">{dog.energyLevel}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Age Category</Label>
                          <p className="font-medium capitalize">{dog.ageCategory || 'Not assessed'}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {dog.goodWithKids && <Badge>Good with Kids</Badge>}
                        {dog.goodWithDogs && <Badge>Good with Dogs</Badge>}
                        {dog.goodWithCats && <Badge>Good with Cats</Badge>}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Add Behavior Note</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder="Record behavior observations..."
                        value={behaviorNotes}
                        onChange={(e) => setBehaviorNotes(e.target.value)}
                        className="min-h-[100px]"
                      />
                      <Button
                        onClick={() => addBehaviorNoteMutation.mutate(behaviorNotes)}
                        disabled={!behaviorNotes.trim()}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Save Note
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="foster" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Foster History</CardTitle>
                    <CardDescription>Current and past foster placements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                      <Home className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No foster history</p>
                      <Button className="mt-4" variant="outline" onClick={() => setLocation("/shelter/foster")} data-testid="button-find-foster">
                        <Plus className="w-4 h-4 mr-2" />
                        Find Foster Home
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="applications" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Adoption Applications</CardTitle>
                    <CardDescription>
                      {applications.length} application{applications.length !== 1 ? 's' : ''} received
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {applications.length > 0 ? (
                      <div className="space-y-4">
                        {applications.map((app) => (
                          <div
                            key={app.id}
                            className="p-4 border rounded-lg flex items-center gap-4"
                          >
                            <Avatar>
                              <AvatarFallback>A</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium">Applicant</p>
                              <p className="text-sm text-muted-foreground">
                                Applied {app.createdAt
                                  ? format(new Date(app.createdAt), 'MMM d, yyyy')
                                  : 'recently'}
                              </p>
                            </div>
                            <Badge variant="outline" className="capitalize">
                              {app.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState 
                        variant="applications"
                        title="No applications yet"
                        description="When adopters apply for this pet, their applications will appear here."
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="outcome" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Adoption Outcome</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dog.intake?.outcomeType ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-semibold capitalize">
                              {dog.intake.outcomeType.replace('_', ' ')}
                            </span>
                          </div>
                          {dog.intake.outcomeDate && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(new Date(dog.intake.outcomeDate), 'MMMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No outcome recorded yet</p>
                        <Button className="mt-4" variant="outline" onClick={() => setShowOutcomeDialog(true)} data-testid="button-record-outcome">
                          Record Outcome
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="log" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Log</CardTitle>
                    <CardDescription>Automated actions and history</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12 text-muted-foreground">
                      <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No activity recorded</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      {/* Add Medical Record Dialog */}
      <Dialog open={showAddRecordDialog} onOpenChange={setShowAddRecordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Medical Record</DialogTitle>
            <DialogDescription>Add a new medical record for {dog.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Record Type</Label>
              <Select value={recordForm.recordType} onValueChange={(v) => setRecordForm(f => ({...f, recordType: v}))}>
                <SelectTrigger data-testid="select-record-type"><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vaccination">Vaccination</SelectItem>
                  <SelectItem value="examination">Examination</SelectItem>
                  <SelectItem value="surgery">Surgery</SelectItem>
                  <SelectItem value="medication">Medication</SelectItem>
                  <SelectItem value="test">Test/Lab Work</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={recordForm.description} onChange={(e) => setRecordForm(f => ({...f, description: e.target.value}))} placeholder="Describe the medical record..." data-testid="input-record-description" />
            </div>
            <div className="space-y-2">
              <Label>Veterinarian</Label>
              <Input value={recordForm.veterinarian} onChange={(e) => setRecordForm(f => ({...f, veterinarian: e.target.value}))} placeholder="Vet name..." data-testid="input-record-vet" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={recordForm.notes} onChange={(e) => setRecordForm(f => ({...f, notes: e.target.value}))} placeholder="Additional notes..." data-testid="input-record-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRecordDialog(false)}>Cancel</Button>
            <Button onClick={() => addMedicalRecordMutation.mutate(recordForm)} disabled={!recordForm.recordType || addMedicalRecordMutation.isPending} data-testid="button-save-record">
              {addMedicalRecordMutation.isPending ? "Saving..." : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Treatment Plan Dialog */}
      <Dialog open={showAddTreatmentDialog} onOpenChange={setShowAddTreatmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Treatment Plan</DialogTitle>
            <DialogDescription>Create a treatment plan for {dog.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={treatmentForm.title} onChange={(e) => setTreatmentForm(f => ({...f, title: e.target.value}))} placeholder="Treatment plan title..." data-testid="input-treatment-title" />
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Input value={treatmentForm.condition} onChange={(e) => setTreatmentForm(f => ({...f, condition: e.target.value}))} placeholder="Medical condition..." data-testid="input-treatment-condition" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={treatmentForm.description} onChange={(e) => setTreatmentForm(f => ({...f, description: e.target.value}))} placeholder="Treatment details..." data-testid="input-treatment-description" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={treatmentForm.priority} onValueChange={(v) => setTreatmentForm(f => ({...f, priority: v}))}>
                <SelectTrigger data-testid="select-treatment-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTreatmentDialog(false)}>Cancel</Button>
            <Button onClick={() => addTreatmentPlanMutation.mutate(treatmentForm)} disabled={!treatmentForm.title || addTreatmentPlanMutation.isPending} data-testid="button-save-treatment">
              {addTreatmentPlanMutation.isPending ? "Saving..." : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vet Referral Dialog */}
      <Dialog open={showAddReferralDialog} onOpenChange={setShowAddReferralDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vet Referral</DialogTitle>
            <DialogDescription>Create a vet referral for {dog.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reason for Referral</Label>
              <Input value={referralForm.reason} onChange={(e) => setReferralForm(f => ({...f, reason: e.target.value}))} placeholder="Why is referral needed..." data-testid="input-referral-reason" />
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={referralForm.urgency} onValueChange={(v) => setReferralForm(f => ({...f, urgency: v}))}>
                <SelectTrigger data-testid="select-referral-urgency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="soon">Soon</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vet Clinic Name</Label>
              <Input value={referralForm.vetClinicName} onChange={(e) => setReferralForm(f => ({...f, vetClinicName: e.target.value}))} placeholder="Clinic name..." data-testid="input-referral-clinic" />
            </div>
            <div className="space-y-2">
              <Label>Symptoms</Label>
              <Textarea value={referralForm.symptoms} onChange={(e) => setReferralForm(f => ({...f, symptoms: e.target.value}))} placeholder="Describe symptoms..." data-testid="input-referral-symptoms" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddReferralDialog(false)}>Cancel</Button>
            <Button onClick={() => addVetReferralMutation.mutate(referralForm)} disabled={!referralForm.reason || addVetReferralMutation.isPending} data-testid="button-save-referral">
              {addVetReferralMutation.isPending ? "Saving..." : "Create Referral"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Outcome Dialog */}
      <Dialog open={showOutcomeDialog} onOpenChange={setShowOutcomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Outcome</DialogTitle>
            <DialogDescription>Record the adoption outcome for {dog.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Outcome Type</Label>
              <Select value={outcomeForm.outcomeType} onValueChange={(v) => setOutcomeForm(f => ({...f, outcomeType: v}))}>
                <SelectTrigger data-testid="select-outcome-type"><SelectValue placeholder="Select outcome..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adopted">Adopted</SelectItem>
                  <SelectItem value="foster">Foster</SelectItem>
                  <SelectItem value="returned_to_owner">Returned to Owner</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                  <SelectItem value="deceased">Deceased</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={outcomeForm.outcomeDate} onChange={(e) => setOutcomeForm(f => ({...f, outcomeDate: e.target.value}))} data-testid="input-outcome-date" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={outcomeForm.notes} onChange={(e) => setOutcomeForm(f => ({...f, notes: e.target.value}))} placeholder="Additional notes..." data-testid="input-outcome-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutcomeDialog(false)}>Cancel</Button>
            <Button onClick={() => recordOutcomeMutation.mutate(outcomeForm)} disabled={!outcomeForm.outcomeType || recordOutcomeMutation.isPending} data-testid="button-save-outcome">
              {recordOutcomeMutation.isPending ? "Saving..." : "Record Outcome"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
