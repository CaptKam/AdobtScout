import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ShelterCheckbox } from "@/components/ui/shelter-checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Heart, Plus, Dog, ClipboardList, Syringe, 
  AlertTriangle, CheckCircle, Calendar, Users,
  FileText, Activity, ArrowRight, Eye,
  Stethoscope, PawPrint, AlertCircle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DashboardStatsSkeleton, PetGridSkeleton, TaskListSkeleton } from "@/components/shelter-skeletons";
import { SuccessAnimation, useSuccessAnimation } from "@/components/success-animation";
import type { User, ShelterTask, IntakeRecord, MedicalRecord, Dog as DogType } from "@shared/schema";
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns";

interface DashboardMetrics {
  totalDogs: number;
  dogsInIntake: number;
  dogsReady: number;
  dogsInMedicalHold: number;
  pendingTasks: number;
  overdueTasks: number;
  upcomingVaccines: number;
  activeApplications: number;
}

interface DogWithIntake extends DogType {
  intake: IntakeRecord | null;
}

const PIPELINE_STAGES = [
  { id: 'intake', label: 'Intake', accent: 'border-muted-foreground' },
  { id: 'medical_hold', label: 'Medical Hold', accent: 'border-amber-500' },
  { id: 'behavior_eval', label: 'Behavior Eval', accent: 'border-blue-500' },
  { id: 'ready', label: 'Ready', accent: 'border-green-500' },
];

const TASK_TYPE_ICONS: Record<string, typeof Syringe> = {
  vaccine: Syringe,
  medical: Stethoscope,
  spay_neuter: Activity,
  grooming: PawPrint,
  behavior_eval: ClipboardList,
  follow_up: Calendar,
  admin: FileText,
  custom: ClipboardList,
};

export default function ShelterDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isAddDogDialogOpen, setIsAddDogDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { showSuccess, message: successMessage, triggerSuccess, hideSuccess } = useSuccessAnimation();

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/shelter/dashboard"],
  });

  const { data: dogs = [], isLoading: dogsLoading } = useQuery<DogWithIntake[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<ShelterTask[]>({
    queryKey: ["/api/shelter/tasks"],
  });

  const { data: upcomingVaccines = [] } = useQuery<MedicalRecord[]>({
    queryKey: ["/api/shelter/medical/vaccines/upcoming?days=30"],
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("POST", `/api/shelter/tasks/${taskId}/complete`, {});
    },
    onSuccess: () => {
      triggerSuccess("Task completed!");
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dashboard"] });
    },
  });

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const overdueTasks = pendingTasks.filter(t => t.dueDate && isPast(new Date(t.dueDate)));
  const todayTasks = pendingTasks.filter(t => t.dueDate && isToday(new Date(t.dueDate)));

  const getDogsByPipelineStatus = (status: string) => {
    return dogs.filter(dog => {
      if (!dog.intake) return status === 'ready';
      return dog.intake.pipelineStatus === status;
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getTaskDueLabel = (dueDate: Date | string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isPast(date)) return { label: 'Overdue', className: 'text-red-500 font-medium' };
    if (isToday(date)) return { label: 'Today', className: 'text-orange-500 font-medium' };
    if (isTomorrow(date)) return { label: 'Tomorrow', className: 'text-yellow-600' };
    return { label: formatDistanceToNow(date, { addSuffix: true }), className: 'text-muted-foreground' };
  };

  return (
    
      <div className="p-4 md:p-6 space-y-6" data-testid="page-shelter-dashboard">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">Overview of your shelter operations</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link href="/shelter/tasks">
              <Button variant="outline" className="w-full sm:w-auto" data-testid="button-quick-add-task">
                <ClipboardList className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </Link>
            <Button onClick={() => setIsAddDogDialogOpen(true)} className="w-full sm:w-auto" data-testid="button-add-dog">
              <Plus className="w-4 h-4 mr-2" />
              Add Pet
            </Button>
          </div>
        </div>

        {/* Success Animation */}
        <SuccessAnimation 
          show={showSuccess} 
          message={successMessage} 
          onComplete={hideSuccess}
          variant="checkCircle"
        />

        {/* At a Glance Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-primary" />
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">At a Glance</h2>
          </div>
          {metricsLoading ? (
            <DashboardStatsSkeleton />
          ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card data-testid="card-stat-total-dogs">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Dog className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.totalDogs || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Pets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-pending-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.pendingTasks || 0}</p>
                  <p className="text-xs text-muted-foreground">Pending Tasks</p>
                </div>
              </div>
              {(metrics?.overdueTasks || 0) > 0 && (
                <Badge variant="destructive" className="mt-2 text-xs">
                  {metrics?.overdueTasks} overdue
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-stat-vaccines">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Syringe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.upcomingVaccines || 0}</p>
                  <p className="text-xs text-muted-foreground">Vaccines Due</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-stat-applications">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{metrics?.activeApplications || 0}</p>
                  <p className="text-xs text-muted-foreground">Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
          )}
        </div>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="dogs" data-testid="tab-dogs">Pets</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
            <TabsTrigger value="medical" data-testid="tab-medical">Medical</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Intake Pipeline */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Intake Pipeline
                  </CardTitle>
                  <CardDescription>Pets by status in your care</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {PIPELINE_STAGES.map(stage => {
                      const count = getDogsByPipelineStatus(stage.id).length;
                      const percentage = dogs.length > 0 ? (count / dogs.length) * 100 : 0;
                      return (
                        <div key={stage.id} className={`space-y-1 pl-3 border-l-2 ${stage.accent}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span>{stage.label}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Today's Tasks */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-primary" />
                        Today's Tasks
                      </CardTitle>
                      <CardDescription>
                        {todayTasks.length} tasks due today
                        {overdueTasks.length > 0 && `, ${overdueTasks.length} overdue`}
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab("tasks")}>
                      View All <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {[...overdueTasks, ...todayTasks].slice(0, 5).length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <p>All caught up! No urgent tasks.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...overdueTasks, ...todayTasks].slice(0, 5).map(task => {
                        const TaskIcon = TASK_TYPE_ICONS[task.taskType] || ClipboardList;
                        const dueLabel = getTaskDueLabel(task.dueDate);
                        return (
                          <div 
                            key={task.id} 
                            className="flex items-center gap-3 p-2 min-h-[48px] md:min-h-0 rounded-lg hover:bg-muted/50 transition-colors"
                            data-testid={`task-item-${task.id}`}
                          >
                            <ShelterCheckbox 
                              className="h-5 w-5 md:h-4 md:w-4"
                              checked={task.status === 'completed'}
                              onCheckedChange={() => completeTaskMutation.mutate(task.id)}
                              disabled={completeTaskMutation.isPending}
                            />
                            <TaskIcon className="w-5 h-5 md:w-4 md:h-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{task.title}</p>
                              {dueLabel && (
                                <p className={`text-xs ${dueLabel.className}`}>{dueLabel.label}</p>
                              )}
                            </div>
                            <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Alerts Section */}
            {(overdueTasks.length > 0 || (metrics?.upcomingVaccines || 0) > 0) && (
              <Card className="border-orange-200 dark:border-orange-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="w-5 h-5" />
                    Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {overdueTasks.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} need attention</span>
                      </div>
                    )}
                    {(metrics?.upcomingVaccines || 0) > 0 && (
                      <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                        <Syringe className="w-4 h-4" />
                        <span>{metrics?.upcomingVaccines} vaccine{(metrics?.upcomingVaccines || 0) > 1 ? 's' : ''} due in the next 30 days</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Pets Tab */}
          <TabsContent value="dogs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Your Pets</CardTitle>
                  <Link href="/dog-form">
                    <Button data-testid="button-add-dog-dogs-tab">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Pet
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {dogsLoading ? (
                  <PetGridSkeleton count={6} />
                ) : dogs.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No pets listed yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Start by adding your first pet to help them find their forever home
                    </p>
                    <Link href="/dog-form">
                      <Button variant="outline" data-testid="button-add-first-dog">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Pet
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dogs.map((dog) => {
                      const pipelineStatus = dog.intake?.pipelineStatus || 'ready';
                      const stage = PIPELINE_STAGES.find(s => s.id === pipelineStatus);
                      return (
                        <Card key={dog.id} className="overflow-hidden hover-elevate" data-testid={`card-dog-${dog.id}`}>
                          <div className="aspect-square bg-muted relative">
                            <img
                              src={dog.photos[0]}
                              alt={dog.name}
                              className="w-full h-full object-cover"
                            />
                            <Badge 
                              variant="outline"
                              className={`absolute top-2 right-2 border-l-2 ${stage?.accent || 'border-muted-foreground'}`}
                            >
                              {stage?.label}
                            </Badge>
                            {dog.urgencyLevel !== 'normal' && (
                              <Badge 
                                variant="destructive" 
                                className="absolute top-2 left-2"
                              >
                                {dog.urgencyLevel === 'critical' ? 'Critical' : 'Urgent'}
                              </Badge>
                            )}
                          </div>
                          <CardContent className="p-4">
                            <h3 className="font-serif text-xl mb-1" data-testid={`text-dog-name-${dog.id}`}>
                              {dog.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              {dog.breed} • {dog.age} {dog.age === 1 ? 'year' : 'years'} • {dog.size}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                              <Eye className="w-4 h-4" />
                              <span>{(dog.viewCount || 0).toLocaleString()} views</span>
                            </div>
                            <div className="flex gap-2">
                              <Link href={`/dog-form?edit=${dog.id}`} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full">
                                  Edit
                                </Button>
                              </Link>
                              <Link href={`/dog/${dog.id}`} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full">
                                  View
                                </Button>
                              </Link>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Task Management</CardTitle>
                    <CardDescription>
                      {pendingTasks.length} pending • {overdueTasks.length} overdue
                    </CardDescription>
                  </div>
                  <Link href="/shelter/tasks">
                    <Button data-testid="button-add-task">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <TaskListSkeleton count={5} />
                ) : pendingTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                    <p className="text-muted-foreground">No pending tasks at the moment.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingTasks.map(task => {
                      const TaskIcon = TASK_TYPE_ICONS[task.taskType] || ClipboardList;
                      const dueLabel = getTaskDueLabel(task.dueDate);
                      const dog = dogs.find(d => d.id === task.dogId);
                      return (
                        <div 
                          key={task.id} 
                          className="flex items-center gap-4 p-3 min-h-[56px] md:min-h-0 rounded-lg border hover:bg-muted/50 transition-colors"
                          data-testid={`task-row-${task.id}`}
                        >
                          <ShelterCheckbox 
                            className="h-5 w-5 md:h-4 md:w-4"
                            checked={task.status === 'completed'}
                            onCheckedChange={() => completeTaskMutation.mutate(task.id)}
                            disabled={completeTaskMutation.isPending}
                          />
                          <div className={`w-2 h-8 rounded-full ${getPriorityColor(task.priority)}`} />
                          <div className="w-10 h-10 md:w-8 md:h-8 rounded-lg bg-muted flex items-center justify-center">
                            <TaskIcon className="w-5 h-5 md:w-4 md:h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{task.title}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {dog && <span>{dog.name}</span>}
                              {dog && dueLabel && <span>•</span>}
                              {dueLabel && (
                                <span className={dueLabel.className}>{dueLabel.label}</span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {task.taskType.replace('_', ' ')}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Medical Tab */}
          <TabsContent value="medical">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Upcoming Vaccines */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Syringe className="w-5 h-5 text-purple-600" />
                    Upcoming Vaccines
                  </CardTitle>
                  <CardDescription>Vaccines due in the next 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  {upcomingVaccines.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <p>No vaccines due soon</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingVaccines.slice(0, 5).map(record => {
                        const dog = dogs.find(d => d.id === record.dogId);
                        return (
                          <div 
                            key={record.id}
                            className="flex items-center gap-3 p-2 rounded-lg border"
                          >
                            <Syringe className="w-4 h-4 text-purple-600" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{record.vaccineName || record.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {dog?.name} • Due {record.nextDueDate ? format(new Date(record.nextDueDate), 'MMM d') : 'N/A'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-blue-600" />
                    Medical Records
                  </CardTitle>
                  <CardDescription>Manage health records for your pets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Vaccine Record
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Medical Exam
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Treatment
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="w-4 h-4 mr-2" />
                      View All Records
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Pet Dialog */}
      <Dialog open={isAddDogDialogOpen} onOpenChange={setIsAddDogDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Add New Pet</DialogTitle>
            <DialogDescription>
              Fill out the form below to add a new pet to your shelter.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4">
            <iframe
              src="/dog-form?embedded=true"
              className="w-full h-[calc(95vh-120px)] border-0"
              title="Add Pet Form"
              onLoad={(e) => {
                // Listen for form submission success
                const iframe = e.target as HTMLIFrameElement;
                const checkFormSuccess = setInterval(() => {
                  try {
                    const iframeWindow = iframe.contentWindow;
                    if (iframeWindow && !iframeWindow.location.pathname.startsWith('/dog-form')) {
                      clearInterval(checkFormSuccess);
                      setIsAddDogDialogOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dashboard"] });
                    }
                  } catch (e) {
                    // Cross-origin error, ignore
                  }
                }, 500);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    
  );
}
