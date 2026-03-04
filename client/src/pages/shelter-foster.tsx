import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Home,
  Users,
  Dog as DogIcon,
  Plus,
  Search,
  MapPin,
  Clock,
  Calendar,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Heart,
  UserCheck,
  ChevronRight,
  Filter,
  Gauge,
  Star,
  Lock
} from "lucide-react";
import type { Dog, FosterProfile } from "@shared/schema";

const ASSIGNMENT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "bg-amber-500", icon: Clock },
  active: { label: "Active", color: "bg-green-500", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-blue-500", icon: Star },
  cancelled: { label: "Cancelled", color: "bg-gray-500", icon: XCircle },
};

const ASSIGNMENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  standard: { label: "Standard", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  medical: { label: "Medical", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  behavioral: { label: "Behavioral", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  hospice: { label: "Hospice", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
  emergency: { label: "Emergency", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export default function ShelterFoster() {
  const { toast } = useToast();
  const { data: featureFlags, isLoading: flagsLoading } = useFeatureFlags();
  const [searchTerm, setSearchTerm] = useState("");
  
  const isFosterManagementEnabled = flagsLoading ? false : (featureFlags?.enabledFeatures?.includes('shelter_foster_management') ?? false);
  const [activeTab, setActiveTab] = useState("assignments");
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedFoster, setSelectedFoster] = useState<FosterProfile | null>(null);
  const [fosterFilters, setFosterFilters] = useState({
    sizePreference: "",
    specialNeeds: "",
    availability: "",
  });
  
  const [newAssignment, setNewAssignment] = useState({
    dogId: "",
    fosterId: "",
    assignmentType: "standard",
    expectedEndDate: "",
    careInstructions: "",
    feedingSchedule: "",
    behaviorNotes: "",
  });

  const { data: dogs, isLoading: dogsLoading } = useQuery<Dog[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const { data: assignments, isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["/api/shelter/foster-assignments"],
  });

  const { data: availableFosters, isLoading: fostersLoading } = useQuery<FosterProfile[]>({
    queryKey: ["/api/shelter/fosters/available", fosterFilters],
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/shelter/foster-assignments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/foster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/fosters/available"] });
      setIsAssignDialogOpen(false);
      resetForm();
      toast({ title: "Foster assignment created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create assignment", description: error.message, variant: "destructive" });
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/shelter/foster-assignments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/foster-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/fosters/available"] });
      toast({ title: "Assignment updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update assignment", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewAssignment({
      dogId: "",
      fosterId: "",
      assignmentType: "standard",
      expectedEndDate: "",
      careInstructions: "",
      feedingSchedule: "",
      behaviorNotes: "",
    });
    setSelectedFoster(null);
  };

  const handleSubmitAssignment = () => {
    if (!newAssignment.dogId || !newAssignment.fosterId) {
      toast({ title: "Please select a dog and foster parent", variant: "destructive" });
      return;
    }

    createAssignmentMutation.mutate({
      dogId: newAssignment.dogId,
      fosterId: newAssignment.fosterId,
      assignmentType: newAssignment.assignmentType,
      expectedEndDate: newAssignment.expectedEndDate ? new Date(newAssignment.expectedEndDate).toISOString() : undefined,
      careInstructions: newAssignment.careInstructions || undefined,
      feedingSchedule: newAssignment.feedingSchedule || undefined,
      behaviorNotes: newAssignment.behaviorNotes || undefined,
    });
  };

  const handleSelectFoster = (foster: FosterProfile) => {
    setSelectedFoster(foster);
    setNewAssignment(prev => ({ ...prev, fosterId: foster.userId }));
  };

  const activeAssignments = assignments?.filter(a => a.status === "active") || [];
  const pendingAssignments = assignments?.filter(a => a.status === "pending") || [];
  const completedAssignments = assignments?.filter(a => a.status === "completed") || [];

  const totalCapacity = availableFosters?.reduce((sum, f) => sum + (f.fosterCapacity || 1), 0) || 0;
  const currentlyFostered = activeAssignments.length;
  const availableSpots = availableFosters?.reduce((sum, f) => {
    const capacity = f.fosterCapacity || 1;
    const current = f.fosterCurrentCount || 0;
    return sum + Math.max(0, capacity - current);
  }, 0) || 0;

  const getDogById = (dogId: string): Dog | undefined => dogs?.find(d => d.id === dogId);

  if (dogsLoading || assignmentsLoading) {
    return (
      
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      
    );
  }

  return (
    
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Foster Management</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage foster assignments and find available foster homes</p>
          </div>
          <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-assignment">
                <Plus className="h-4 w-4 mr-2" />
                New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Foster Assignment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Dog *</Label>
                    <Select value={newAssignment.dogId} onValueChange={(v) => setNewAssignment(prev => ({ ...prev, dogId: v }))}>
                      <SelectTrigger data-testid="select-dog">
                        <SelectValue placeholder="Choose a dog" />
                      </SelectTrigger>
                      <SelectContent>
                        {dogs?.map((dog) => (
                          <SelectItem key={dog.id} value={dog.id}>
                            <div className="flex items-center gap-2">
                              <DogIcon className="h-4 w-4" />
                              {dog.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assignment Type</Label>
                    <Select value={newAssignment.assignmentType} onValueChange={(v) => setNewAssignment(prev => ({ ...prev, assignmentType: v }))}>
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ASSIGNMENT_TYPE_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Select Foster Parent *</Label>
                  {selectedFoster ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={selectedFoster.profileImage} />
                          <AvatarFallback>
                            {selectedFoster.firstName?.[0]}{selectedFoster.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{selectedFoster.firstName} {selectedFoster.lastName}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedFoster.city}, {selectedFoster.state}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSelectedFoster(null);
                        setNewAssignment(prev => ({ ...prev, fosterId: "" }));
                      }}>
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto">
                      {fostersLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-12" />
                          <Skeleton className="h-12" />
                        </div>
                      ) : availableFosters?.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No available fosters found</p>
                      ) : (
                        availableFosters?.map((foster) => (
                          <div
                            key={foster.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                            onClick={() => handleSelectFoster(foster)}
                            data-testid={`foster-option-${foster.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={foster.profileImage} />
                                <AvatarFallback>
                                  {foster.firstName?.[0]}{foster.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{foster.firstName} {foster.lastName}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span>{foster.city}, {foster.state}</span>
                                  {foster.distance && (
                                    <>
                                      <span className="mx-1">•</span>
                                      <span>{foster.distance.toFixed(1)} mi</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">
                                {(foster.fosterCurrentCount || 0)}/{foster.fosterCapacity || 1}
                              </Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Expected End Date</Label>
                  <Input
                    type="date"
                    value={newAssignment.expectedEndDate}
                    onChange={(e) => setNewAssignment(prev => ({ ...prev, expectedEndDate: e.target.value }))}
                    data-testid="input-end-date"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Care Instructions</Label>
                  <Textarea
                    value={newAssignment.careInstructions}
                    onChange={(e) => setNewAssignment(prev => ({ ...prev, careInstructions: e.target.value }))}
                    placeholder="Special care requirements, medications, etc."
                    data-testid="input-care-instructions"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Feeding Schedule</Label>
                  <Input
                    value={newAssignment.feedingSchedule}
                    onChange={(e) => setNewAssignment(prev => ({ ...prev, feedingSchedule: e.target.value }))}
                    placeholder="e.g., 1 cup morning, 1 cup evening"
                    data-testid="input-feeding"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Behavior Notes</Label>
                  <Textarea
                    value={newAssignment.behaviorNotes}
                    onChange={(e) => setNewAssignment(prev => ({ ...prev, behaviorNotes: e.target.value }))}
                    placeholder="Any behavioral considerations..."
                    data-testid="input-behavior"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={handleSubmitAssignment} 
                  disabled={createAssignmentMutation.isPending}
                  data-testid="button-create-assignment"
                >
                  {createAssignmentMutation.isPending ? "Creating..." : "Create Assignment"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold" data-testid="text-active-count">{activeAssignments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold" data-testid="text-pending-count">{pendingAssignments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available Fosters</p>
                  <p className="text-2xl font-bold" data-testid="text-foster-count">{availableFosters?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Gauge className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available Spots</p>
                  <p className="text-2xl font-bold" data-testid="text-spots-count">{availableSpots}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="assignments" className="flex-1 sm:flex-none" data-testid="tab-assignments">
              Assignments
              {pendingAssignments.length > 0 && (
                <Badge variant="secondary" className="ml-2">{pendingAssignments.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="fosters" className="flex-1 sm:flex-none" data-testid="tab-fosters">
              Find Fosters
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assignments" className="mt-4 space-y-4">
            {pendingAssignments.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Approval ({pendingAssignments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingAssignments.map((assignment) => (
                      <AssignmentCard 
                        key={assignment.id} 
                        assignment={assignment} 
                        dog={getDogById(assignment.dogId)}
                        onApprove={() => updateAssignmentMutation.mutate({ id: assignment.id, data: { status: "active" } })}
                        onCancel={() => updateAssignmentMutation.mutate({ id: assignment.id, data: { status: "cancelled" } })}
                        isPending
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Active Assignments ({activeAssignments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeAssignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Home className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No active foster assignments</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeAssignments.map((assignment) => (
                      <AssignmentCard 
                        key={assignment.id} 
                        assignment={assignment}
                        dog={getDogById(assignment.dogId)}
                        onComplete={() => updateAssignmentMutation.mutate({ 
                          id: assignment.id, 
                          data: { status: "completed", actualEndDate: new Date().toISOString() } 
                        })}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {completedAssignments.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-muted-foreground flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Recently Completed ({completedAssignments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {completedAssignments.slice(0, 5).map((assignment) => (
                      <AssignmentCard 
                        key={assignment.id} 
                        assignment={assignment}
                        dog={getDogById(assignment.dogId)}
                        isCompleted
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="fosters" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search fosters..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-fosters"
                    />
                  </div>
                  <Select 
                    value={fosterFilters.sizePreference} 
                    onValueChange={(v) => setFosterFilters(prev => ({ ...prev, sizePreference: v }))}
                  >
                    <SelectTrigger className="w-full sm:w-40" data-testid="select-size-filter">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Size</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={fosterFilters.availability} 
                    onValueChange={(v) => setFosterFilters(prev => ({ ...prev, availability: v }))}
                  >
                    <SelectTrigger className="w-full sm:w-44" data-testid="select-availability-filter">
                      <SelectValue placeholder="Availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="same_day">Same Day</SelectItem>
                      <SelectItem value="few_days">Few Days</SelectItem>
                      <SelectItem value="week_notice">Week Notice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {fostersLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                ) : availableFosters?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No available foster homes found</p>
                    <p className="text-sm mt-1">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableFosters
                      ?.filter(f => 
                        searchTerm === "" || 
                        `${f.firstName} ${f.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        f.city?.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((foster) => (
                        <FosterCard key={foster.id} foster={foster} />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    
  );
}

function AssignmentCard({ 
  assignment, 
  dog,
  isPending = false,
  isCompleted = false,
  onApprove,
  onCancel,
  onComplete,
}: { 
  assignment: any; 
  dog?: Dog;
  isPending?: boolean;
  isCompleted?: boolean;
  onApprove?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
}) {
  const statusConfig = ASSIGNMENT_STATUS_CONFIG[assignment.status] || ASSIGNMENT_STATUS_CONFIG.pending;
  const typeConfig = ASSIGNMENT_TYPE_CONFIG[assignment.assignmentType] || ASSIGNMENT_TYPE_CONFIG.standard;
  const StatusIcon = statusConfig.icon;

  return (
    <div className={`flex items-start gap-4 p-4 rounded-lg border ${isCompleted ? "opacity-60" : ""}`} data-testid={`card-assignment-${assignment.id}`}>
      <div className={`p-2 rounded-lg ${statusConfig.color} text-white`}>
        <StatusIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{dog?.name || "Unknown Dog"}</span>
          <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1 flex-wrap">
          <Home className="h-3 w-3" />
          <span>{assignment.fosterName || "Foster Parent"}</span>
          {assignment.startDate && (
            <>
              <span className="mx-1">•</span>
              <Calendar className="h-3 w-3" />
              <span>Started {format(new Date(assignment.startDate), "MMM d, yyyy")}</span>
            </>
          )}
        </div>
        {assignment.expectedEndDate && !isCompleted && (
          <p className="text-xs text-muted-foreground mt-1">
            Expected return: {format(new Date(assignment.expectedEndDate), "MMM d, yyyy")}
          </p>
        )}
      </div>
      {isPending && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onCancel} data-testid={`button-cancel-${assignment.id}`}>
            <XCircle className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={onApprove} data-testid={`button-approve-${assignment.id}`}>
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      {!isPending && !isCompleted && (
        <Button size="sm" variant="outline" onClick={onComplete} data-testid={`button-complete-${assignment.id}`}>
          Complete
        </Button>
      )}
      {isCompleted && assignment.actualEndDate && (
        <Badge variant="outline" className="shrink-0">
          {formatDistanceToNow(new Date(assignment.actualEndDate), { addSuffix: true })}
        </Badge>
      )}
    </div>
  );
}

function FosterCard({ foster }: { foster: FosterProfile }) {
  const availableSpots = (foster.fosterCapacity || 1) - (foster.fosterCurrentCount || 0);
  const isAtCapacity = availableSpots <= 0;

  return (
    <Card className={`hover-elevate ${isAtCapacity ? "opacity-60" : ""}`} data-testid={`card-foster-${foster.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={foster.profileImage} />
            <AvatarFallback>
              {foster.firstName?.[0]}{foster.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium truncate">{foster.firstName} {foster.lastName}</h3>
              <Badge variant={isAtCapacity ? "secondary" : "default"}>
                {foster.fosterCurrentCount || 0}/{foster.fosterCapacity || 1}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />
              <span>{foster.city}, {foster.state}</span>
              {foster.distance && (
                <span className="ml-1">({foster.distance.toFixed(1)} mi)</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {foster.fosterSizePreference?.map((size) => (
                <Badge key={size} variant="outline" className="text-xs capitalize">{size}</Badge>
              ))}
              {foster.fosterSpecialNeedsWilling && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  Special Needs OK
                </Badge>
              )}
            </div>
            {foster.fosterEmergencyAvailability && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {foster.fosterEmergencyAvailability === "same_day" && "Available same day"}
                  {foster.fosterEmergencyAvailability === "few_days" && "Available within days"}
                  {foster.fosterEmergencyAvailability === "week_notice" && "Needs week notice"}
                  {foster.fosterEmergencyAvailability === "month_notice" && "Needs month notice"}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
