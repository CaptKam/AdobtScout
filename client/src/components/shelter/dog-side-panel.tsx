import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
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
  ArrowRight,
  ChevronDown,
  Pencil,
} from "lucide-react";
import type { Dog, IntakeRecord } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";
import { StageChecklist, DogWithIntake as ChecklistDogWithIntake } from "./stage-checklist";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DogWithIntake extends Dog {
  intake: IntakeRecord | null;
}

interface DogSidePanelProps {
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

// Inline editable field component
interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => void;
  type?: 'text' | 'select';
  options?: { value: string; label: string }[];
  suffix?: string;
}

function EditableField({ label, value, onSave, type = 'text', options, suffix }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  useEffect(() => {
    setEditValue(value);
  }, [value]);
  
  const handleSave = useCallback(() => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  }, [editValue, value, onSave]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  }, [handleSave, value]);
  
  if (type === 'select' && options) {
    return (
      <div>
        <span className="text-muted-foreground text-xs">{label}</span>
        <Select value={value.toLowerCase()} onValueChange={(v) => onSave(v)}>
          <SelectTrigger className="h-7 mt-0.5 text-sm" data-testid={`select-${label.toLowerCase()}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  
  return (
    <div className="group">
      <span className="text-muted-foreground text-xs">{label}</span>
      {isEditing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-7 mt-0.5 text-sm"
          data-testid={`input-${label.toLowerCase()}`}
        />
      ) : (
        <div 
          className="flex items-center gap-1 cursor-pointer hover-elevate rounded px-1 -mx-1 py-0.5"
          onClick={() => setIsEditing(true)}
          data-testid={`edit-${label.toLowerCase()}`}
        >
          <p className="font-medium text-sm capitalize">{value || 'Unknown'}{suffix}</p>
          <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}
    </div>
  );
}

export function DogSidePanel({ dog, open, onClose, onStageChange }: DogSidePanelProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  
  const prevDogIdRef = useRef<string | null>(null);
  if (dog?.id !== prevDogIdRef.current) {
    prevDogIdRef.current = dog?.id || null;
    if (activeTab !== "overview") {
      setActiveTab("overview");
    }
  }
  
  // Keyboard shortcuts: Escape to close panel
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (e.key === 'Escape' && !isInput) {
        e.preventDefault();
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
  
  const currentStage = dog?.intake?.pipelineStatus || 'intake';
  const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.id === currentStage);
  
  // Mutation for updating dog details inline
  const updateDogMutation = useMutation({
    mutationFn: async (updates: Partial<Dog>) => {
      return apiRequest("PATCH", `/api/shelter/dogs/${dog?.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      toast({
        title: "Updated",
        description: "Pet details have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update pet details.",
        variant: "destructive",
      });
    },
  });
  
  const handleFieldUpdate = useCallback((field: string, value: string) => {
    if (!dog?.id) return;
    updateDogMutation.mutate({ [field]: value } as Partial<Dog>);
  }, [dog?.id, updateDogMutation]);

  const { data: medicalRecords = [], isLoading: loadingMedical } = useQuery<any[]>({
    queryKey: [`/api/shelter/medical/dog/${dog?.id}`],
    enabled: !!dog?.id && open,
  });

  const { data: vaccines = [], isLoading: loadingVaccines } = useQuery<any[]>({
    queryKey: [`/api/shelter/medical/dog/${dog?.id}/vaccines`],
    enabled: !!dog?.id && open,
  });

  const { data: allTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/shelter/tasks"],
    enabled: !!dog?.id && open,
  });
  const tasks = allTasks.filter(t => t.dogId === dog?.id);

  const { data: allApps = [] } = useQuery<any[]>({
    queryKey: ["/api/shelter/applications"],
    enabled: !!dog?.id && open,
  });
  const applications = allApps.filter(a => a.dogId === dog?.id);

  const hasValidIntakeId = !!dog?.intake?.id && !dog?.intake?.id.startsWith('temp-');
  const { data: behaviorData } = useQuery<any>({
    queryKey: hasValidIntakeId ? [`/api/shelter/intake/${dog?.intake?.id}`] : ['noop'],
    enabled: hasValidIntakeId && open,
  });
  const behaviorNotes = behaviorData?.behaviorNotes ? [{ notes: behaviorData.behaviorNotes, date: behaviorData.intakeDate }] : [];

  const { data: automationRuns = [] } = useQuery<any[]>({
    queryKey: [`/api/shelter/automation-runs?dogId=${dog?.id}&limit=20`],
    enabled: !!dog?.id && open,
  });

  const { data: dogEvents = [] } = useQuery<any[]>({
    queryKey: ['/api/shelter/dogs', dog?.id, 'events'],
    enabled: !!dog?.id && open,
  });

  // Merge automation runs and dog events into a unified timeline
  const unifiedTimeline = [...automationRuns.map((run: any) => ({
    id: run.id,
    type: 'automation' as const,
    timestamp: new Date(run.createdAt),
    data: run,
  })), ...dogEvents.map((event: any) => ({
    id: event.id,
    type: 'event' as const,
    timestamp: new Date(event.createdAt),
    data: event,
  }))].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 30);

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      return apiRequest("PATCH", `/api/shelter/tasks/${taskId}`, {
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? new Date().toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      toast({ title: "Task updated" });
    },
  });

  const handleStageChange = (newStage: string) => {
    if (dog && onStageChange) {
      onStageChange(dog.id, newStage);
    }
  };

  if (!dog) return null;

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <>
          {/* Panel overlay - dims the background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="panel-overlay"
            onClick={onClose}
            data-testid="panel-overlay"
          />
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 420, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full border-l bg-background flex flex-col overflow-hidden relative z-[101]"
            data-testid="dog-side-panel"
          >
          <div className="flex items-center justify-between p-4 border-b bg-muted/30">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {dog.photos && dog.photos.length > 0 ? (
                  <img src={dog.photos[0]} alt={dog.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <DogIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold truncate" data-testid="text-dog-name">{dog.name}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {dog.breed} · {dog.age}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-panel">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Stage:</span>
              <Select value={currentStage} onValueChange={handleStageChange}>
                <SelectTrigger className="h-8 w-auto gap-2" data-testid="select-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className={`flex items-center gap-2 pl-2 border-l-2 ${stage.accent}`}>
                        {stage.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-5 mx-4 mt-3">
              <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs relative" data-testid="tab-tasks">
                Tasks
                {pendingTasks.length > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                    {pendingTasks.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="medical" className="text-xs" data-testid="tab-medical">Medical</TabsTrigger>
              <TabsTrigger value="apps" className="text-xs relative" data-testid="tab-apps">
                Apps
                {applications.length > 0 && (
                  <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                    {applications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs" data-testid="tab-history">History</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 px-4 py-3">
              <TabsContent value="overview" className="mt-0 space-y-4">
                <StageChecklist 
                  dog={dog as ChecklistDogWithIntake}
                  vaccines={vaccines}
                  medicalRecords={medicalRecords}
                  tasks={tasks}
                />

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DogIcon className="w-4 h-4" />
                      Details
                      <span className="text-xs text-muted-foreground font-normal ml-auto">Click to edit</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <EditableField
                      label="Breed"
                      value={String(dog.breed || '')}
                      onSave={(v) => handleFieldUpdate('breed', v)}
                    />
                    <EditableField
                      label="Age"
                      value={String(dog.age || '')}
                      onSave={(v) => handleFieldUpdate('age', v)}
                    />
                    <EditableField
                      label="Size"
                      value={String(dog.size || '')}
                      type="select"
                      options={[
                        { value: 'small', label: 'Small' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'large', label: 'Large' },
                        { value: 'xlarge', label: 'X-Large' },
                      ]}
                      onSave={(v) => handleFieldUpdate('size', v)}
                    />
                    <EditableField
                      label="Gender"
                      value={(dog as any).gender || ''}
                      type="select"
                      options={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                      ]}
                      onSave={(v) => handleFieldUpdate('gender', v)}
                    />
                    <EditableField
                      label="Weight"
                      value={dog.weight?.toString() || ''}
                      suffix=" lbs"
                      onSave={(v) => handleFieldUpdate('weight', v)}
                    />
                    {dog.intake?.intakeDate && (
                      <div>
                        <span className="text-muted-foreground text-xs">Intake</span>
                        <p className="font-medium text-sm">{format(new Date(dog.intake.intakeDate), 'MMM d, yyyy')}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {(dog as any).description && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">About</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{(dog as any).description}</p>
                    </CardContent>
                  </Card>
                )}

                {behaviorNotes.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <PawPrint className="w-4 h-4" />
                        Behavior Notes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{behaviorNotes[0].notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="mt-0 space-y-4">
                {pendingTasks.length === 0 && completedTasks.length === 0 ? (
                  <div className="empty-state">
                    <ClipboardList className="empty-state-icon" />
                    <p className="text-sm">No tasks for this pet</p>
                    <p className="text-xs mt-1">Tasks will appear here when assigned</p>
                  </div>
                ) : (
                  <>
                    {pendingTasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="section-header">
                          <h4>Pending ({pendingTasks.length})</h4>
                        </div>
                        {pendingTasks.map((task: any) => (
                          <div key={task.id} className="task-list-item">
                            <div className={`task-list-item-priority ${task.priority === 'urgent' ? 'urgent' : task.priority === 'high' ? 'high' : task.priority === 'medium' ? 'medium' : 'low'}`} />
                            <Checkbox
                              checked={false}
                              onCheckedChange={(checked) => {
                                completeTaskMutation.mutate({ taskId: task.id, completed: checked as boolean });
                              }}
                              className="mt-0.5"
                              data-testid={`checkbox-task-${task.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{task.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Badge variant="outline" className="text-xs">{task.taskType}</Badge>
                                {task.dueDate && (
                                  <span className={getPriorityColor(task.priority)}>
                                    Due {format(new Date(task.dueDate), 'MMM d')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {completedTasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="section-header">
                          <h4>Completed ({completedTasks.length})</h4>
                        </div>
                        {completedTasks.slice(0, 5).map((task: any) => (
                          <div key={task.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg opacity-60">
                            <Check className="w-4 h-4 text-green-500 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm line-through">{task.title}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="medical" className="mt-0 space-y-4">
                {vaccines.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Syringe className="w-4 h-4" />
                        Vaccinations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {vaccines.map((vaccine: any) => (
                        <div key={vaccine.id} className="flex items-center justify-between text-sm">
                          <span>{vaccine.vaccineName}</span>
                          <span className="text-muted-foreground">
                            {format(new Date(vaccine.dateAdministered), 'MMM d, yyyy')}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {medicalRecords.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Records</h4>
                    {medicalRecords.map((record: any) => (
                      <Card key={record.id}>
                        <CardContent className="py-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{record.recordType}</p>
                              <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(record.recordDate), 'MMM d')}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : vaccines.length === 0 ? (
                  <div className="empty-state">
                    <Stethoscope className="empty-state-icon" />
                    <p className="text-sm">No medical records</p>
                    <p className="text-xs mt-1">Add vaccinations and health notes</p>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="apps" className="mt-0 space-y-4">
                {applications.length === 0 ? (
                  <div className="empty-state">
                    <Users className="empty-state-icon" />
                    <p className="text-sm">No applications yet</p>
                    <p className="text-xs mt-1">Adoption applications will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {applications.map((app: any) => (
                      <Card key={app.id} className="hover-elevate cursor-pointer">
                        <CardContent className="py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback>{app.applicantName?.charAt(0) || 'A'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{app.applicantName || 'Applicant'}</p>
                              <p className="text-xs text-muted-foreground">{app.applicantEmail}</p>
                            </div>
                            <Badge variant={app.status === 'pending' ? 'default' : 'secondary'}>
                              {app.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-0 space-y-4">
                {unifiedTimeline.length === 0 ? (
                  <div className="empty-state">
                    <Activity className="empty-state-icon" />
                    <p className="text-sm">No activity history</p>
                    <p className="text-xs mt-1">Stage changes and events will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unifiedTimeline.map((item) => {
                      const getActionIcon = (actionType: string) => {
                        switch (actionType) {
                          case 'auto_complete_task': return <Check className="w-3 h-3" />;
                          case 'move_pipeline': return <ArrowRight className="w-3 h-3" />;
                          case 'create_task': return <Plus className="w-3 h-3" />;
                          default: return <Zap className="w-3 h-3" />;
                        }
                      };
                      
                      const getEventIcon = (eventType: string) => {
                        switch (eventType) {
                          case 'PIPELINE_MOVED': return <ArrowRight className="w-3 h-3" />;
                          case 'VACCINE_ADMINISTERED': return <Syringe className="w-3 h-3" />;
                          case 'INTAKE_CREATED': return <ClipboardList className="w-3 h-3" />;
                          case 'TASK_COMPLETED': return <Check className="w-3 h-3" />;
                          case 'APP_STATUS_CHANGED': return <Users className="w-3 h-3" />;
                          case 'HOLD_STARTED': case 'HOLD_ENDED': return <Shield className="w-3 h-3" />;
                          default: return <Activity className="w-3 h-3" />;
                        }
                      };
                      
                      const getResultColor = (result: string) => {
                        switch (result) {
                          case 'success': return 'bg-green-500';
                          case 'failed': return 'bg-red-500';
                          case 'skipped': return 'bg-yellow-500';
                          default: return 'bg-blue-500';
                        }
                      };
                      
                      if (item.type === 'automation') {
                        const run = item.data;
                        return (
                          <div key={`auto-${item.id}`} className="p-3 bg-muted/30 rounded-lg" data-testid={`history-item-${item.id}`}>
                            <div className="flex items-start gap-3">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getResultColor(run.result)} text-white flex-shrink-0`}>
                                {getActionIcon(run.actionType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{run.actionDescription || 'Action performed'}</p>
                                {run.triggerEvent && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    <span className="font-medium">Why:</span> {run.triggerEvent}
                                  </p>
                                )}
                                {run.resultMessage && (
                                  <p className="text-xs text-muted-foreground/80 mt-0.5 italic">
                                    {run.resultMessage}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        const event = item.data;
                        return (
                          <div key={`event-${item.id}`} className="p-3 bg-muted/30 rounded-lg" data-testid={`history-event-${item.id}`}>
                            <div className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/80 text-primary-foreground flex-shrink-0">
                                {getEventIcon(event.eventType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{event.description}</p>
                                {event.actorType === 'user' && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    By staff member
                                  </p>
                                )}
                                {event.actorType === 'automation' && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Automated action
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
