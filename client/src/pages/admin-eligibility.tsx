import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  Dog as DogIcon, 
  Loader2,
  FileText,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  AlertCircle,
  MapPin,
  Mail,
  Calendar,
  Home,
  Users,
  Shield,
  HeartHandshake,
  ArrowUpRight,
  History,
  Brain,
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

interface EligibilityJourney {
  id: string;
  userId: string;
  dogId: string;
  currentStep: string;
  status: string;
  eligibilityStatus: string;
  eligibilityReviewedBy?: string;
  eligibilityReviewedAt?: string;
  eligibilityNotes?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  escalationReason?: string;
  applicationSubmittedAt?: string;
  applicationResponses?: Record<string, any>;
  phoneScreeningStatus?: string;
  phoneScreeningTranscript?: string;
  phoneScreeningSummary?: string;
  aiReviewScore?: number;
  aiRecommendation?: string;
  aiReviewSummary?: string;
  createdAt: string;
  dog?: {
    id: string;
    name: string;
    breed: string;
    photos: string[];
    age?: number;
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
    experienceLevel?: string;
  };
  applicationQuestions?: Array<{
    id: string;
    questionText: string;
    questionType: string;
    section: string;
  }>;
  previousApplications?: Array<{
    id: string;
    dogName: string;
    status: string;
    date: string;
  }>;
}

interface EligibilityMetrics {
  pendingEligibility: number;
  eligible: number;
  ineligible: number;
  escalated: number;
}

export default function AdminEligibility() {
  const { toast } = useToast();
  const [selectedJourney, setSelectedJourney] = useState<EligibilityJourney | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [eligibleDialogOpen, setEligibleDialogOpen] = useState(false);
  const [ineligibleDialogOpen, setIneligibleDialogOpen] = useState(false);
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [eligibilityNotes, setEligibilityNotes] = useState('');
  const [escalationReason, setEscalationReason] = useState('');

  const { data: journeys = [], isLoading } = useQuery<EligibilityJourney[]>({
    queryKey: ['/api/admin/eligibility-queue'],
    staleTime: 0,
  });

  const { data: metrics } = useQuery<EligibilityMetrics>({
    queryKey: ['/api/admin/eligibility-metrics'],
  });

  const { data: journeyDetails, isLoading: isLoadingDetails } = useQuery<EligibilityJourney>({
    queryKey: ['/api/admin/eligibility-queue', selectedJourney?.id],
    enabled: !!selectedJourney?.id && reviewDialogOpen,
    staleTime: 0,
  });

  const markEligibleMutation = useMutation({
    mutationFn: ({ journeyId, notes }: { journeyId: string; notes?: string }) =>
      apiRequest('PATCH', `/api/admin/eligibility/${journeyId}/eligible`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/eligibility-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/eligibility-metrics'] });
      setEligibleDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedJourney(null);
      setEligibilityNotes('');
      toast({
        title: "Marked Eligible",
        description: "The applicant has been approved for adoption and is now visible to shelters.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update eligibility.",
        variant: "destructive",
      });
    },
  });

  const markIneligibleMutation = useMutation({
    mutationFn: ({ journeyId, notes }: { journeyId: string; notes?: string }) =>
      apiRequest('PATCH', `/api/admin/eligibility/${journeyId}/ineligible`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/eligibility-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/eligibility-metrics'] });
      setIneligibleDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedJourney(null);
      setEligibilityNotes('');
      toast({
        title: "Marked Ineligible",
        description: "The applicant has been marked as ineligible for adoption.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update eligibility.",
        variant: "destructive",
      });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: ({ journeyId, reason }: { journeyId: string; reason: string }) =>
      apiRequest('PATCH', `/api/admin/eligibility/${journeyId}/escalate`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/eligibility-queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/eligibility-metrics'] });
      setEscalateDialogOpen(false);
      setReviewDialogOpen(false);
      setSelectedJourney(null);
      setEscalationReason('');
      toast({
        title: "Escalated to Platform Admin",
        description: "This case has been escalated for policy review.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to escalate.",
        variant: "destructive",
      });
    },
  });

  const getEligibilityStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_eligibility':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending Review</Badge>;
      case 'eligible':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Eligible</Badge>;
      case 'ineligible':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Ineligible</Badge>;
      case 'escalated':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Escalated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAIScoreBadge = (score?: number) => {
    if (score === undefined) return null;
    const color = score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red';
    return (
      <Badge variant="outline" className={`bg-${color}-50 text-${color}-700 border-${color}-200`}>
        AI: {score}/100
      </Badge>
    );
  };

  const pendingJourneys = journeys.filter(j => j.eligibilityStatus === 'pending_eligibility');
  const eligibleJourneys = journeys.filter(j => j.eligibilityStatus === 'eligible');
  const ineligibleJourneys = journeys.filter(j => j.eligibilityStatus === 'ineligible');
  const escalatedJourneys = journeys.filter(j => j.eligibilityStatus === 'escalated');

  const openReviewDialog = (journey: EligibilityJourney) => {
    setSelectedJourney(journey);
    setReviewDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const JourneyCard = ({ journey }: { journey: EligibilityJourney }) => (
    <Card 
      className="cursor-pointer hover-elevate"
      onClick={() => openReviewDialog(journey)}
      data-testid={`card-eligibility-${journey.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={journey.dog?.photos?.[0]} />
            <AvatarFallback><DogIcon className="h-6 w-6" /></AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold truncate">
                {journey.user?.firstName} {journey.user?.lastName}
              </h3>
              {getEligibilityStatusBadge(journey.eligibilityStatus)}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              Applying for: {journey.dog?.name} ({journey.dog?.breed})
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {journey.aiReviewScore && (
                <Badge variant="secondary" className="text-xs">
                  <Brain className="h-3 w-3 mr-1" />
                  AI Score: {journey.aiReviewScore}
                </Badge>
              )}
              {journey.phoneScreeningStatus === 'completed' && (
                <Badge variant="secondary" className="text-xs">
                  <Phone className="h-3 w-3 mr-1" />
                  Screened
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(journey.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" data-testid={`button-review-${journey.id}`}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-admin-eligibility">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trust & Safety</h1>
          <p className="text-muted-foreground">
            Review adopter eligibility before shelters see applications
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-metric-pending">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.pendingEligibility || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting T&S decision</p>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-eligible">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eligible</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.eligible || 0}</div>
            <p className="text-xs text-muted-foreground">Approved for shelter matching</p>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-ineligible">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ineligible</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.ineligible || 0}</div>
            <p className="text-xs text-muted-foreground">Not approved to adopt</p>
          </CardContent>
        </Card>
        <Card data-testid="card-metric-escalated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalated</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.escalated || 0}</div>
            <p className="text-xs text-muted-foreground">Sent to Platform Admin</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingJourneys.length})
          </TabsTrigger>
          <TabsTrigger value="eligible" data-testid="tab-eligible">
            Eligible ({eligibleJourneys.length})
          </TabsTrigger>
          <TabsTrigger value="ineligible" data-testid="tab-ineligible">
            Ineligible ({ineligibleJourneys.length})
          </TabsTrigger>
          <TabsTrigger value="escalated" data-testid="tab-escalated">
            Escalated ({escalatedJourneys.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-4">
          {pendingJourneys.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="font-semibold text-lg">All caught up!</h3>
                <p className="text-muted-foreground">No pending eligibility reviews.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pendingJourneys.map(journey => (
                <JourneyCard key={journey.id} journey={journey} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="eligible" className="space-y-4 mt-4">
          {eligibleJourneys.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No eligible applicants</h3>
                <p className="text-muted-foreground">Approved applicants will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {eligibleJourneys.map(journey => (
                <JourneyCard key={journey.id} journey={journey} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ineligible" className="space-y-4 mt-4">
          {ineligibleJourneys.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No ineligible applicants</h3>
                <p className="text-muted-foreground">Rejected applicants will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {ineligibleJourneys.map(journey => (
                <JourneyCard key={journey.id} journey={journey} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="escalated" className="space-y-4 mt-4">
          {escalatedJourneys.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ArrowUpRight className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No escalated cases</h3>
                <p className="text-muted-foreground">Cases escalated to Platform Admin will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {escalatedJourneys.map(journey => (
                <JourneyCard key={journey.id} journey={journey} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Eligibility Review</DialogTitle>
            <DialogDescription>
              Review this applicant's eligibility to adopt
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : journeyDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Applicant Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span>{journeyDetails.user?.firstName} {journeyDetails.user?.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span>{journeyDetails.user?.email}</span>
                    </div>
                    {journeyDetails.userProfile?.city && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span>{journeyDetails.userProfile.city}, {journeyDetails.userProfile.state}</span>
                      </div>
                    )}
                    {journeyDetails.userProfile?.homeType && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Home Type</span>
                        <span className="capitalize">{journeyDetails.userProfile.homeType}</span>
                      </div>
                    )}
                    {journeyDetails.userProfile?.experienceLevel && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Experience</span>
                        <span className="capitalize">{journeyDetails.userProfile.experienceLevel.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DogIcon className="h-4 w-4" />
                      Dog Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={journeyDetails.dog?.photos?.[0]} />
                        <AvatarFallback><PawPrint className="h-6 w-6" /></AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{journeyDetails.dog?.name}</p>
                        <p className="text-muted-foreground">{journeyDetails.dog?.breed}</p>
                      </div>
                    </div>
                    {journeyDetails.dog?.age && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Age</span>
                        <span>{journeyDetails.dog.age} years</span>
                      </div>
                    )}
                    {journeyDetails.dog?.size && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size</span>
                        <span className="capitalize">{journeyDetails.dog.size}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {journeyDetails.aiReviewScore !== undefined && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      AI Review Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`text-2xl font-bold ${
                        journeyDetails.aiReviewScore >= 80 ? 'text-green-600' : 
                        journeyDetails.aiReviewScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {journeyDetails.aiReviewScore}/100
                      </div>
                      {journeyDetails.aiRecommendation && (
                        <Badge variant={
                          journeyDetails.aiRecommendation === 'approve' ? 'default' : 
                          journeyDetails.aiRecommendation === 'request_more_info' ? 'secondary' : 'destructive'
                        }>
                          {journeyDetails.aiRecommendation.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    {journeyDetails.aiReviewSummary && (
                      <p className="text-sm text-muted-foreground">{journeyDetails.aiReviewSummary}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {journeyDetails.phoneScreeningTranscript && (
                <Collapsible open={transcriptOpen} onOpenChange={setTranscriptOpen}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Phone Screening Transcript
                          </CardTitle>
                          {transcriptOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                        {journeyDetails.phoneScreeningSummary && (
                          <CardDescription className="text-xs">
                            {journeyDetails.phoneScreeningSummary.substring(0, 150)}...
                          </CardDescription>
                        )}
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent>
                        <ScrollArea className="h-64 w-full rounded-md border p-4">
                          <pre className="text-xs whitespace-pre-wrap font-mono">
                            {journeyDetails.phoneScreeningTranscript}
                          </pre>
                        </ScrollArea>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {journeyDetails.applicationResponses && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Application Responses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <div className="space-y-3">
                        {Object.entries(journeyDetails.applicationResponses).map(([questionId, answer]) => {
                          const question = journeyDetails.applicationQuestions?.find(q => q.id === questionId);
                          return (
                            <div key={questionId} className="border-b pb-2 last:border-0">
                              <p className="text-sm font-medium">{question?.questionText || questionId}</p>
                              <p className="text-sm text-muted-foreground">{String(answer)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {journeyDetails.previousApplications && journeyDetails.previousApplications.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Previous Applications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {journeyDetails.previousApplications.map(app => (
                        <div key={app.id} className="flex items-center justify-between text-sm">
                          <span>{app.dogName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{app.date}</span>
                            <Badge variant={app.status === 'completed' ? 'default' : 'secondary'}>
                              {app.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              <div className="space-y-3">
                <label className="text-sm font-medium">Eligibility Notes</label>
                <Textarea
                  placeholder="Add notes about your decision..."
                  value={eligibilityNotes}
                  onChange={(e) => setEligibilityNotes(e.target.value)}
                  className="min-h-20"
                  data-testid="input-eligibility-notes"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setSelectedJourney(null);
                setEligibilityNotes('');
              }}
              data-testid="button-cancel-review"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="text-purple-600 border-purple-200 hover:bg-purple-50"
              onClick={() => setEscalateDialogOpen(true)}
              data-testid="button-escalate"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Escalate
            </Button>
            <Button
              variant="destructive"
              onClick={() => setIneligibleDialogOpen(true)}
              data-testid="button-mark-ineligible"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Ineligible
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setEligibleDialogOpen(true)}
              data-testid="button-mark-eligible"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Eligible
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={eligibleDialogOpen} onOpenChange={setEligibleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Eligible to Adopt?</AlertDialogTitle>
            <AlertDialogDescription>
              This applicant will be marked as eligible and their application will become visible to the shelter for final match approval.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={() => selectedJourney && markEligibleMutation.mutate({
                journeyId: selectedJourney.id,
                notes: eligibilityNotes
              })}
              disabled={markEligibleMutation.isPending}
              data-testid="button-confirm-eligible"
            >
              {markEligibleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirm Eligible
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={ineligibleDialogOpen} onOpenChange={setIneligibleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Ineligible?</AlertDialogTitle>
            <AlertDialogDescription>
              This applicant will be marked as ineligible and will not be able to adopt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedJourney && markIneligibleMutation.mutate({
                journeyId: selectedJourney.id,
                notes: eligibilityNotes
              })}
              disabled={markIneligibleMutation.isPending}
              data-testid="button-confirm-ineligible"
            >
              {markIneligibleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Confirm Ineligible
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={escalateDialogOpen} onOpenChange={setEscalateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Escalate to Platform Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              This case will be sent to a Platform Admin for policy review and final decision.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Reason for escalation..."
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
              className="min-h-20"
              data-testid="input-escalation-reason"
            />
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => selectedJourney && escalateMutation.mutate({
                journeyId: selectedJourney.id,
                reason: escalationReason
              })}
              disabled={escalateMutation.isPending || !escalationReason.trim()}
              data-testid="button-confirm-escalate"
            >
              {escalateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowUpRight className="h-4 w-4 mr-2" />
              )}
              Confirm Escalation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
