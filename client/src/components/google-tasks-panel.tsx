import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import {
  Plus,
  Circle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Calendar,
  MoreVertical,
  Trash2,
  Edit3,
  Flag,
  X,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { ShelterTask, Dog } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface TaskWithSubtasks extends ShelterTask {
  subtasks?: TaskWithSubtasks[];
  dog?: Dog | null;
}

interface GoogleTasksPanelProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  className?: string;
}

function formatDueDate(dueDate: Date | string | null): string {
  if (!dueDate) return "";
  const date = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

function getDueDateColor(dueDate: Date | string | null, status: string): string {
  if (status === "completed") return "text-muted-foreground";
  if (!dueDate) return "text-muted-foreground";
  const date = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  if (isPast(date) && !isToday(date)) return "text-red-500";
  if (isToday(date)) return "text-blue-500";
  return "text-muted-foreground";
}

function SortableTaskItem({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  onAddSubtask,
  isExpanded,
  onToggleExpand,
  onReorderSubtasks,
  depth = 0,
}: {
  task: TaskWithSubtasks;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onEdit: (task: TaskWithSubtasks) => void;
  onDelete: (taskId: string) => void;
  onAddSubtask: (parentId: string) => void;
  isExpanded: boolean;
  onToggleExpand: (taskId: string) => void;
  onReorderSubtasks?: (parentId: string, orderedIds: string[]) => void;
  depth?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isCompleted = task.status === "completed";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group",
        isDragging && "opacity-50",
        depth > 0 && "ml-6"
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2 py-2 px-2 rounded-md hover-elevate cursor-pointer",
          isCompleted && "opacity-60"
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 cursor-grab pt-1"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        {hasSubtasks && (
          <button
            onClick={() => onToggleExpand(task.id)}
            className="pt-1"
            data-testid={`button-expand-task-${task.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        )}

        <Checkbox
          checked={isCompleted}
          onCheckedChange={(checked) => onToggleComplete(task.id, !!checked)}
          className="mt-1"
          data-testid={`checkbox-task-${task.id}`}
        />

        <div className="flex-1 min-w-0" onClick={() => onEdit(task)}>
          <p
            className={cn(
              "text-sm font-medium truncate",
              isCompleted && "line-through text-muted-foreground"
            )}
            data-testid={`text-task-title-${task.id}`}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {task.dueDate && (
              <span
                className={cn(
                  "text-xs flex items-center gap-1",
                  getDueDateColor(task.dueDate, task.status)
                )}
              >
                <Calendar className="w-3 h-3" />
                {formatDueDate(task.dueDate)}
                {task.dueTime && `, ${task.dueTime}`}
              </span>
            )}
            {task.priority === "urgent" && (
              <Badge variant="destructive" className="text-xs px-1 py-0">
                Urgent
              </Badge>
            )}
            {task.priority === "high" && (
              <Badge variant="outline" className="text-xs px-1 py-0 border-orange-500 text-orange-500">
                High
              </Badge>
            )}
            {task.dog && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                {task.dog.name}
              </Badge>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 h-7 w-7"
              data-testid={`button-task-menu-${task.id}`}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            {depth === 0 && (
              <DropdownMenuItem onClick={() => onAddSubtask(task.id)}>
                <Plus className="w-4 h-4 mr-2" />
                Add subtask
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(task.id)}
              className="text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasSubtasks && isExpanded && (
        <div className="border-l-2 border-muted ml-4">
          {(() => {
            const sortedSubtasks = [...task.subtasks!].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            return onReorderSubtasks ? (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={(event) => {
                  const { active, over } = event;
                  if (over && active.id !== over.id) {
                    const oldIndex = sortedSubtasks.findIndex((t) => t.id === active.id);
                    const newIndex = sortedSubtasks.findIndex((t) => t.id === over.id);
                    const newOrder = arrayMove(sortedSubtasks, oldIndex, newIndex);
                    onReorderSubtasks(task.id, newOrder.map((t) => t.id));
                  }
                }}
              >
                <SortableContext
                  items={sortedSubtasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedSubtasks.map((subtask) => (
                    <SortableTaskItem
                      key={subtask.id}
                      task={subtask}
                      onToggleComplete={onToggleComplete}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onAddSubtask={onAddSubtask}
                      isExpanded={false}
                      onToggleExpand={onToggleExpand}
                      depth={depth + 1}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              sortedSubtasks.map((subtask) => (
                <SortableTaskItem
                  key={subtask.id}
                  task={subtask}
                  onToggleComplete={onToggleComplete}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddSubtask={onAddSubtask}
                  isExpanded={false}
                  onToggleExpand={onToggleExpand}
                  depth={depth + 1}
                />
              ))
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function GoogleTasksPanel({
  selectedDate,
  onDateSelect,
  className,
}: GoogleTasksPanelProps) {
  const { toast } = useToast();
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingTask, setEditingTask] = useState<TaskWithSubtasks | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: allTasks = [], isLoading } = useQuery<TaskWithSubtasks[]>({
    queryKey: ["/api/shelter/tasks"],
  });

  const parentTasks = allTasks
    .filter((t) => !t.parentTaskId)
    .map((task) => ({
      ...task,
      subtasks: allTasks.filter((st) => st.parentTaskId === task.id),
    }))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const pendingTasks = parentTasks.filter((t) => t.status !== "completed");
  const completedTasks = parentTasks.filter((t) => t.status === "completed");

  const createTaskMutation = useMutation({
    mutationFn: async (data: { title: string; parentTaskId?: string; dueDate?: string }) => {
      const maxSortOrder = Math.max(0, ...allTasks.map((t) => t.sortOrder || 0));
      return apiRequest("POST", "/api/shelter/tasks", {
        title: data.title,
        taskType: "custom",
        priority: "medium",
        parentTaskId: data.parentTaskId || null,
        sortOrder: maxSortOrder + 1,
        dueDate: data.dueDate || (selectedDate ? selectedDate.toISOString() : null),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/calendar"] });
      setNewTaskTitle("");
      setSubtaskTitle("");
      setAddingSubtaskTo(null);
      setShowAddTask(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TaskWithSubtasks> & { id: string }) => {
      return apiRequest("PATCH", `/api/shelter/tasks/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/calendar"] });
      setEditingTask(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      if (completed) {
        return apiRequest("POST", `/api/shelter/tasks/${taskId}/complete`, {});
      } else {
        return apiRequest("PATCH", `/api/shelter/tasks/${taskId}`, { status: "pending", completedAt: null });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/calendar"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("DELETE", `/api/shelter/tasks/${taskId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/calendar"] });
      toast({ title: "Task deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderTasksMutation = useMutation({
    mutationFn: async ({ orderedIds, parentTaskId }: { orderedIds: string[]; parentTaskId?: string | null }) => {
      return apiRequest("POST", "/api/shelter/tasks/reorder", { orderedIds, parentTaskId: parentTaskId || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
    },
  });

  useEffect(() => {
    if (showAddTask && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddTask]);

  useEffect(() => {
    if (addingSubtaskTo && subtaskInputRef.current) {
      subtaskInputRef.current.focus();
    }
  }, [addingSubtaskTo]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = pendingTasks.findIndex((t) => t.id === active.id);
      const newIndex = pendingTasks.findIndex((t) => t.id === over.id);
      const newOrder = arrayMove(pendingTasks, oldIndex, newIndex);
      reorderTasksMutation.mutate({ orderedIds: newOrder.map((t) => t.id), parentTaskId: null });
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      createTaskMutation.mutate({ title: newTaskTitle.trim() });
    }
  };

  const handleAddSubtask = (parentId: string) => {
    setAddingSubtaskTo(parentId);
    setExpandedTasks((prev) => new Set(prev).add(parentId));
  };

  const handleSubmitSubtask = () => {
    if (subtaskTitle.trim() && addingSubtaskTo) {
      createTaskMutation.mutate({
        title: subtaskTitle.trim(),
        parentTaskId: addingSubtaskTo,
      });
    }
  };

  const handleReorderSubtasks = (parentId: string, orderedIds: string[]) => {
    reorderTasksMutation.mutate({ orderedIds, parentTaskId: parentId });
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="font-semibold text-lg" data-testid="text-tasks-title">Tasks</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowAddTask(true)}
          data-testid="button-add-task"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {showAddTask && (
            <div className="flex items-center gap-2 p-2 mb-2 rounded-md bg-muted/50">
              <Circle className="w-5 h-5 text-muted-foreground" />
              <Input
                ref={addInputRef}
                placeholder="Add a task"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddTask();
                  if (e.key === "Escape") {
                    setShowAddTask(false);
                    setNewTaskTitle("");
                  }
                }}
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 h-8"
                data-testid="input-new-task"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setShowAddTask(false);
                  setNewTaskTitle("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : pendingTasks.length === 0 && !showAddTask ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No tasks</p>
              <Button
                variant="ghost"
                className="text-sm text-primary"
                onClick={() => setShowAddTask(true)}
                data-testid="button-add-first-task"
              >
                Add a task
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pendingTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {pendingTasks.map((task) => (
                  <div key={task.id}>
                    <SortableTaskItem
                      task={task}
                      onToggleComplete={(id, completed) =>
                        completeTaskMutation.mutate({ taskId: id, completed })
                      }
                      onEdit={setEditingTask}
                      onDelete={(id) => deleteTaskMutation.mutate(id)}
                      onAddSubtask={handleAddSubtask}
                      isExpanded={expandedTasks.has(task.id)}
                      onToggleExpand={toggleExpand}
                      onReorderSubtasks={handleReorderSubtasks}
                    />
                    {addingSubtaskTo === task.id && (
                      <div className="flex items-center gap-2 p-2 ml-10 rounded-md bg-muted/50">
                        <Circle className="w-4 h-4 text-muted-foreground" />
                        <Input
                          ref={subtaskInputRef}
                          placeholder="Add subtask"
                          value={subtaskTitle}
                          onChange={(e) => setSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSubmitSubtask();
                            if (e.key === "Escape") {
                              setAddingSubtaskTo(null);
                              setSubtaskTitle("");
                            }
                          }}
                          className="flex-1 border-0 bg-transparent focus-visible:ring-0 h-7 text-sm"
                          data-testid="input-subtask"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setAddingSubtaskTo(null);
                            setSubtaskTitle("");
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </SortableContext>
            </DndContext>
          )}

          {completedTasks.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full px-2 py-1"
                data-testid="button-toggle-completed"
              >
                {showCompleted ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Completed ({completedTasks.length})
              </button>
              {showCompleted && (
                <div className="mt-1">
                  {completedTasks.map((task) => (
                    <SortableTaskItem
                      key={task.id}
                      task={task}
                      onToggleComplete={(id, completed) =>
                        completeTaskMutation.mutate({ taskId: id, completed })
                      }
                      onEdit={setEditingTask}
                      onDelete={(id) => deleteTaskMutation.mutate(id)}
                      onAddSubtask={handleAddSubtask}
                      isExpanded={expandedTasks.has(task.id)}
                      onToggleExpand={toggleExpand}
                      onReorderSubtasks={handleReorderSubtasks}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {editingTask && (
        <TaskEditSheet
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={(updates) =>
            updateTaskMutation.mutate({ id: editingTask.id, ...updates })
          }
          onDelete={() => {
            deleteTaskMutation.mutate(editingTask.id);
            setEditingTask(null);
          }}
        />
      )}
    </div>
  );
}

function TaskEditSheet({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: TaskWithSubtasks;
  onClose: () => void;
  onSave: (updates: Partial<TaskWithSubtasks>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.dueDate ? new Date(task.dueDate) : undefined
  );
  const [dueTime, setDueTime] = useState(task.dueTime || "");
  const [priority, setPriority] = useState(task.priority);

  const handleSave = () => {
    onSave({
      title,
      description: description || null,
      dueDate: dueDate ? dueDate : null,
      dueTime: dueTime || null,
      priority,
    } as any);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-background border-l shadow-lg z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-red-600"
            data-testid="button-delete-task"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-medium border-0 px-0 focus-visible:ring-0"
              placeholder="Task title"
              data-testid="input-edit-task-title"
            />
          </div>

          <div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details"
              className="min-h-[100px] resize-none"
              data-testid="input-edit-task-description"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Due date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  data-testid="button-select-due-date"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {dueDate ? format(dueDate, "MMM d, yyyy") : "No date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {dueDate && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Time (optional)</label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                data-testid="input-edit-task-time"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <div className="flex gap-2">
              {["low", "medium", "high", "urgent"].map((p) => (
                <Button
                  key={p}
                  variant={priority === p ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriority(p)}
                  className={cn(
                    priority === p && p === "urgent" && "bg-red-500",
                    priority === p && p === "high" && "bg-orange-500"
                  )}
                  data-testid={`button-priority-${p}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Button onClick={handleSave} className="w-full" data-testid="button-save-task">
          Save changes
        </Button>
      </div>
    </div>
  );
}
