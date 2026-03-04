import { useEffect, useState, useCallback, memo, useTransition, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Virtuoso } from "react-virtuoso";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dog, Search, Plus, GripVertical, MoreVertical,
  Clock, AlertTriangle, Camera, ChevronLeft, ChevronRight,
  CheckCircle2, Stethoscope, PawPrint, Sparkles, ClipboardCheck,
  Scale, Shield, Eye, X, ClipboardList, Pill, ArrowRight, Flag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deriveBlockers, type DogBlockers } from "@/lib/blockers";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { usePipelineStore, type DogWithIntake } from "@/stores/pipeline-store";
import { DogSidePanel } from "@/components/shelter/dog-side-panel";

const PIPELINE_STAGES = [
  { id: 'intake', label: 'Intake', cardClass: 'pipeline-card-intake', description: 'New arrivals' },
  { id: 'stray_hold', label: 'Stray Hold', cardClass: 'pipeline-card-default', description: 'Legal hold period' },
  { id: 'medical_hold', label: 'Medical Hold', cardClass: 'pipeline-card-medical', description: 'Medical treatment' },
  { id: 'behavior_eval', label: 'Behavior Eval', cardClass: 'pipeline-card-assessment', description: 'Assessment needed' },
  { id: 'pre_adoption_hold', label: 'Pre-Adoption Hold', cardClass: 'pipeline-card-default', description: 'Pending items' },
  { id: 'ready', label: 'Ready', cardClass: 'pipeline-card-ready', description: 'Available for adoption' },
  { id: 'featured', label: 'Featured', cardClass: 'pipeline-card-ready', description: 'Highlighted pets' },
  { id: 'adopted', label: 'Adopted', cardClass: 'pipeline-card-adopted', description: 'Found homes' },
];

interface PipelineStage {
  id: string;
  label: string;
  cardClass: string;
  description: string;
}

// Stage-specific quick actions
interface StageAction {
  id: string;
  label: string;
  icon: typeof CheckCircle2;
  taskType: string;
  taskTitle: string;
}

const STAGE_ACTIONS: Record<string, StageAction[]> = {
  intake: [
    { id: 'complete_intake', label: 'Complete Intake', icon: ClipboardCheck, taskType: 'admin', taskTitle: 'Complete intake checklist' },
  ],
  stray_hold: [
    { id: 'hold_complete', label: 'Hold Complete', icon: CheckCircle2, taskType: 'admin', taskTitle: 'Stray hold period complete' },
  ],
  medical_hold: [
    { id: 'schedule_vet', label: 'Schedule Vet', icon: Stethoscope, taskType: 'medical', taskTitle: 'Schedule veterinary appointment' },
    { id: 'clear_medical', label: 'Clear Medical', icon: CheckCircle2, taskType: 'medical', taskTitle: 'Medical clearance complete' },
  ],
  behavior_eval: [
    { id: 'complete_eval', label: 'Complete Eval', icon: PawPrint, taskType: 'behavior_eval', taskTitle: 'Behavior evaluation complete' },
  ],
  pre_adoption_hold: [
    { id: 'hold_complete', label: 'Hold Complete', icon: Camera, taskType: 'admin', taskTitle: 'Pre-adoption hold complete' },
  ],
  ready: [
    { id: 'feature_pet', label: 'Feature', icon: Sparkles, taskType: 'admin', taskTitle: 'Feature on homepage' },
  ],
};

// Custom collision detection that works with empty columns
// First tries pointerWithin (precise), then falls back to rectIntersection (broader)
const customCollisionDetection: CollisionDetection = (args) => {
  // First check if pointer is within any droppable
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  
  // Fallback to rect intersection for edge cases
  return rectIntersection(args);
};

const DogCard = memo(function DogCard({ 
  dog, 
  isDragging = false,
  isOverlay = false,
  onClick,
  taskCount = 0,
  overdueTaskCount = 0,
  stageCardClass = 'pipeline-card-default',
  onAddTask,
  onChangeStage,
  onMarkUrgent,
}: { 
  dog: DogWithIntake; 
  isDragging?: boolean;
  isOverlay?: boolean;
  onClick?: () => void;
  taskCount?: number;
  overdueTaskCount?: number;
  stageCardClass?: string;
  onAddTask?: (dogId: string) => void;
  onChangeStage?: (dogId: string, newStage: string) => void;
  onMarkUrgent?: (dogId: string) => void;
}) {
  const [, startTransition] = useTransition();
  
  // Derive blockers for this dog
  const blockers = deriveBlockers(dog);
  
  const getDaysInStage = () => {
    if (!dog.intake?.pipelineStatusChangedAt) return null;
    const days = Math.floor(
      (new Date().getTime() - new Date(dog.intake.pipelineStatusChangedAt).getTime()) /
      (1000 * 60 * 60 * 24)
    );
    return days;
  };
  
  // Calculate hold timer for stray/legal holds
  const getHoldDaysRemaining = () => {
    const holdExpiresAt = dog.intake?.holdExpiresAt || dog.holdExpiresAt;
    if (!holdExpiresAt) return null;
    const expiryDate = new Date(holdExpiresAt);
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining;
  };

  const daysInStage = getDaysInStage();
  const isOverdue = daysInStage !== null && daysInStage > 7;
  const holdDaysRemaining = getHoldDaysRemaining();
  
  // Check for any active hold (not just stray/legal) - any hold with expiry date
  const holdType = dog.intake?.holdType || dog.holdType;
  const hasActiveHold = holdType && holdDaysRemaining !== null;

  // Urgency styling - subtle, professional indicators
  const getUrgencyClasses = () => {
    if (dog.urgencyLevel === 'critical') {
      return 'border-destructive/50';
    }
    if (dog.urgencyLevel === 'urgent' || isOverdue) {
      return 'border-muted-foreground/30';
    }
    return '';
  };

  const prefetchDog = useCallback(() => {
    startTransition(() => {
      queryClient.prefetchQuery({
        queryKey: ["/api/dogs", dog.id],
        staleTime: 30000,
      });
      queryClient.prefetchQuery({
        queryKey: ["/api/shelter/tasks"],
        staleTime: 30000,
      });
    });
  }, [dog.id]);

  return (
    <motion.div
      layout={!isOverlay}
      initial={false}
      animate={{
        scale: isDragging ? 1.02 : 1,
        boxShadow: isDragging 
          ? "0 8px 20px rgba(0,0,0,0.12)" 
          : "0 1px 3px rgba(0,0,0,0.08)",
      }}
      transition={{ duration: 0.15, ease: [0.25, 0.8, 0.25, 1] }}
    >
      <div
        className={`pipeline-card ${stageCardClass} cursor-grab active:cursor-grabbing p-0 ${
          isDragging ? 'opacity-90 ring-2 ring-primary' : ''
        } ${getUrgencyClasses()}`}
        onMouseEnter={prefetchDog}
        data-testid={`pipeline-card-${dog.id}`}
      >
        <CardContent className="p-3">
          {/* Urgency indicator - only for critical */}
          {dog.urgencyLevel === 'critical' && (
            <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded text-xs font-medium bg-destructive/10 text-destructive">
              <AlertTriangle className="w-3 h-3" />
              <span>Needs immediate attention</span>
            </div>
          )}
          
          <div className="flex items-start gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="w-12 h-12 rounded-lg bg-muted flex-shrink-0 overflow-hidden cursor-pointer group/photo"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                  }}
                >
                  {dog.photos && dog.photos.length > 0 ? (
                    <img
                      src={dog.photos[0]}
                      alt={dog.name}
                      className="w-full h-full object-cover photo-zoom"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <Camera className="w-5 h-5 text-muted-foreground group-hover/photo:scale-110 transition-transform" />
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                <p className="font-medium">{dog.name}</p>
                {taskCount > 0 && (
                  <p className={overdueTaskCount > 0 ? 'text-destructive' : ''}>
                    {taskCount} task{taskCount !== 1 ? 's' : ''}{overdueTaskCount > 0 ? ` (${overdueTaskCount} overdue)` : ''}
                  </p>
                )}
                {blockers.photosMissing && <p className="text-muted-foreground">Missing photos</p>}
              </TooltipContent>
            </Tooltip>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  className="font-medium text-sm hover:underline truncate cursor-pointer text-left bg-transparent border-0 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                  }}
                  data-testid={`pipeline-card-name-${dog.id}`}
                >
                  {dog.name}
                </button>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {dog.breed} · {dog.age}y
              </p>

              {/* Hold timer takes priority over days in stage */}
              {hasActiveHold && holdDaysRemaining !== null ? (
                <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
                  holdDaysRemaining <= 1 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  <Clock className="w-3 h-3" />
                  <span>
                    {holdDaysRemaining <= 0 
                      ? 'Hold expires today!' 
                      : `${holdDaysRemaining}d until hold expires`}
                  </span>
                </div>
              ) : daysInStage !== null && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{daysInStage}d in stage</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Quick actions dropdown - visible on hover */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="card-actions p-1 rounded hover:bg-muted"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`pipeline-card-actions-${dog.id}`}
                  >
                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTask?.(dog.id);
                    }}
                    data-testid={`action-add-task-${dog.id}`}
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Add Task
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkUrgent?.(dog.id);
                    }}
                    data-testid={`action-mark-urgent-${dog.id}`}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Mark Urgent
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Move to Stage
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {PIPELINE_STAGES.filter(s => s.id !== (dog.intake?.pipelineStatus || 'intake')).map((stage) => (
                        <DropdownMenuItem
                          key={stage.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onChangeStage?.(dog.id, stage.id);
                          }}
                          data-testid={`action-move-${dog.id}-${stage.id}`}
                        >
                          {stage.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuContent>
              </DropdownMenu>
              <GripVertical className="drag-handle w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Primary indicators row - always visible with entrance animations */}
          {(blockers.hasAnyBlocker || dog.specialNeeds || overdueTaskCount > 0 || taskCount > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {/* Task count pill - shows total pending tasks */}
              {taskCount > 0 && overdueTaskCount === 0 && (
                <Badge variant="secondary" className="text-xs badge-enter badge-enter-1">
                  <ClipboardList className="w-3 h-3 mr-1" />
                  {taskCount} task{taskCount !== 1 ? 's' : ''}
                </Badge>
              )}
              
              {/* Status indicators - muted styling per guidelines */}
              {blockers.strayHoldActive ? (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  Stray Hold
                </Badge>
              ) : blockers.legalHoldActive ? (
                <Badge variant="outline" className="text-xs">
                  <Scale className="w-3 h-3 mr-1" />
                  Legal Hold
                </Badge>
              ) : (blockers.medicalIncomplete || holdType === 'medical_hold') ? (
                <Badge variant="outline" className="text-xs">
                  <Stethoscope className="w-3 h-3 mr-1" />
                  Medical
                </Badge>
              ) : blockers.behaviorIncomplete ? (
                <Badge variant="outline" className="text-xs">
                  <PawPrint className="w-3 h-3 mr-1" />
                  Behavior
                </Badge>
              ) : null}
              
              {/* Special needs indicator */}
              {dog.specialNeeds && (
                <Badge variant="outline" className="text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  Special
                </Badge>
              )}
              
              {/* Overdue tasks - only item that uses attention color */}
              {overdueTaskCount > 0 && (
                <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {overdueTaskCount} overdue
                </Badge>
              )}
            </div>
          )}
          
          {/* Stage progress indicator - muted visual journey */}
          <div className="flex items-center gap-0.5 mt-2 pt-2 border-t border-border/50">
            {PIPELINE_STAGES.slice(0, -1).map((stage, idx) => {
              const currentStage = dog.intake?.pipelineStatus || 'intake';
              const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === currentStage);
              const isCompleted = idx < currentIdx;
              const isCurrent = idx === currentIdx;
              
              return (
                <Tooltip key={stage.id}>
                  <TooltipTrigger asChild>
                    <div 
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        isCompleted 
                          ? 'bg-muted-foreground/50' 
                          : isCurrent 
                            ? 'bg-primary' 
                            : 'bg-muted'
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div className="flex items-center gap-1.5">
                      {isCompleted && <CheckCircle2 className="w-3 h-3 text-muted-foreground" />}
                      {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                      <span>{stage.label}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </CardContent>
      </div>
    </motion.div>
  );
});

const SortableDogCard = memo(function SortableDogCard({ 
  dog, 
  onSelect,
  taskCount = 0,
  overdueTaskCount = 0,
  stageCardClass = 'pipeline-card-default',
  onAddTask,
  onChangeStage,
  onMarkUrgent,
}: { 
  dog: DogWithIntake; 
  onSelect?: (dog: DogWithIntake) => void;
  taskCount?: number;
  overdueTaskCount?: number;
  stageCardClass?: string;
  onAddTask?: (dogId: string) => void;
  onChangeStage?: (dogId: string, newStage: string) => void;
  onMarkUrgent?: (dogId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dog.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DogCard 
        dog={dog}
        stageCardClass={stageCardClass} 
        isDragging={isDragging} 
        onClick={() => onSelect?.(dog)} 
        taskCount={taskCount}
        overdueTaskCount={overdueTaskCount}
        onAddTask={onAddTask}
        onChangeStage={onChangeStage}
        onMarkUrgent={onMarkUrgent}
      />
    </div>
  );
});

// Component for stage quick action buttons
const StageActionButtons = memo(function StageActionButtons({
  stageId,
  dogs,
}: {
  stageId: string;
  dogs: DogWithIntake[];
}) {
  const { toast } = useToast();
  const actions = STAGE_ACTIONS[stageId] || [];
  
  const createTaskMutation = useMutation({
    mutationFn: async ({ dogId, action }: { dogId: string; action: StageAction }) => {
      return apiRequest('POST', '/api/shelter/tasks', {
        dogId,
        title: action.taskTitle,
        taskType: action.taskType,
        status: 'pending',
        priority: 'medium',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/shelter/tasks'] });
      toast({
        title: "Task created",
        description: "Quick action task has been created",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  if (actions.length === 0 || dogs.length === 0) return null;

  const handleAction = (action: StageAction, specificDogId?: string) => {
    // If a specific dog is provided, only create task for that dog
    // Otherwise show toast asking to select from the dog drawer
    if (specificDogId) {
      createTaskMutation.mutate({ dogId: specificDogId, action });
    } else if (dogs.length === 1) {
      // If only one dog in stage, auto-select it
      createTaskMutation.mutate({ dogId: dogs[0].id, action });
    } else {
      toast({
        title: "Select a pet first",
        description: "Open a pet's detail panel to use quick actions",
      });
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {actions.slice(0, 2).map(action => {
        const Icon = action.icon;
        return (
          <Button
            key={action.id}
            size="sm"
            variant="ghost"
            className="text-xs touch-manipulation"
            onClick={() => handleAction(action)}
            disabled={createTaskMutation.isPending}
            data-testid={`stage-action-${stageId}-${action.id}`}
          >
            <Icon className="w-3 h-3 mr-1" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
});

const ColumnHeader = memo(function ColumnHeader({ 
  stage, 
  count,
  dogs,
}: { 
  stage: PipelineStage; 
  count: number;
  dogs: DogWithIntake[];
}) {
  return (
    <div className="p-3 bg-card/80 backdrop-blur-sm sticky top-0 z-10 rounded-t-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-heading font-semibold text-sm text-card-foreground">{stage.label}</h3>
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
    </div>
  );
});

// Type for task counts by dog
interface TaskCounts {
  total: number;
  overdue: number;
}

const PipelineColumn = memo(function PipelineColumn({
  stage,
  dogs,
  onSelectDog,
  isHighlighted = false,
  taskCountsByDog = {},
  onAddTask,
  onChangeStage,
  onMarkUrgent,
}: {
  stage: PipelineStage;
  dogs: DogWithIntake[];
  onSelectDog?: (dog: DogWithIntake) => void;
  isHighlighted?: boolean;
  taskCountsByDog?: Record<string, TaskCounts>;
  onAddTask?: (dogId: string) => void;
  onChangeStage?: (dogId: string, newStage: string) => void;
  onMarkUrgent?: (dogId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: 'column', stageId: stage.id },
  });

  const dogIds = dogs.map(d => d.id);

  return (
    <div
      className={`flex flex-col pipeline-column flex-shrink-0 transition-all ${
        stage.id === 'intake' ? 'w-80' : 'w-64'
      } ${isOver ? 'ring-2 ring-primary bg-primary/5' : ''} ${isHighlighted ? 'ring-2 ring-primary bg-primary/5' : ''}`}
      data-testid={`pipeline-column-${stage.id}`}
    >
      <ColumnHeader stage={stage} count={dogs.length} dogs={dogs} />

      {/* Droppable area spans full height */}
      <div
        ref={setNodeRef}
        className="flex-1 min-h-[200px] overflow-hidden"
      >
        <SortableContext id={stage.id} items={dogIds} strategy={verticalListSortingStrategy}>
          {dogs.length > 0 ? (
            <Virtuoso
              data={dogs}
              overscan={100}
              style={{ height: "100%" }}
              itemContent={(index, dog) => {
                const counts = taskCountsByDog[dog.id] || { total: 0, overdue: 0 };
                return (
                  <div className="px-2 py-1 stagger-item">
                    <SortableDogCard 
                      key={dog.id} 
                      dog={dog} 
                      onSelect={onSelectDog}
                      taskCount={counts.total}
                      overdueTaskCount={counts.overdue}
                      stageCardClass={stage.cardClass}
                      onAddTask={onAddTask}
                      onChangeStage={onChangeStage}
                      onMarkUrgent={onMarkUrgent}
                    />
                  </div>
                );
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center py-8">
                <Dog className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Drop pets here</p>
              </div>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
});

// Role-based stage visibility configuration
const ROLE_VISIBLE_STAGES: Record<string, string[]> = {
  owner: PIPELINE_STAGES.map(s => s.id), // All stages
  manager: PIPELINE_STAGES.map(s => s.id), // All stages
  medical: ['intake', 'stray_hold', 'medical_hold', 'behavior_eval', 'ready'], // Focus on medical flow
  behavior: ['intake', 'behavior_eval', 'pre_adoption_hold', 'ready'], // Focus on behavior assessment
  foster_coordinator: ['intake', 'stray_hold', 'medical_hold', 'ready', 'featured'], // Foster-relevant stages
  adoption_counselor: ['ready', 'featured', 'pre_adoption_hold', 'adopted'], // Adoption flow
  kennel: ['intake', 'stray_hold', 'medical_hold', 'behavior_eval', 'ready'], // Daily care stages
  volunteer: ['ready', 'featured'], // Simple view for volunteers
};

// Floating Action Button Component
const FloatingActionButton = memo(function FloatingActionButton({
  selectedDog,
  onAddTask,
  onAddMedicalNote,
}: {
  selectedDog: DogWithIntake | null;
  onAddTask: (dogId?: string) => void;
  onAddMedicalNote: (dogId?: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const actions = [
    { 
      id: 'task', 
      label: selectedDog ? `Add task for ${selectedDog.name}` : 'Add task', 
      icon: ClipboardList, 
      onClick: () => {
        onAddTask(selectedDog?.id);
        setIsOpen(false);
      }
    },
    { 
      id: 'medical', 
      label: selectedDog ? `Medical note for ${selectedDog.name}` : 'Add medical note', 
      icon: Pill, 
      onClick: () => {
        onAddMedicalNote(selectedDog?.id);
        setIsOpen(false);
      }
    },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
      {/* Action buttons - appear above main FAB */}
      <AnimatePresence>
        {isOpen && actions.map((action, idx) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ delay: idx * 0.05, duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <span className="px-3 py-1.5 bg-background border rounded-lg shadow-lg text-sm font-medium whitespace-nowrap">
              {action.label}
            </span>
            <button
              className="h-12 w-12 rounded-full shadow-lg bg-muted hover:bg-muted/80 text-foreground flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
              onClick={action.onClick}
              data-testid={`fab-action-${action.id}`}
            >
              <action.icon className="w-5 h-5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* Main FAB */}
      <motion.div
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center touch-manipulation active:scale-95 transition-transform"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="fab-main"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </button>
      </motion.div>
    </div>
  );
});

export default function PipelineView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showAllStages, setShowAllStages] = useState(false);
  const [quickTaskDialogOpen, setQuickTaskDialogOpen] = useState(false);
  const [quickTaskDogId, setQuickTaskDogId] = useState<string | undefined>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Fetch staff permissions for role-based visibility
  interface StaffPermissions {
    role: string;
    canManageDogs?: boolean;
    canManageStaff?: boolean;
  }
  
  const { data: staffPermissions } = useQuery<StaffPermissions>({
    queryKey: ['/api/shelter/staff/me'],
  });
  
  const userRole = staffPermissions?.role || 'volunteer';
  const isAdmin = userRole === 'owner' || userRole === 'manager' || staffPermissions?.canManageStaff;
  
  // Get visible stages based on role (or show all if user toggles)
  const visibleStageIds = showAllStages || isAdmin 
    ? PIPELINE_STAGES.map(s => s.id)
    : ROLE_VISIBLE_STAGES[userRole] || ROLE_VISIBLE_STAGES.volunteer;
  
  const visibleStages = PIPELINE_STAGES.filter(s => visibleStageIds.includes(s.id));
  
  // Parse query params for focus (auto-select dog) and filter (highlight stage)
  const searchString = useSearch();
  const queryParams = new URLSearchParams(searchString);
  const focusDogId = queryParams.get('focus');
  const filterStage = queryParams.get('filter');

  const { dogs, setDogs, transitionDogStage, canTransition, rollback } = usePipelineStore();
  
  // Track selected dog ID, read actual dog from store (single source of truth)
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const selectedDog = selectedDogId ? dogs.find(d => d.id === selectedDogId) || null : null;
  
  // Track if we've already applied this focus to prevent re-triggering
  const appliedFocusRef = useRef<string | null>(null);
  
  // Handle focus query param - auto-select dog when navigating from Operations Hub
  useEffect(() => {
    // Skip if no focus param or already applied this focus
    if (!focusDogId || focusDogId === appliedFocusRef.current) return;
    
    // Wait for dogs to load
    if (dogs.length === 0) return;
    
    const dogToFocus = dogs.find(d => d.id === focusDogId);
    if (dogToFocus) {
      setSelectedDogId(focusDogId);
      setDrawerOpen(true);
      appliedFocusRef.current = focusDogId;
    }
  }, [focusDogId, dogs]);

  const handleSelectDog = useCallback((dog: DogWithIntake) => {
    // Don't open drawer if currently dragging
    if (activeId) return;
    setSelectedDogId(dog.id);
    setDrawerOpen(true);
  }, [activeId]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleStageChangeFromDrawer = useCallback((dogId: string, newStage: string) => {
    const dog = dogs.find(d => d.id === dogId);
    if (!dog) return;
    
    // Validate transition
    const validation = canTransition(dog, newStage);
    if (!validation.allowed) {
      toast({
        title: "Cannot move pet",
        description: validation.reason || "Invalid transition",
        variant: "destructive",
      });
      return;
    }
    
    // Use centralized transition with source tracking
    const result = transitionDogStage({
      dogId,
      toStage: newStage,
      source: 'panel',
      reason: 'Stage changed from side panel',
    });
    
    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Failed to update stage",
        variant: "destructive",
      });
      return;
    }
    
    // Persist to server (selectedDog will auto-update from store)
    if (dog.intake) {
      updatePipelineMutation.mutate({
        dogId: dog.id,
        intakeId: dog.intake.id,
        newStatus: newStage,
      });
    } else {
      createIntakeMutation.mutate({
        dogId: dog.id,
        pipelineStatus: newStage,
      });
    }
  }, [dogs, canTransition, transitionDogStage, toast]);

  const updateScrollButtons = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    }
  }, []);

  const scrollLeft = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ left: -300, behavior: "smooth" });
  }, []);

  const scrollRight = useCallback(() => {
    scrollContainerRef.current?.scrollBy({ left: 300, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      updateScrollButtons();
      container.addEventListener("scroll", updateScrollButtons);
      window.addEventListener("resize", updateScrollButtons);
      return () => {
        container.removeEventListener("scroll", updateScrollButtons);
        window.removeEventListener("resize", updateScrollButtons);
      };
    }
  }, [updateScrollButtons]);

  const { data: serverDogs = [], isLoading } = useQuery<DogWithIntake[]>({
    queryKey: ["/api/shelter/dogs"],
  });
  
  // Fetch shelter tasks for task counts on cards
  interface ShelterTask {
    id: string;
    dogId: string | null;
    status: string;
    dueDate: string | null;
    priority: string;
  }
  
  const { data: tasks = [] } = useQuery<ShelterTask[]>({
    queryKey: ["/api/shelter/tasks"],
  });
  
  // Calculate task counts per dog
  const taskCountsByDog = useMemo(() => {
    const counts: Record<string, TaskCounts> = {};
    const now = new Date();
    
    for (const task of tasks) {
      if (!task.dogId || task.status === 'completed') continue;
      
      if (!counts[task.dogId]) {
        counts[task.dogId] = { total: 0, overdue: 0 };
      }
      
      counts[task.dogId].total++;
      
      // Check if overdue
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        if (dueDate < now) {
          counts[task.dogId].overdue++;
        }
      }
    }
    
    return counts;
  }, [tasks]);

  useEffect(() => {
    if (serverDogs.length > 0) {
      setDogs(serverDogs);
    }
  }, [serverDogs, setDogs]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ intakeId, newStatus }: { dogId: string; intakeId: string; newStatus: string }) => {
      return apiRequest("PATCH", `/api/shelter/intake/${intakeId}`, {
        pipelineStatus: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dashboard"] });
      toast({
        title: "Pipeline updated",
        description: "Pet moved to new stage successfully.",
      });
    },
    onError: () => {
      rollback();
      toast({
        title: "Error",
        description: "Failed to update pipeline status.",
        variant: "destructive",
      });
    },
  });

  const createIntakeMutation = useMutation({
    mutationFn: async ({ dogId, pipelineStatus }: { dogId: string; pipelineStatus: string }) => {
      return apiRequest("POST", `/api/shelter/intake`, {
        dogId,
        intakeType: "owner_surrender",
        initialCondition: "good",
        pipelineStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dashboard"] });
      toast({
        title: "Pipeline updated",
        description: "Pet moved to new stage successfully.",
      });
    },
    onError: () => {
      rollback();
      toast({
        title: "Error",
        description: "Failed to create intake record.",
        variant: "destructive",
      });
    },
  });

  // Quick task creation mutation for FAB
  const quickTaskMutation = useMutation({
    mutationFn: async ({ dogId, title, taskType }: { dogId?: string; title: string; taskType: string }) => {
      return apiRequest("POST", "/api/shelter/tasks", {
        dogId,
        title,
        taskType,
        status: "pending",
        priority: "medium",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      toast({
        title: "Task created",
        description: "Quick task has been added.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task.",
        variant: "destructive",
      });
    },
  });

  // Quick medical note mutation for FAB
  const quickMedicalMutation = useMutation({
    mutationFn: async ({ dogId, notes }: { dogId: string; notes: string }) => {
      return apiRequest("POST", "/api/shelter/medical", {
        dogId,
        recordType: "other",
        title: "Quick Note",
        notes,
        recordDate: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/medical"] });
      toast({
        title: "Note added",
        description: "Medical note has been recorded.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add medical note.",
        variant: "destructive",
      });
    },
  });

  // FAB handlers
  const handleQuickAddTask = useCallback((dogId?: string) => {
    const title = dogId 
      ? `Task for ${dogs.find(d => d.id === dogId)?.name || 'pet'}`
      : 'General shelter task';
    quickTaskMutation.mutate({ dogId, title, taskType: 'admin' });
  }, [dogs, quickTaskMutation]);

  const handleQuickAddMedical = useCallback((dogId?: string) => {
    if (!dogId) {
      toast({
        title: "Select a pet first",
        description: "Open a pet's detail panel to add a medical note.",
      });
      return;
    }
    // For now, create a simple timestamped note - could expand to dialog later
    quickMedicalMutation.mutate({ 
      dogId, 
      notes: `Quick observation - ${new Date().toLocaleString()}` 
    });
  }, [quickMedicalMutation, toast]);

  // Quick actions from card dropdown
  const handleCardAddTask = useCallback((dogId: string) => {
    const dogName = dogs.find(d => d.id === dogId)?.name || 'pet';
    quickTaskMutation.mutate({ dogId, title: `Task for ${dogName}`, taskType: 'admin' });
  }, [dogs, quickTaskMutation]);

  const handleCardChangeStage = useCallback((dogId: string, newStage: string) => {
    transitionDogStage({
      dogId,
      toStage: newStage,
      source: 'quick_action',
    });
  }, [transitionDogStage]);

  const handleCardMarkUrgent = useCallback((dogId: string) => {
    const dog = dogs.find(d => d.id === dogId);
    if (dog) {
      const newLevel = dog.urgencyLevel === 'urgent' ? 'normal' : 'urgent';
      apiRequest('PATCH', `/api/shelter/dogs/${dogId}`, { urgencyLevel: newLevel })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/shelter/dogs'] });
          toast({
            title: newLevel === 'urgent' ? "Marked as urgent" : "Removed urgent status",
            description: `${dog.name} has been updated.`,
          });
        })
        .catch(() => {
          toast({
            title: "Error",
            description: "Failed to update urgency level.",
            variant: "destructive",
          });
        });
    }
  }, [dogs, toast]);

  // Memoize filtered dogs to avoid recomputation on every render
  const filteredDogs = useMemo(() => {
    if (!searchQuery) return dogs;
    const query = searchQuery.toLowerCase();
    return dogs.filter(dog =>
      dog.name.toLowerCase().includes(query) ||
      dog.breed.toLowerCase().includes(query)
    );
  }, [dogs, searchQuery]);

  const getCanonicalStage = useCallback((dog: DogWithIntake): string => {
    const status = dog.intake?.pipelineStatus || 'intake';
    if (status === 'intake' && dog.intake?.holdType === 'stray_hold') {
      return 'stray_hold';
    }
    return status;
  }, []);

  // Memoize dogs grouped by stage - expensive O(n * stages) operation
  const dogsByStage = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.id] = filteredDogs.filter(dog => getCanonicalStage(dog) === stage.id);
      return acc;
    }, {} as Record<string, DogWithIntake[]>);
  }, [filteredDogs, getCanonicalStage]);

  const activeDog = activeId ? dogs.find(d => d.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const dogId = active.id as string;
    const dog = dogs.find(d => d.id === dogId);
    if (!dog) return;

    const overElement = over.id as string;
    let targetStage = overElement;

    // Check if dropped on a stage column directly
    const isStageColumn = PIPELINE_STAGES.find(s => s.id === overElement);
    
    if (!isStageColumn) {
      // First try: check if we have column data from the droppable
      const columnData = over.data.current as { type?: string; stageId?: string } | undefined;
      if (columnData?.type === 'column' && columnData?.stageId) {
        targetStage = columnData.stageId;
      } else {
        // Fallback: check sortable containerId
        const sortableData = over.data.current?.sortable as { containerId?: string } | undefined;
        if (sortableData?.containerId && PIPELINE_STAGES.find(s => s.id === sortableData.containerId)) {
          targetStage = sortableData.containerId;
        } else {
          // Last resort: dropped on a dog card - get its stage
          const targetDog = dogs.find(d => d.id === overElement);
          if (targetDog) {
            targetStage = getCanonicalStage(targetDog);
          } else {
            return;
          }
        }
      }
    }

    const currentStage = getCanonicalStage(dog);
    if (currentStage === targetStage) return;

    // Validate transition before proceeding
    const validation = canTransition(dog, targetStage);
    if (!validation.allowed) {
      toast({
        title: "Cannot move pet",
        description: validation.reason || "Invalid transition",
        variant: "destructive",
      });
      return;
    }

    // Use centralized transition with source tracking
    const result = transitionDogStage({
      dogId,
      toStage: targetStage,
      source: 'drag',
      reason: `Dragged from ${currentStage} to ${targetStage}`,
    });

    if (!result.success) {
      toast({
        title: "Error",
        description: result.error || "Failed to move pet",
        variant: "destructive",
      });
      return;
    }

    // Persist to server
    if (dog.intake) {
      updatePipelineMutation.mutate({
        dogId: dog.id,
        intakeId: dog.intake.id,
        newStatus: targetStage,
      });
    } else {
      createIntakeMutation.mutate({
        dogId: dog.id,
        pipelineStatus: targetStage,
      });
    }
  }, [dogs, getCanonicalStage, canTransition, transitionDogStage, toast, updatePipelineMutation, createIntakeMutation]);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-muted-foreground">Loading...</p>
        </div>
    );
  }

  return (
    <>
      <div className="h-[calc(100vh-64px)] flex">
      <div className="flex-1 p-4 md:p-6 flex flex-col min-w-0 transition-all duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Pipeline</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {isAdmin 
                ? 'Drag pets between stages to update their status' 
                : `Showing ${visibleStages.length} of ${PIPELINE_STAGES.length} stages for ${userRole} view`
              }
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Show all stages toggle for non-admin users */}
            {!isAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      id="show-all-stages"
                      checked={showAllStages}
                      onCheckedChange={setShowAllStages}
                      data-testid="switch-show-all-stages"
                    />
                    <label htmlFor="show-all-stages" className="text-sm text-muted-foreground cursor-pointer hidden sm:inline">
                      <Eye className="w-4 h-4 inline mr-1" />
                      All
                    </label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Show all pipeline stages</p>
                </TooltipContent>
              </Tooltip>
            )}
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search pets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64 h-11"
                data-testid="input-search"
              />
            </div>
            <Button asChild className="h-11 shrink-0">
              <Link href="/dog-form">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Pet</span>
              </Link>
            </Button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          modifiers={[restrictToWindowEdges]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="relative flex-1 min-h-0">
            {/* Left scroll button */}
            {canScrollLeft && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full shadow-xl border"
                onClick={scrollLeft}
                data-testid="button-scroll-left"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
            )}
            
            {/* Right scroll button */}
            {canScrollRight && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-50 h-12 w-12 rounded-full shadow-xl border"
                onClick={scrollRight}
                data-testid="button-scroll-right"
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            )}

            <div
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-x-auto overflow-y-hidden scroll-smooth"
              style={{ 
                scrollbarWidth: "thin",
                WebkitOverflowScrolling: "touch",
              }}
              onScroll={updateScrollButtons}
            >
              <div className="flex gap-4 h-full min-w-max pb-4 px-12">
                {visibleStages.map((stage) => (
                  <PipelineColumn
                    key={stage.id}
                    stage={stage}
                    dogs={dogsByStage[stage.id] || []}
                    onSelectDog={handleSelectDog}
                    isHighlighted={filterStage === stage.id}
                    taskCountsByDog={taskCountsByDog}
                    onAddTask={handleCardAddTask}
                    onChangeStage={handleCardChangeStage}
                    onMarkUrgent={handleCardMarkUrgent}
                  />
                ))}
              </div>
            </div>
          </div>

          <DragOverlay>
            <AnimatePresence>
              {activeDog && (
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.05, rotate: 2 }}
                  exit={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <DogCard dog={activeDog} isDragging isOverlay />
                </motion.div>
              )}
            </AnimatePresence>
          </DragOverlay>
        </DndContext>
      </div>

      {/* Dog Side Panel - Persistent panel that slides in from right */}
      <DogSidePanel
        dog={selectedDog}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        onStageChange={handleStageChangeFromDrawer}
      />
      </div>
      
      {/* Floating Action Button for quick actions */}
      <FloatingActionButton
        selectedDog={selectedDog}
        onAddTask={handleQuickAddTask}
        onAddMedicalNote={handleQuickAddMedical}
      />
    </>
  );
}
