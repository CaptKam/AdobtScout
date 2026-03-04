import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Phone, 
  CheckCircle, 
  User, 
  Dog as DogIcon, 
  Loader2,
  FileText,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  ThumbsUp,
  ThumbsDown,
  XCircle,
  Clock,
  AlertCircle,
  MapPin,
  Mail,
  Calendar,
  Home,
  Users,
  Shield,
  HeartHandshake,
  Cat,
  PawPrint,
  Clipboard,
  PartyPopper,
  DollarSign,
  CalendarPlus,
  Copy
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { ShelterApplicationQuestion } from "@shared/schema";

interface AdoptionJourney {
  id: string;
  userId: string;
  dogId: string;
  currentStep: string;
  status: string;
  applicationSubmittedAt?: string;
  applicationResponses?: Record<string, any>;
  phoneScreeningStatus?: string;
  phoneScreeningScheduledAt?: string;
  phoneScreeningCompletedAt?: string;
  phoneScreeningTranscript?: string;
  phoneScreeningSummary?: string;
  meetGreetScheduledAt?: string;
  meetGreetCompletedAt?: string;
  adoptionDate?: string;
  completedAt?: string;
  adminNotes?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  dog?: {
    id: string;
    name: string;
    breed: string;
    photos: string[];
    age?: number;
    gender?: string;
    size?: string;
  };
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  userProfile?: {
    id: string;
    userId: string;
    mode: string;
    phoneNumber?: string;
    city?: string;
    state?: string;
    homeType?: string;
    hasYard?: boolean;
    hasChildren?: boolean;
    childrenAges?: string[];
    familySize?: number;
    hasOtherPets?: boolean;
    otherPetsType?: string;
    activityLevel?: string;
    workSchedule?: string;
    exerciseCommitment?: string;
    experienceLevel?: string;
    preferredSize?: string[];
    preferredAge?: string[];
    preferredEnergy?: string[];
    fosterTimeCommitment?: string;
    fosterEmergencyAvailability?: string;
  };
  familyMembers?: Array<{
    id: string;
    name: string;
    relationship: string;
    age?: number;
    profileImage?: string;
  }>;
  householdPets?: Array<{
    id: string;
    name: string;
    species: string;
    breed?: string;
    age?: number;
    temperament?: string[];
    photo?: string;
  }>;
  verification?: {
    idVerified?: boolean;
    addressVerified?: boolean;
    phoneVerified?: boolean;
    backgroundCheckStatus?: string;
  };
}

export default function ShelterApplications() {
  const { toast } = useToast();
  const [selectedJourney, setSelectedJourney] = useState<AdoptionJourney | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [adoptionFee, setAdoptionFee] = useState('');
  const [meetGreetDate, setMeetGreetDate] = useState('');
  const [meetGreetTime, setMeetGreetTime] = useState('');

  const { data: journeys = [], isLoading } = useQuery<AdoptionJourney[]>({
    queryKey: ['/api/shelter/applications'],
    staleTime: 0,
  });

  const { data: journeyDetails, isLoading: isLoadingDetails } = useQuery<AdoptionJourney>({
    queryKey: ['/api/shelter/applications', selectedJourney?.id],
    enabled: !!selectedJourney?.id && reviewDialogOpen,
    staleTime: 0,
  });

  // Fetch shelter's custom questions to display with answers
  const { data: shelterQuestions } = useQuery<{
    form: any;
    questions: ShelterApplicationQuestion[];
  }>({
    queryKey: ['/api/shelter/application-questions'],
    enabled: reviewDialogOpen,
  });

  const approveMutation = useMutation({
    mutationFn: ({ journeyId, notes }: { journeyId: string; notes?: string }) =>
      apiRequest('PATCH', `/api/shelter/applications/${journeyId}/approve`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/applications'] });
      setApproveDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedJourney(null);
      setAdminNotes('');
      toast({
        title: "Application Approved",
        description: "The application has been approved and moved to phone screening.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve application.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ journeyId, reason, notes }: { journeyId: string; reason?: string; notes?: string }) =>
      apiRequest('PATCH', `/api/shelter/applications/${journeyId}/reject`, { reason, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/applications'] });
      setRejectDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedJourney(null);
      setRejectionReason('');
      setAdminNotes('');
      toast({
        title: "Application Rejected",
        description: "The application has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject application.",
        variant: "destructive",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ journeyId, adoptionFee, notes }: { journeyId: string; adoptionFee?: string; notes?: string }) =>
      apiRequest('POST', `/api/shelter/applications/${journeyId}/complete-adoption`, { adoptionFee, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/dogs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/intake'] });
      setCompleteDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedJourney(null);
      setAdoptionFee('');
      setAdminNotes('');
      toast({
        title: "Adoption Completed!",
        description: "Congratulations! The adoption has been finalized.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete adoption.",
        variant: "destructive",
      });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ journeyId, scheduledAt }: { journeyId: string; scheduledAt: string }) =>
      apiRequest('POST', `/api/shelter/applications/${journeyId}/schedule-meet-greet`, { scheduledAt }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/applications'] });
      setScheduleDialogOpen(false);
      setSelectedJourney(null);
      setMeetGreetDate('');
      setMeetGreetTime('');
      toast({
        title: "Meet & Greet Scheduled",
        description: "The meet & greet has been scheduled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule meet & greet.",
        variant: "destructive",
      });
    },
  });

  const handleOpenReview = (journey: AdoptionJourney) => {
    setSelectedJourney(journey);
    setAdminNotes(journey.adminNotes || '');
    setReviewDialogOpen(true);
  };

  const handleApprove = () => {
    if (!selectedJourney) return;
    approveMutation.mutate({
      journeyId: selectedJourney.id,
      notes: adminNotes,
    });
  };

  const handleReject = () => {
    if (!selectedJourney) return;
    rejectMutation.mutate({
      journeyId: selectedJourney.id,
      reason: rejectionReason,
      notes: adminNotes,
    });
  };

  const handleComplete = () => {
    if (!selectedJourney) return;
    completeMutation.mutate({
      journeyId: selectedJourney.id,
      adoptionFee,
      notes: adminNotes,
    });
  };

  const handleSchedule = () => {
    if (!selectedJourney || !meetGreetDate || !meetGreetTime) return;
    const scheduledAt = new Date(`${meetGreetDate}T${meetGreetTime}`).toISOString();
    scheduleMutation.mutate({
      journeyId: selectedJourney.id,
      scheduledAt,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Information copied to clipboard.",
    });
  };

  const getStatusBadge = (journey: AdoptionJourney) => {
    if (journey.status === "completed") {
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          <PartyPopper className="w-3 h-3 mr-1" />
          Adopted
        </Badge>
      );
    }
    if (journey.status === "rejected") {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    }
    if (journey.phoneScreeningStatus === "awaiting_review") {
      return (
        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
          <FileText className="w-3 h-3 mr-1" />
          Review Transcript
        </Badge>
      );
    }
    if (journey.status === "approved") {
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    }
    
    switch (journey.currentStep) {
      case "application":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "phone_screening":
        if (journey.phoneScreeningStatus === "in_progress") {
          return (
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Call in Progress
            </Badge>
          );
        } else if (journey.phoneScreeningStatus === "completed") {
          return (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="w-3 h-3 mr-1" />
              Screening Complete
            </Badge>
          );
        }
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <Phone className="w-3 h-3 mr-1" />
            Awaiting Call
          </Badge>
        );
      case "meet_greet":
        if (journey.meetGreetScheduledAt) {
          return (
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              <Calendar className="w-3 h-3 mr-1" />
              Meet & Greet Scheduled
            </Badge>
          );
        }
        return (
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
            Meet & Greet
          </Badge>
        );
      case "adoption":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            Ready for Adoption
          </Badge>
        );
      default:
        return <Badge variant="outline">{journey.currentStep}</Badge>;
    }
  };

  const pendingReview = journeys.filter(
    j => j.applicationSubmittedAt && j.status === "active" && !j.approvedAt && !j.rejectedAt
  );

  const pendingTranscriptReview = journeys.filter(
    j => j.phoneScreeningStatus === "awaiting_review"
  );

  const inProgress = journeys.filter(
    j => (j.status === "approved" || j.approvedAt) && j.status !== "completed" && j.status !== "rejected"
  );

  const completed = journeys.filter(
    j => j.status === "completed"
  );

  const rejected = journeys.filter(
    j => j.status === "rejected" || j.rejectedAt
  );

  const allApplications = journeys;

  const renderApplicationCard = (journey: AdoptionJourney, showActions: boolean = true) => (
    <Card key={journey.id} data-testid={`card-application-${journey.id}`} className="hover-elevate transition-all">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            {journey.dog?.photos?.[0] && (
              <img
                src={journey.dog.photos[0]}
                alt={journey.dog.name}
                className="w-14 h-14 rounded-xl object-cover"
                data-testid={`img-dog-${journey.id}`}
              />
            )}
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DogIcon className="h-4 w-4 text-primary" />
                {journey.dog?.name || "Unknown Dog"}
              </CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span>{journey.dog?.breed}</span>
                <span className="text-xs">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(journey.createdAt).toLocaleDateString()}
                </span>
              </CardDescription>
            </div>
          </div>
          {getStatusBadge(journey)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-muted-foreground text-xs">Applicant</p>
              <p className="font-medium" data-testid={`text-applicant-${journey.id}`}>
                {journey.user?.firstName} {journey.user?.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="font-medium truncate max-w-[180px]">{journey.user?.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-muted-foreground text-xs">Phone</p>
              <p className="font-medium">
                {journey.userProfile?.phoneNumber || "Not provided"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-muted-foreground text-xs">Location</p>
              <p className="font-medium">
                {journey.userProfile?.city && journey.userProfile?.state 
                  ? `${journey.userProfile.city}, ${journey.userProfile.state}`
                  : "Not provided"}
              </p>
            </div>
          </div>
        </div>

        {showActions && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenReview(journey)}
              data-testid={`button-review-${journey.id}`}
            >
              <Eye className="mr-2 h-4 w-4" />
              Review
            </Button>
            
            {journey.status !== "rejected" && journey.status !== "completed" && !journey.approvedAt && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedJourney(journey);
                    setApproveDialogOpen(true);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid={`button-approve-${journey.id}`}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedJourney(journey);
                    setRejectDialogOpen(true);
                  }}
                  data-testid={`button-reject-${journey.id}`}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}

            {(journey.status === "approved" || journey.approvedAt) && 
             journey.currentStep === "phone_screening" &&
             journey.phoneScreeningStatus === "completed" && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedJourney(journey);
                  setScheduleDialogOpen(true);
                }}
                data-testid={`button-schedule-${journey.id}`}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                Schedule Meet & Greet
              </Button>
            )}

            {journey.currentStep === "meet_greet" && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setSelectedJourney(journey);
                  setCompleteDialogOpen(true);
                }}
                data-testid={`button-complete-${journey.id}`}
              >
                <PartyPopper className="mr-2 h-4 w-4" />
                Complete Adoption
              </Button>
            )}
          </div>
        )}

        {journey.rejectionReason && (
          <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <p className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Rejection Reason
            </p>
            <p className="text-sm mt-1">{journey.rejectionReason}</p>
          </div>
        )}

        {journey.adminNotes && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Notes
            </p>
            <p className="text-sm mt-1">{journey.adminNotes}</p>
          </div>
        )}

        {journey.phoneScreeningSummary && (
          <Collapsible
            open={transcriptOpen === journey.id}
            onOpenChange={() => setTranscriptOpen(transcriptOpen === journey.id ? null : journey.id)}
          >
            <div className="rounded-lg border p-4 bg-muted/30">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Phone Screening Summary</span>
                  </div>
                  {transcriptOpen === journey.id ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm">{journey.phoneScreeningSummary}</p>
                  </div>
                  {journey.phoneScreeningTranscript && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Full Transcript</p>
                      <ScrollArea className="h-48 rounded border p-3 bg-background">
                        <pre className="text-xs whitespace-pre-wrap font-mono">
                          {journey.phoneScreeningTranscript}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );

  const renderEmptyState = (icon: any, message: string) => (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground">
        {icon}
        <p className="mt-2">{message}</p>
      </CardContent>
    </Card>
  );

  return (
    
      <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="page-shelter-applications">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Adoption Applications</h1>
          <p className="text-muted-foreground">
            Review and manage adoption applications for your pets
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <Shield className="w-3 h-3 mr-1" />
              Pre-Approved
            </Badge>
            <span className="text-muted-foreground">
              All applications shown have been verified and approved by our Trust & Safety team.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-2xl font-bold">{pendingReview.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">In Progress</div>
            <div className="text-2xl font-bold">{inProgress.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Transcripts</div>
            <div className="text-2xl font-bold">{pendingTranscriptReview.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold text-green-600">{completed.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Rejected</div>
            <div className="text-2xl font-bold text-red-500">{rejected.length}</div>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="pending" data-testid="tab-pending" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Pending</span>
              <Badge variant="secondary" className="ml-1">{pendingReview.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="inprogress" data-testid="tab-inprogress" className="flex items-center gap-1">
              <Loader2 className="h-4 w-4" />
              <span className="hidden sm:inline">In Progress</span>
              <Badge variant="secondary" className="ml-1">{inProgress.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed" className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Completed</span>
              <Badge variant="secondary" className="ml-1">{completed.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="rejected" data-testid="tab-rejected" className="flex items-center gap-1">
              <XCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Rejected</span>
              <Badge variant="secondary" className="ml-1">{rejected.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">All</span>
              <Badge variant="secondary" className="ml-1">{allApplications.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-6">
            {isLoading ? (
              <Card className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-muted rounded" />
                </CardContent>
              </Card>
            ) : pendingReview.length === 0 ? (
              renderEmptyState(
                <Clock className="mx-auto h-12 w-12 opacity-50" />,
                "No pending applications to review"
              )
            ) : (
              pendingReview.map((journey) => renderApplicationCard(journey))
            )}
          </TabsContent>

          <TabsContent value="inprogress" className="space-y-4 mt-6">
            {isLoading ? (
              <Card className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-muted rounded" />
                </CardContent>
              </Card>
            ) : inProgress.length === 0 ? (
              renderEmptyState(
                <Loader2 className="mx-auto h-12 w-12 opacity-50" />,
                "No applications in progress"
              )
            ) : (
              inProgress.map((journey) => renderApplicationCard(journey))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-6">
            {isLoading ? (
              <Card className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-muted rounded" />
                </CardContent>
              </Card>
            ) : completed.length === 0 ? (
              renderEmptyState(
                <CheckCircle className="mx-auto h-12 w-12 opacity-50" />,
                "No completed adoptions yet"
              )
            ) : (
              completed.map((journey) => renderApplicationCard(journey, false))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 mt-6">
            {isLoading ? (
              <Card className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-muted rounded" />
                </CardContent>
              </Card>
            ) : rejected.length === 0 ? (
              renderEmptyState(
                <XCircle className="mx-auto h-12 w-12 opacity-50" />,
                "No rejected applications"
              )
            ) : (
              rejected.map((journey) => renderApplicationCard(journey, false))
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4 mt-6">
            {isLoading ? (
              <Card className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-24 bg-muted rounded" />
                </CardContent>
              </Card>
            ) : allApplications.length === 0 ? (
              renderEmptyState(
                <FileText className="mx-auto h-12 w-12 opacity-50" />,
                "No applications yet"
              )
            ) : (
              allApplications.map((journey) => renderApplicationCard(journey))
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-2xl w-[95vw] md:w-full max-h-[90vh] overflow-y-auto" data-testid="dialog-review">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Application Review
              </DialogTitle>
              <DialogDescription>
                Review the application details for {selectedJourney?.dog?.name}
              </DialogDescription>
            </DialogHeader>
            
            {isLoadingDetails ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : journeyDetails ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  {journeyDetails.dog?.photos?.[0] && (
                    <img
                      src={journeyDetails.dog.photos[0]}
                      alt={journeyDetails.dog?.name}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{journeyDetails.dog?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {journeyDetails.dog?.breed} • {journeyDetails.dog?.age} years old • {journeyDetails.dog?.size}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Applicant Information
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `${journeyDetails.user?.firstName} ${journeyDetails.user?.lastName}\n` +
                        `Email: ${journeyDetails.user?.email}\n` +
                        `Phone: ${journeyDetails.userProfile?.phoneNumber || 'N/A'}\n` +
                        `Location: ${journeyDetails.userProfile?.city}, ${journeyDetails.userProfile?.state}`
                      )}
                      data-testid="button-copy-applicant"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Info
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{journeyDetails.user?.firstName} {journeyDetails.user?.lastName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{journeyDetails.user?.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{journeyDetails.userProfile?.phoneNumber || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">
                        {journeyDetails.userProfile?.city && journeyDetails.userProfile?.state 
                          ? `${journeyDetails.userProfile.city}, ${journeyDetails.userProfile.state}`
                          : "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Lifestyle & Home</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Home Type</p>
                        <p className="font-medium capitalize">{journeyDetails.userProfile?.homeType || "Not set"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Has Yard</p>
                        <p className="font-medium">{journeyDetails.userProfile?.hasYard ? "Yes" : "No"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Activity Level</p>
                        <p className="font-medium capitalize">{journeyDetails.userProfile?.activityLevel?.replace('_', ' ') || "Not set"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Work Schedule</p>
                        <p className="font-medium capitalize">{journeyDetails.userProfile?.workSchedule?.replace(/_/g, ' ') || "Not set"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Family & Experience</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Family Size</p>
                        <p className="font-medium">{journeyDetails.userProfile?.familySize || 1} {(journeyDetails.userProfile?.familySize || 1) === 1 ? 'person' : 'people'}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Has Children</p>
                        <p className="font-medium">{journeyDetails.userProfile?.hasChildren ? "Yes" : "No"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Other Pets</p>
                        <p className="font-medium">{journeyDetails.userProfile?.hasOtherPets ? (journeyDetails.userProfile?.otherPetsType || "Yes") : "No"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Experience</p>
                        <p className="font-medium capitalize">{journeyDetails.userProfile?.experienceLevel?.replace(/_/g, ' ') || "Not set"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {journeyDetails.verification && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Verification Status
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="p-2 bg-muted/30 rounded flex items-center gap-2">
                          {journeyDetails.verification.idVerified ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className={journeyDetails.verification.idVerified ? "font-medium" : "text-muted-foreground"}>
                            ID Verified
                          </span>
                        </div>
                        <div className="p-2 bg-muted/30 rounded flex items-center gap-2">
                          {journeyDetails.verification.addressVerified ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className={journeyDetails.verification.addressVerified ? "font-medium" : "text-muted-foreground"}>
                            Address Verified
                          </span>
                        </div>
                        <div className="p-2 bg-muted/30 rounded flex items-center gap-2">
                          {journeyDetails.verification.phoneVerified ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className={journeyDetails.verification.phoneVerified ? "font-medium" : "text-muted-foreground"}>
                            Phone Verified
                          </span>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                          <p className="text-xs text-muted-foreground">Background Check</p>
                          <p className="font-medium capitalize">{journeyDetails.verification.backgroundCheckStatus || "Not started"}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {journeyDetails.familyMembers && journeyDetails.familyMembers.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Family Members ({journeyDetails.familyMembers.length})
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {journeyDetails.familyMembers.map((member) => (
                          <div key={member.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={member.profileImage} />
                              <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                                {member.name?.charAt(0)?.toUpperCase() || 'F'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              <p className="font-medium">{member.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {member.relationship}{member.age ? `, ${member.age}` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {journeyDetails.householdPets && journeyDetails.householdPets.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <PawPrint className="h-4 w-4" />
                        Household Pets ({journeyDetails.householdPets.length})
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {journeyDetails.householdPets.map((pet) => (
                          <div key={pet.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={pet.photo} />
                              <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                                {pet.species === 'cat' ? <Cat className="w-4 h-4" /> : <DogIcon className="w-4 h-4" />}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              <p className="font-medium">{pet.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {pet.species}{pet.breed ? ` (${pet.breed})` : ''}{pet.age ? `, ${pet.age}y` : ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {journeyDetails.applicationResponses && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Clipboard className="h-4 w-4" />
                        Application Responses
                      </h4>
                      <div className="space-y-4">
                        {journeyDetails.applicationResponses.whyThisDog && (
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Why This Dog</p>
                            <p className="text-sm">{journeyDetails.applicationResponses.whyThisDog}</p>
                          </div>
                        )}
                        {journeyDetails.applicationResponses.experienceDescription && (
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Pet Experience</p>
                            <p className="text-sm">{journeyDetails.applicationResponses.experienceDescription}</p>
                          </div>
                        )}
                        {journeyDetails.applicationResponses.workSchedule && (
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Work Schedule</p>
                            <p className="text-sm">{journeyDetails.applicationResponses.workSchedule}</p>
                          </div>
                        )}
                        {journeyDetails.applicationResponses.householdMembers && (
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Household Description</p>
                            <p className="text-sm">{journeyDetails.applicationResponses.householdMembers}</p>
                          </div>
                        )}
                        {journeyDetails.applicationResponses.otherPetsDescription && (
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <p className="text-xs text-muted-foreground font-medium mb-1">Other Pets Description</p>
                            <p className="text-sm">{journeyDetails.applicationResponses.otherPetsDescription}</p>
                          </div>
                        )}

                        {/* Custom Shelter Questions */}
                        {journeyDetails.applicationResponses.customResponses && 
                         Object.keys(journeyDetails.applicationResponses.customResponses).length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                              Custom Questions
                            </p>
                            <div className="space-y-3">
                              {Object.entries(journeyDetails.applicationResponses.customResponses).map(([questionId, response]) => {
                                if (!response) return null;
                                
                                // Find question metadata if available
                                const question = shelterQuestions?.questions?.find(q => q.id === questionId);
                                const questionLabel = question?.questionText || `[Deleted Question] ${questionId.slice(0, 8)}...`;
                                
                                // Format the response (handle arrays for multiselect)
                                const formattedResponse = Array.isArray(response) 
                                  ? response.join(', ') 
                                  : String(response);
                                
                                return (
                                  <div key={questionId} className={`p-3 rounded-lg border ${question ? 'bg-primary/5 border-primary/10' : 'bg-muted/50 border-muted'}`}>
                                    <p className={`text-xs font-medium mb-1 ${question ? 'text-primary' : 'text-muted-foreground italic'}`}>
                                      {questionLabel}
                                      {!question && <span className="ml-2 text-xs">(Question no longer exists)</span>}
                                    </p>
                                    <p className="text-sm">{formattedResponse}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add notes about this application..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="mt-2"
                    data-testid="input-notes"
                  />
                </div>
              </div>
            ) : null}
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {selectedJourney && selectedJourney.status !== "rejected" && selectedJourney.status !== "completed" && !selectedJourney.approvedAt && (
                  <>
                    <Button
                      onClick={() => setApproveDialogOpen(true)}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-approve-dialog"
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setRejectDialogOpen(true)}
                      data-testid="button-reject-dialog"
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}
                {selectedJourney?.currentStep === "meet_greet" && (
                  <Button
                    onClick={() => setCompleteDialogOpen(true)}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-complete-dialog"
                  >
                    <PartyPopper className="mr-2 h-4 w-4" />
                    Complete Adoption
                  </Button>
                )}
              </div>
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <AlertDialogContent data-testid="dialog-approve">
            <AlertDialogHeader>
              <AlertDialogTitle>Approve Application</AlertDialogTitle>
              <AlertDialogDescription>
                This will approve the application and move the adopter to the phone screening step.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleApprove}
                className="bg-green-600 hover:bg-green-700"
                disabled={approveMutation.isPending}
                data-testid="button-confirm-approve"
              >
                {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve Application
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <AlertDialogContent data-testid="dialog-reject">
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Application</AlertDialogTitle>
              <AlertDialogDescription>
                Please provide a reason for rejecting this application.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                data-testid="input-rejection-reason"
              />
            </div>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReject}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={rejectMutation.isPending}
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reject Application
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <DialogContent className="w-[95vw] md:w-full max-w-md" data-testid="dialog-complete">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-green-500" />
                Complete Adoption
              </DialogTitle>
              <DialogDescription>
                Finalize the adoption for {selectedJourney?.dog?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="fee">Adoption Fee (optional)</Label>
                <div className="relative mt-2">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fee"
                    type="number"
                    placeholder="0.00"
                    value={adoptionFee}
                    onChange={(e) => setAdoptionFee(e.target.value)}
                    className="pl-9"
                    data-testid="input-adoption-fee"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="complete-notes">Final Notes</Label>
                <Textarea
                  id="complete-notes"
                  placeholder="Any notes about the adoption..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="mt-2"
                  data-testid="input-complete-notes"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleComplete}
                className="bg-green-600 hover:bg-green-700"
                disabled={completeMutation.isPending}
                data-testid="button-confirm-complete"
              >
                {completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Adoption
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent className="w-[95vw] md:w-full max-w-md" data-testid="dialog-schedule">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarPlus className="h-5 w-5" />
                Schedule Meet & Greet
              </DialogTitle>
              <DialogDescription>
                Schedule a meet & greet for {selectedJourney?.user?.firstName} with {selectedJourney?.dog?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="meet-date">Date</Label>
                <Input
                  id="meet-date"
                  type="date"
                  value={meetGreetDate}
                  onChange={(e) => setMeetGreetDate(e.target.value)}
                  className="mt-2"
                  data-testid="input-meet-date"
                />
              </div>
              <div>
                <Label htmlFor="meet-time">Time</Label>
                <Input
                  id="meet-time"
                  type="time"
                  value={meetGreetTime}
                  onChange={(e) => setMeetGreetTime(e.target.value)}
                  className="mt-2"
                  data-testid="input-meet-time"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={scheduleMutation.isPending || !meetGreetDate || !meetGreetTime}
                data-testid="button-confirm-schedule"
              >
                {scheduleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule Meet & Greet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    
  );
}
