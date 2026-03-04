import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dog as DogIcon,
  X,
  Camera,
  Calendar,
  Clock,
  AlertTriangle,
  Heart,
  Stethoscope,
  ClipboardList,
  Users,
  Home,
  PawPrint,
  Check,
  ChevronRight,
  Syringe,
  FileText,
  MessageSquare,
  Phone,
  Mail,
  Star,
  Activity,
  Shield,
  Plus,
  Zap,
} from "lucide-react";
import type { Dog, IntakeRecord } from "@shared/schema";

export interface DogWithIntake extends Dog {
  intake: IntakeRecord | null;
}

interface DogDetailDrawerProps {
  dog: DogWithIntake | null;
  open: boolean;
  onClose: () => void;
  onStageChange?: (dogId: string, newStage: string) => void;
}

const PIPELINE_STAGES = [
  { id: 'intake', label: 'Intake', accent: 'border-muted-foreground' },
  { id: 'stray_hold', label: 'Stray Hold', accent: 'border-muted-foreground' },
  { id: 'medical_hold', label: 'Medical Hold', accent: 'border-amber-500' },
  { id: 'behavior_eval', label: 'Behavior Eval', accent: 'border-blue-500' },
  { id: 'pre_adoption_hold', label: 'Pre-Adoption Hold', accent: 'border-muted-foreground' },
  { id: 'ready', label: 'Ready', accent: 'border-green-500' },
  { id: 'featured', label: 'Featured', accent: 'border-green-500' },
  { id: 'adopted', label: 'Adopted', accent: 'border-muted-foreground' },
];

export function DogDetailDrawer({ dog, open, onClose, onStageChange }: DogDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  
  // Reset tab when opening a new dog
  const prevDogIdRef = useRef<string | null>(null);
  if (dog?.id !== prevDogIdRef.current) {
    prevDogIdRef.current = dog?.id || null;
    if (activeTab !== "overview") {
      setActiveTab("overview");
    }
  }
  
  const currentStage = dog?.intake?.pipelineStatus || 'intake';
  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.id === currentStage);

  // Fetch medical records using existing endpoint
  const { data: medicalRecords = [], isLoading: loadingMedical } = useQuery<any[]>({
    queryKey: [`/api/shelter/medical/dog/${dog?.id}`],
    enabled: !!dog?.id && open,
  });

  // Fetch vaccines using existing endpoint
  const { data: vaccines = [], isLoading: loadingVaccines } = useQuery<any[]>({
    queryKey: [`/api/shelter/medical/dog/${dog?.id}/vaccines`],
    enabled: !!dog?.id && open,
  });

  // Fetch tasks for this specific dog using query param
  const { data: tasks = [], isLoading: loadingTasks } = useQuery<any[]>({
    queryKey: [`/api/shelter/tasks?dogId=${dog?.id}`],
    enabled: !!dog?.id && open,
  });

  // Fetch applications for this specific dog using query param
  const { data: applications = [], isLoading: loadingApps } = useQuery<any[]>({
    queryKey: [`/api/shelter/applications?dogId=${dog?.id}`],
    enabled: !!dog?.id && open,
  });

  // Fetch behavior data from intake record (it's embedded in intake)
  const hasValidIntakeId = !!dog?.intake?.id && !dog.intake.id.startsWith('temp-');
  const { data: behaviorData, isLoading: loadingBehavior } = useQuery<any>({
    queryKey: hasValidIntakeId ? [`/api/shelter/intake/${dog.intake.id}`] : ['noop'],
    enabled: hasValidIntakeId && open,
  });
  const behaviorNotes = behaviorData?.behaviorNotes ? [{ notes: behaviorData.behaviorNotes, date: behaviorData.intakeDate }] : [];

  // Fetch automation runs for this dog
  const { data: automationRuns = [], isLoading: loadingAutomation, isError: automationError } = useQuery<any[]>({
    queryKey: [`/api/shelter/automation-runs?dogId=${dog?.id}&limit=20`],
    enabled: !!dog?.id && open,
  });

  // Task completion mutation
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      return apiRequest("PATCH", `/api/shelter/tasks/${taskId}`, {
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? new Date().toISOString() : null,
      });
    },
    onSuccess: () => {
      // Invalidate all task queries - use prefix matching for TanStack Query v5
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/shelter/tasks');
        }
      });
      toast({ title: "Task updated" });
    },
  });

  // Stage change mutation - uses intake endpoint like the pipeline
  const stageChangeMutation = useMutation({
    mutationFn: async (newStage: string) => {
      if (!dog) return;
      
      // If dog has intake record, update it; otherwise create one
      if (dog.intake?.id && !dog.intake.id.startsWith('temp-')) {
        return apiRequest("PATCH", `/api/shelter/intake/${dog.intake.id}`, {
          pipelineStatus: newStage,
        });
      } else {
        // Create new intake record for dogs without one
        return apiRequest("POST", `/api/shelter/intake`, {
          dogId: dog.id,
          intakeType: "owner_surrender",
          initialCondition: "good",
          pipelineStatus: newStage,
        });
      }
    },
    onSuccess: (_, newStage) => {
      if (dog && onStageChange) {
        onStageChange(dog.id, newStage);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dashboard"] });
      toast({ title: "Stage updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update stage", variant: "destructive" });
    },
  });

  if (!dog) return null;

  const getNextStageAction = () => {
    const nextIndex = currentStageIndex + 1;
    if (nextIndex >= PIPELINE_STAGES.length) return null;
    
    const nextStage = PIPELINE_STAGES[nextIndex];
    const actionLabels: Record<string, string> = {
      'stray_hold': 'Start Stray Hold',
      'medical_hold': 'Start Medical',
      'behavior_eval': 'Start Behavior Eval',
      'photos_needed': 'Request Photos',
      'ready': 'Mark Ready',
      'featured': 'Feature Dog',
      'adopted': 'Mark Adopted',
    };
    
    return {
      stage: nextStage,
      label: actionLabels[nextStage.id] || `Move to ${nextStage.label}`,
    };
  };

  const nextAction = getNextStageAction();

  const getDaysInShelter = () => {
    if (!dog.intake?.intakeDate) return null;
    return Math.floor(
      (new Date().getTime() - new Date(dog.intake.intakeDate).getTime()) /
      (1000 * 60 * 60 * 24)
    );
  };

  const daysInShelter = getDaysInShelter();
  const pendingTasks = Array.isArray(tasks) ? tasks.filter((t: any) => t.status === 'pending') : [];
  const pendingApps = Array.isArray(applications) ? applications.filter((a: any) => a.status === 'pending' || a.currentStage === 'application_submitted') : [];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col" data-testid="dog-detail-drawer">
        <SheetHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {dog.photos && dog.photos.length > 0 ? (
                  <img
                    src={dog.photos[0]}
                    alt={dog.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div>
                <SheetTitle className="text-lg flex items-center gap-2">
                  {dog.name}
                  {dog.urgencyLevel === 'urgent' && (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Urgent
                    </Badge>
                  )}
                  {dog.urgencyLevel === 'critical' && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Critical
                    </Badge>
                  )}
                </SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {dog.breed} · {dog.age}y · {dog.size}
                </p>
              </div>
            </div>
          </div>
          
          {/* Current Stage Indicator */}
          <div className="flex items-center gap-2 mt-3">
            <Badge variant="outline" className={`border-l-2 ${PIPELINE_STAGES[currentStageIndex]?.accent || 'border-muted-foreground'}`}>
              {PIPELINE_STAGES[currentStageIndex]?.label || currentStage}
            </Badge>
            {daysInShelter !== null && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {daysInShelter} days in shelter
              </span>
            )}
          </div>

          {/* Quick Action - Next Stage */}
          {nextAction && (
            <Button
              onClick={() => stageChangeMutation.mutate(nextAction.stage.id)}
              disabled={stageChangeMutation.isPending}
              className="mt-3 w-full"
              data-testid="button-next-stage"
            >
              <ChevronRight className="w-4 h-4 mr-2" />
              {nextAction.label}
            </Button>
          )}
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start px-4 pt-2 flex-shrink-0 h-auto flex-wrap gap-1">
            <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">
              <PawPrint className="w-3 h-3 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="medical" className="text-xs" data-testid="tab-medical">
              <Stethoscope className="w-3 h-3 mr-1" />
              Medical
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs relative" data-testid="tab-tasks">
              <ClipboardList className="w-3 h-3 mr-1" />
              Tasks
              {pendingTasks.length > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingTasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="applications" className="text-xs relative" data-testid="tab-applications">
              <Users className="w-3 h-3 mr-1" />
              Apps
              {pendingApps.length > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingApps.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="behavior" className="text-xs" data-testid="tab-behavior">
              <Activity className="w-3 h-3 mr-1" />
              Behavior
            </TabsTrigger>
            <TabsTrigger value="foster" className="text-xs" data-testid="tab-foster">
              <Home className="w-3 h-3 mr-1" />
              Foster
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs" data-testid="tab-activity">
              <Zap className="w-3 h-3 mr-1" />
              Activity
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* Overview Tab */}
            <TabsContent value="overview" className="p-4 mt-0">
              <OverviewTab dog={dog} daysInShelter={daysInShelter} />
            </TabsContent>

            {/* Medical Tab */}
            <TabsContent value="medical" className="p-4 mt-0">
              <MedicalTab 
                dog={dog} 
                records={medicalRecords} 
                vaccines={vaccines}
                isLoading={loadingMedical || loadingVaccines} 
              />
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="p-4 mt-0">
              <TasksTab 
                dog={dog} 
                tasks={tasks} 
                isLoading={loadingTasks}
                onToggleTask={(taskId, completed) => completeTaskMutation.mutate({ taskId, completed })}
              />
            </TabsContent>

            {/* Applications Tab */}
            <TabsContent value="applications" className="p-4 mt-0">
              <ApplicationsTab 
                dog={dog} 
                applications={applications} 
                isLoading={loadingApps} 
              />
            </TabsContent>

            {/* Behavior Tab */}
            <TabsContent value="behavior" className="p-4 mt-0">
              <BehaviorTab 
                dog={dog} 
                notes={behaviorNotes} 
                isLoading={loadingBehavior} 
              />
            </TabsContent>

            {/* Foster Tab */}
            <TabsContent value="foster" className="p-4 mt-0">
              <FosterTab dog={dog} />
            </TabsContent>

            {/* Activity Log Tab */}
            <TabsContent value="activity" className="p-4 mt-0">
              <ActivityTab 
                dog={dog} 
                automationRuns={automationRuns} 
                isLoading={loadingAutomation}
                isError={automationError}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// Overview Tab Component
function OverviewTab({ dog, daysInShelter }: { dog: DogWithIntake; daysInShelter: number | null }) {
  return (
    <div className="space-y-4">
      {/* Photo Gallery */}
      {dog.photos && dog.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {dog.photos.slice(0, 6).map((photo, i) => (
            <div key={i} className="aspect-square rounded-lg overflow-hidden bg-muted">
              <img src={photo} alt={`${dog.name} photo ${i + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{daysInShelter ?? '-'}</div>
            <div className="text-xs text-muted-foreground">Days in Shelter</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{dog.viewCount || 0}</div>
            <div className="text-xs text-muted-foreground">Profile Views</div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Breed</span>
            <span>{dog.breed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Age</span>
            <span>{dog.age} years ({dog.ageCategory})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Size</span>
            <span>{dog.size} · {dog.weight} lbs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Energy</span>
            <span className="capitalize">{dog.energyLevel?.replace('_', ' ')}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Good with Kids</span>
            <span>{dog.goodWithKids ? '✓ Yes' : '✗ No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Good with Dogs</span>
            <span>{dog.goodWithDogs ? '✓ Yes' : '✗ No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Good with Cats</span>
            <span>{dog.goodWithCats ? '✓ Yes' : '✗ No'}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vaccinated</span>
            <span>{dog.vaccinated ? '✓ Yes' : '✗ No'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Spayed/Neutered</span>
            <span>{dog.spayedNeutered ? '✓ Yes' : '✗ No'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      {dog.bio && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Bio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{dog.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Special Needs */}
      {dog.specialNeeds && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Special Needs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{dog.specialNeeds}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Medical Tab Component
function MedicalTab({ 
  dog, 
  records, 
  vaccines,
  isLoading 
}: { 
  dog: DogWithIntake; 
  records: any[]; 
  vaccines: any[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading medical records...</div>;
  }

  const safeRecords = Array.isArray(records) ? records : [];
  const safeVaccines = Array.isArray(vaccines) ? vaccines : [];

  return (
    <div className="space-y-4">
      {/* Medical Status Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className={`w-5 h-5 ${dog.vaccinated && dog.spayedNeutered ? 'text-green-500' : 'text-orange-500'}`} />
              <span className="font-medium">Medical Clearance</span>
            </div>
            <Badge variant={dog.vaccinated && dog.spayedNeutered ? 'default' : 'outline'}>
              {dog.vaccinated && dog.spayedNeutered ? 'Cleared' : 'Pending'}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Check className={`w-4 h-4 ${dog.vaccinated ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className={dog.vaccinated ? '' : 'text-muted-foreground'}>Vaccinations</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className={`w-4 h-4 ${dog.spayedNeutered ? 'text-green-500' : 'text-muted-foreground'}`} />
              <span className={dog.spayedNeutered ? '' : 'text-muted-foreground'}>Spay/Neuter</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vaccines */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Syringe className="w-4 h-4" />
            Vaccines
          </CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-add-vaccine">
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {safeVaccines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No vaccines recorded</p>
          ) : (
            <div className="space-y-2">
              {safeVaccines.map((vaccine: any) => (
                <div key={vaccine.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-medium">{vaccine.vaccineName}</span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(vaccine.dateAdministered).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {vaccine.status || 'Completed'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Records */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Medical Records
          </CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-add-record">
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {safeRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No medical records</p>
          ) : (
            <div className="space-y-2">
              {safeRecords.map((record: any) => (
                <div key={record.id} className="p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{record.type || record.recordType}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(record.date || record.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {record.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Tasks Tab Component
function TasksTab({ 
  dog, 
  tasks, 
  isLoading,
  onToggleTask,
}: { 
  dog: DogWithIntake; 
  tasks: any[]; 
  isLoading: boolean;
  onToggleTask: (taskId: string, completed: boolean) => void;
}) {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>;
  }

  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const dogTasks = safeTasks.filter((t: any) => t.dogId === dog.id || t.relatedDogId === dog.id);
  const pendingTasks = dogTasks.filter((t: any) => t.status === 'pending');
  const completedTasks = dogTasks.filter((t: any) => t.status === 'completed');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {pendingTasks.length} pending · {completedTasks.length} completed
        </span>
        <Button variant="outline" size="sm" data-testid="button-add-task">
          <Plus className="w-4 h-4 mr-1" />
          Add Task
        </Button>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingTasks.map((task: any) => (
              <div 
                key={task.id} 
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={false}
                  onCheckedChange={() => onToggleTask(task.id, true)}
                  data-testid={`checkbox-task-${task.id}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="w-3 h-3" />
                      Due {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedTasks.slice(0, 5).map((task: any) => (
              <div 
                key={task.id} 
                className="flex items-start gap-3 p-2 rounded-lg opacity-60"
              >
                <Checkbox
                  checked={true}
                  onCheckedChange={() => onToggleTask(task.id, false)}
                  data-testid={`checkbox-task-${task.id}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-through">{task.title}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {dogTasks.length === 0 && (
        <div className="text-center py-8">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No tasks for this pet</p>
        </div>
      )}
    </div>
  );
}

// Applications Tab Component
function ApplicationsTab({ 
  dog, 
  applications, 
  isLoading 
}: { 
  dog: DogWithIntake; 
  applications: any[]; 
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading applications...</div>;
  }

  const safeApps = Array.isArray(applications) ? applications : [];

  return (
    <div className="space-y-4">
      {safeApps.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No applications yet</p>
        </div>
      ) : (
        safeApps.map((app: any) => (
          <Card key={app.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={app.userProfileImage || app.applicant?.profileImageUrl} />
                  <AvatarFallback>
                    {(app.userFirstName || app.applicant?.firstName || 'A')[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {app.userFirstName || app.applicant?.firstName} {app.userLastName || app.applicant?.lastName}
                    </span>
                    {app.aiReviewScore && (
                      <Badge variant="outline" className="flex-shrink-0">
                        <Star className="w-3 h-3 mr-1 text-yellow-500" />
                        {app.aiReviewScore}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {app.userEmail || app.applicant?.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {app.currentStage?.replace(/_/g, ' ') || app.status || 'Pending'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {app.applicationSubmittedAt 
                        ? new Date(app.applicationSubmittedAt).toLocaleDateString()
                        : app.createdAt 
                          ? new Date(app.createdAt).toLocaleDateString()
                          : ''}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="flex-1" data-testid={`button-message-${app.id}`}>
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Message
                </Button>
                <Button variant="outline" size="sm" className="flex-1" data-testid={`button-call-${app.id}`}>
                  <Phone className="w-3 h-3 mr-1" />
                  Call
                </Button>
                <Button variant="default" size="sm" className="flex-1" data-testid={`button-review-${app.id}`}>
                  Review
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// Behavior Tab Component
function BehaviorTab({ 
  dog, 
  notes, 
  isLoading 
}: { 
  dog: DogWithIntake; 
  notes: any[]; 
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading behavior notes...</div>;
  }

  const safeNotes = Array.isArray(notes) ? notes : [];

  return (
    <div className="space-y-4">
      {/* Temperament */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Temperament</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {dog.temperament?.map((trait, i) => (
              <Badge key={i} variant="secondary" className="text-xs capitalize">
                {trait}
              </Badge>
            )) || (
              <span className="text-sm text-muted-foreground">No temperament data</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Behavior Notes */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Behavior Notes</CardTitle>
          <Button variant="ghost" size="sm" data-testid="button-add-behavior-note">
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {safeNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No behavior notes recorded</p>
          ) : (
            <div className="space-y-3">
              {safeNotes.map((note: any) => (
                <div key={note.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{note.category || 'General'}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm">{note.notes || note.content}</p>
                  {note.staffName && (
                    <p className="text-xs text-muted-foreground mt-1">— {note.staffName}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Foster Tab Component  
function FosterTab({ dog }: { dog: DogWithIntake }) {
  const { data: fosterHistory = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/shelter/dogs", dog.id, "foster-history"],
    enabled: !!dog.id,
  });

  const safeFosterHistory = Array.isArray(fosterHistory) ? fosterHistory : [];

  return (
    <div className="space-y-4">
      {/* Foster Suitability */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Foster Suitability</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Good for foster?</span>
              <Badge variant={dog.listingType === 'foster' ? 'default' : 'outline'}>
                {dog.listingType === 'foster' ? 'Yes' : 'Adoption Only'}
              </Badge>
            </div>
            {dog.fosterReason && (
              <div>
                <span className="text-muted-foreground">Reason:</span>
                <p className="mt-1">{dog.fosterReason}</p>
              </div>
            )}
            {dog.fosterDuration && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duration Needed</span>
                <span>{dog.fosterDuration}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Foster History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Foster History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : safeFosterHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No foster history</p>
          ) : (
            <div className="space-y-2">
              {safeFosterHistory.map((foster: any) => (
                <div key={foster.id} className="p-2 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{foster.fosterName}</span>
                    <Badge variant="outline" className="text-xs">{foster.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(foster.startDate).toLocaleDateString()} - 
                    {foster.endDate ? new Date(foster.endDate).toLocaleDateString() : 'Present'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Foster Button */}
      <Button variant="outline" className="w-full" data-testid="button-request-foster">
        <Home className="w-4 h-4 mr-2" />
        Find Foster Home
      </Button>
    </div>
  );
}

// Activity Log Tab Component
function ActivityTab({ dog, automationRuns, isLoading, isError }: { dog: DogWithIntake; automationRuns: any[]; isLoading: boolean; isError?: boolean }) {
  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'auto_complete_task':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'move_pipeline':
        return <ChevronRight className="w-4 h-4 text-blue-500" />;
      case 'create_task':
        return <ClipboardList className="w-4 h-4 text-purple-500" />;
      case 'send_notification':
        return <MessageSquare className="w-4 h-4 text-orange-500" />;
      default:
        return <Zap className="w-4 h-4 text-primary" />;
    }
  };

  const getTriggerBadge = (triggerType: string) => {
    const colors: Record<string, string> = {
      vaccine_added: 'bg-green-500/10 text-green-700 dark:text-green-400',
      medical_added: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      pipeline_moved: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
      hold_expired: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
      intake_created: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
    };
    const labels: Record<string, string> = {
      vaccine_added: 'Vaccine',
      medical_added: 'Medical',
      pipeline_moved: 'Pipeline',
      hold_expired: 'Hold Expired',
      intake_created: 'Intake',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[triggerType] || 'bg-muted text-muted-foreground'}`}>
        {labels[triggerType] || triggerType}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Automation Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            See automated actions triggered for {dog.name}. Tasks auto-complete when related records are added or pipeline stages change.
          </p>
          
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : isError ? (
            <div className="text-center py-6 space-y-2" data-testid="automation-error-state">
              <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Failed to load automation log</p>
            </div>
          ) : automationRuns.length === 0 ? (
            <div className="text-center py-6 space-y-2" data-testid="automation-empty-state">
              <Zap className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No automated actions yet</p>
              <p className="text-xs text-muted-foreground">
                Automations will appear here when tasks are auto-completed
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {automationRuns.map((run: any) => (
                <div 
                  key={run.id} 
                  className="flex gap-3 p-3 bg-muted/30 rounded-lg border border-border/50"
                  data-testid={`automation-run-${run.id}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getActionIcon(run.actionType)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium">{run.actionDescription}</p>
                    <p className="text-xs text-muted-foreground">{run.triggerEvent}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getTriggerBadge(run.triggerType)}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge variant={run.result === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {run.result === 'success' ? 'Done' : 'Failed'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
