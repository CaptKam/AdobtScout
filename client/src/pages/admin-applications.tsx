import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Phone, 
  CheckCircle, 
  User, 
  Dog as DogIcon, 
  Loader2,
  FileText,
  Play,
  PhoneCall,
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
  PawPrint
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
  phoneScreeningRecordingUrl?: string;
  vapiCallId?: string;
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
    reasonForRehoming?: string;
    profileImage?: string;
    latitude?: number;
    longitude?: number;
    searchRadius?: number;
    fosterTimeCommitment?: string;
    fosterSpecialNeedsWilling?: boolean;
    fosterEmergencyAvailability?: string;
    fosterPreviousExperience?: string;
  };
  applicationQuestions?: Array<{
    id: string;
    questionText: string;
    questionType: string;
    section: string;
  }>;
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
    temperament?: string[] | string;
    photo?: string;
  }>;
  verification?: {
    userId: string;
    idVerified?: boolean;
    addressVerified?: boolean;
    phoneVerified?: boolean;
    backgroundCheckStatus?: string;
    homeVisitStatus?: string;
  };
}

export default function AdminApplications() {
  const { toast } = useToast();
  const [selectedJourney, setSelectedJourney] = useState<AdoptionJourney | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const { data: journeys = [], isLoading } = useQuery<AdoptionJourney[]>({
    queryKey: ['/api/admin/adoption-journeys'],
    staleTime: 0, // Always fetch fresh data for admin views
    refetchInterval: (query) => {
      // Poll every 5 seconds if there are any calls in progress
      const hasInProgressCalls = query.state.data?.some(
        (j: AdoptionJourney) => j.phoneScreeningStatus === "in_progress"
      );
      return hasInProgressCalls ? 5000 : false;
    },
  });

  const { data: journeyDetails, isLoading: isLoadingDetails } = useQuery<AdoptionJourney>({
    queryKey: ['/api/admin/adoption-journeys', selectedJourney?.id],
    enabled: !!selectedJourney?.id && reviewDialogOpen,
    staleTime: 0, // Always fetch fresh data for admin views
  });

  const approveMutation = useMutation({
    mutationFn: ({ journeyId, notes }: { journeyId: string; notes?: string }) =>
      apiRequest('PATCH', `/api/admin/adoption-journeys/${journeyId}/approve`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/adoption-journeys'] });
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
      apiRequest('PATCH', `/api/admin/adoption-journeys/${journeyId}/reject`, { reason, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/adoption-journeys'] });
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

  const blockMutation = useMutation({
    mutationFn: ({ journeyId, reason, notes }: { journeyId: string; reason: string; notes?: string }) =>
      apiRequest('PATCH', `/api/admin/adoption-journeys/${journeyId}/block`, { reason, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/adoption-journeys'] });
      setBlockDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedJourney(null);
      setBlockReason('');
      setAdminNotes('');
      toast({
        title: "Application Blocked",
        description: "The application has been blocked by admin.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to block application.",
        variant: "destructive",
      });
    },
  });

  const initiateCallMutation = useMutation({
    mutationFn: ({ journeyId, phoneNumber }: { journeyId: string; phoneNumber: string }) =>
      apiRequest('POST', `/api/adoption-journeys/${journeyId}/initiate-call`, { phoneNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/adoption-journeys'] });
      setCallDialogOpen(false);
      setSelectedJourney(null);
      toast({
        title: "Call initiated",
        description: "The AI phone screening call has been started.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate call. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveTranscriptMutation = useMutation({
    mutationFn: ({ journeyId, notes }: { journeyId: string; notes?: string }) =>
      apiRequest('PATCH', `/api/admin/adoption-journeys/${journeyId}/approve-transcript`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/adoption-journeys'] });
      setReviewDialogOpen(false);
      setSelectedJourney(null);
      setAdminNotes('');
      toast({
        title: "Transcript Approved",
        description: "The phone screening has been approved. Applicant can now schedule a meet & greet.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve transcript.",
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

  const handleBlock = () => {
    if (!selectedJourney || !blockReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for blocking.",
        variant: "destructive",
      });
      return;
    }
    blockMutation.mutate({
      journeyId: selectedJourney.id,
      reason: blockReason,
      notes: adminNotes,
    });
  };

  const handleInitiateCall = () => {
    if (!selectedJourney || !selectedJourney.userProfile?.phoneNumber) {
      toast({
        title: "Error",
        description: "No phone number available for this applicant.",
        variant: "destructive",
      });
      return;
    }

    initiateCallMutation.mutate({
      journeyId: selectedJourney.id,
      phoneNumber: selectedJourney.userProfile.phoneNumber,
    });
  };

  const handleApproveTranscript = () => {
    if (!selectedJourney) return;
    approveTranscriptMutation.mutate({
      journeyId: selectedJourney.id,
      notes: adminNotes,
    });
  };

  const getStatusBadge = (journey: AdoptionJourney) => {
    if (journey.status === "blocked") {
      return (
        <Badge variant="destructive" className="bg-red-900 text-red-100">
          <Shield className="w-3 h-3 mr-1" />
          Blocked
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
    // Check if phone screening transcript is awaiting admin review
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

  const approved = journeys.filter(
    j => j.status === "approved" || j.approvedAt
  );

  const rejected = journeys.filter(
    j => j.status === "rejected" || j.rejectedAt
  );

  const allApplications = journeys;

  const renderApplicationCard = (journey: AdoptionJourney, showActions: boolean = true) => (
    <Card key={journey.id} data-testid={`card-journey-${journey.id}`} className="hover-elevate transition-all">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            {journey.dog?.photos?.[0] && (
              <img
                src={journey.dog.photos[0]}
                alt={journey.dog.name}
                className="w-14 h-14 rounded-xl object-cover"
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
              <p className="font-medium">
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
              Review Application
            </Button>
            
            {journey.status !== "rejected" && journey.status !== "approved" && !journey.approvedAt && (
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
             journey.phoneScreeningStatus !== "completed" && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedJourney(journey);
                  setCallDialogOpen(true);
                }}
                disabled={!journey.userProfile?.phoneNumber || journey.phoneScreeningStatus === "in_progress"}
                data-testid={`button-call-${journey.id}`}
              >
                {journey.phoneScreeningStatus === "in_progress" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Call in Progress
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Start AI Call
                  </>
                )}
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
              Admin Notes
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
                  {journey.phoneScreeningRecordingUrl && (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(journey.phoneScreeningRecordingUrl, '_blank')}
                        data-testid={`button-recording-${journey.id}`}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Listen to Recording
                      </Button>
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
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="page-admin-applications">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Adoption Applications</h1>
        <p className="text-muted-foreground">
          Review, approve, or reject adoption applications
        </p>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="pending" data-testid="tab-pending" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Pending</span>
            <Badge variant="secondary" className="ml-1">{pendingReview.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="transcript" data-testid="tab-transcript" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Transcripts</span>
            <Badge variant="secondary" className="ml-1">{pendingTranscriptReview.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved" className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Approved</span>
            <Badge variant="secondary" className="ml-1">{approved.length}</Badge>
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

        <TabsContent value="transcript" className="space-y-4 mt-6">
          {isLoading ? (
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ) : pendingTranscriptReview.length === 0 ? (
            renderEmptyState(
              <MessageSquare className="mx-auto h-12 w-12 opacity-50" />,
              "No phone screening transcripts to review"
            )
          ) : (
            pendingTranscriptReview.map((journey) => renderApplicationCard(journey))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4 mt-6">
          {isLoading ? (
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-24 bg-muted rounded" />
              </CardContent>
            </Card>
          ) : approved.length === 0 ? (
            renderEmptyState(
              <CheckCircle className="mx-auto h-12 w-12 opacity-50" />,
              "No approved applications yet"
            )
          ) : (
            approved.map((journey) => renderApplicationCard(journey))
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-review">
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
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Applicant Information
                </h4>
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

                {/* Lifestyle & Home Info */}
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

                {/* Family & Experience */}
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

                {/* Preferences */}
                {(journeyDetails.userProfile?.preferredSize?.length || 
                  journeyDetails.userProfile?.preferredAge?.length || 
                  journeyDetails.userProfile?.preferredEnergy?.length) && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Dog Preferences</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Preferred Size</p>
                        <p className="font-medium capitalize">
                          {journeyDetails.userProfile?.preferredSize?.length 
                            ? journeyDetails.userProfile.preferredSize.join(', ') 
                            : "Any"}
                        </p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Preferred Age</p>
                        <p className="font-medium capitalize">
                          {journeyDetails.userProfile?.preferredAge?.length 
                            ? journeyDetails.userProfile.preferredAge.join(', ') 
                            : "Any"}
                        </p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Energy Level</p>
                        <p className="font-medium capitalize">
                          {journeyDetails.userProfile?.preferredEnergy?.length 
                            ? journeyDetails.userProfile.preferredEnergy.map(e => e.replace('_', ' ')).join(', ') 
                            : "Any"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Exercise Commitment & Children Ages */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Additional Details</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 bg-muted/30 rounded">
                      <p className="text-xs text-muted-foreground">Exercise Commitment</p>
                      <p className="font-medium capitalize">{journeyDetails.userProfile?.exerciseCommitment?.replace(/_/g, ' ') || "Not set"}</p>
                    </div>
                    {journeyDetails.userProfile?.hasChildren && journeyDetails.userProfile?.childrenAges?.length ? (
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Children Ages</p>
                        <p className="font-medium capitalize">{journeyDetails.userProfile.childrenAges.join(', ')}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Verification Status */}
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

              {/* Household - Family Members */}
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

              {/* Household - Pets */}
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
                            {pet.temperament && (
                              <p className="text-xs text-muted-foreground capitalize">
                                {Array.isArray(pet.temperament) ? pet.temperament.join(', ') : pet.temperament}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Foster Info (if mode is foster) */}
              {journeyDetails.userProfile?.mode === 'foster' && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <HeartHandshake className="h-4 w-4" />
                      Foster Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Time Commitment</p>
                        <p className="font-medium capitalize">{journeyDetails.userProfile.fosterTimeCommitment?.replace(/_/g, ' ') || "Not set"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Emergency Availability</p>
                        <p className="font-medium capitalize">{journeyDetails.userProfile.fosterEmergencyAvailability?.replace(/_/g, ' ') || "Not set"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Special Needs Willing</p>
                        <p className="font-medium">{journeyDetails.userProfile.fosterSpecialNeedsWilling ? "Yes" : "No"}</p>
                      </div>
                      {journeyDetails.userProfile.fosterPreviousExperience && (
                        <div className="p-2 bg-muted/30 rounded col-span-2">
                          <p className="text-xs text-muted-foreground">Previous Experience</p>
                          <p className="font-medium">{journeyDetails.userProfile.fosterPreviousExperience}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Rehome Info (if mode is rehome) */}
              {journeyDetails.userProfile?.mode === 'rehome' && journeyDetails.userProfile?.reasonForRehoming && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Rehoming Information
                    </h4>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Reason for Rehoming</p>
                      <p className="text-sm">{journeyDetails.userProfile.reasonForRehoming}</p>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Application Responses
                </h4>
                {journeyDetails.applicationResponses && Object.keys(journeyDetails.applicationResponses).length > 0 ? (
                  <div className="space-y-4">
                    {journeyDetails.applicationQuestions?.map((question) => {
                      const answer = journeyDetails.applicationResponses?.[question.id];
                      if (answer === undefined) return null;
                      return (
                        <div key={question.id} className="p-3 rounded-lg bg-muted/30">
                          <p className="text-sm font-medium text-muted-foreground">{question.questionText}</p>
                          <p className="mt-1">
                            {typeof answer === 'boolean' 
                              ? (answer ? 'Yes' : 'No')
                              : Array.isArray(answer)
                              ? answer.join(', ')
                              : String(answer)}
                          </p>
                        </div>
                      );
                    })}
                    {Object.entries(journeyDetails.applicationResponses || {}).filter(([key]) => 
                      !journeyDetails.applicationQuestions?.find(q => q.id === key)
                    ).map(([key, value]) => (
                      <div key={key} className="p-3 rounded-lg bg-muted/30">
                        <p className="text-sm font-medium text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                        </p>
                        <p className="mt-1">
                          {typeof value === 'boolean' 
                            ? (value ? 'Yes' : 'No')
                            : Array.isArray(value)
                            ? value.join(', ')
                            : String(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
                    No application responses recorded. This may be a Quick Apply submission.
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Admin Notes
                </h4>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this application..."
                  className="min-h-[100px]"
                  data-testid="textarea-admin-notes"
                />
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground p-4">Failed to load application details</p>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Close
            </Button>
            {selectedJourney && selectedJourney.phoneScreeningStatus === "awaiting_review" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  data-testid="button-reject-transcript"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleApproveTranscript}
                  disabled={approveTranscriptMutation.isPending}
                  data-testid="button-approve-transcript"
                >
                  {approveTranscriptMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Approve Transcript
                    </>
                  )}
                </Button>
              </>
            )}
            {selectedJourney && selectedJourney.status !== "rejected" && selectedJourney.status !== "approved" && selectedJourney.status !== "blocked" && selectedJourney.phoneScreeningStatus !== "awaiting_review" && !selectedJourney.approvedAt && (
              <>
                <Button
                  className="bg-red-900 hover:bg-red-800 text-white"
                  onClick={() => setBlockDialogOpen(true)}
                  data-testid="button-block-dialog"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Block
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  data-testid="button-reject-dialog"
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setApproveDialogOpen(true)}
                  data-testid="button-approve-dialog"
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-approve">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Approve Application
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this application for {selectedJourney?.dog?.name}? 
              This will move the adopter to the phone screening stage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              className="bg-green-600 hover:bg-green-700"
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Approve Application
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-reject">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Reject Application
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this application? Please provide a reason (optional).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional but recommended)..."
              className="min-h-[80px]"
              data-testid="textarea-rejection-reason"
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive hover:bg-destructive/90"
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Reject Application
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent data-testid="dialog-confirm-block">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              Block Application
            </AlertDialogTitle>
            <AlertDialogDescription>
              Blocking is a serious action used to stop concerning applications. This prevents the application from proceeding and flags it for review.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Reason for blocking (required)..."
              className="min-h-[80px]"
              data-testid="textarea-block-reason"
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              className="bg-red-900 hover:bg-red-800"
              disabled={blockMutation.isPending || !blockReason.trim()}
            >
              {blockMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Blocking...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Block Application
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent data-testid="dialog-initiate-call">
          <DialogHeader>
            <DialogTitle>Start AI Phone Screening</DialogTitle>
            <DialogDescription>
              Scout AI will call {selectedJourney?.user?.firstName} to conduct a friendly phone screening about their interest in adopting {selectedJourney?.dog?.name}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              {selectedJourney?.dog?.photos?.[0] && (
                <img
                  src={selectedJourney.dog.photos[0]}
                  alt={selectedJourney.dog?.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              )}
              <div>
                <p className="font-semibold">{selectedJourney?.dog?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedJourney?.dog?.breed}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium">Calling:</p>
              <p className="text-lg font-mono">{selectedJourney?.userProfile?.phoneNumber}</p>
              <p className="text-sm text-muted-foreground">
                {selectedJourney?.user?.firstName} {selectedJourney?.user?.lastName}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCallDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInitiateCall}
              disabled={initiateCallMutation.isPending}
              data-testid="button-confirm-call"
            >
              {initiateCallMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Initiating...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-4 w-4" />
                  Start Call
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
