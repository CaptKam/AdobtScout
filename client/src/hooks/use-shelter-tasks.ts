import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isPast, isToday, isTomorrow, parseISO, format } from "date-fns";
import type { ShelterTask, Dog } from "@shared/schema";

export interface TaskWithDog extends ShelterTask {
  dog?: Dog | null;
  subtasks?: TaskWithDog[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  taskType: string;
  priority: string;
  dueDate?: string | null;
  dueTime?: string | null;
  dogId?: string | null;
  parentTaskId?: string | null;
  sortOrder?: number;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
  status?: string;
  completedAt?: string | null;
}

export function useShelterTasks() {
  const { toast } = useToast();

  const { data: tasks = [], isLoading, error } = useQuery<TaskWithDog[]>({
    queryKey: ["/api/shelter/tasks"],
  });

  const { data: dogs = [] } = useQuery<Dog[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const parentTasks = tasks
    .filter((t) => !t.parentTaskId)
    .map((task) => ({
      ...task,
      subtasks: tasks.filter((st) => st.parentTaskId === task.id),
    }))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const pendingTasks = parentTasks.filter((t) => t.status !== "completed");
  const completedTasks = parentTasks.filter((t) => t.status === "completed");
  const overdueTasks = parentTasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && t.status !== "completed"
  );

  const createTaskMutation = useMutation({
    mutationFn: async (data: CreateTaskInput) => {
      const maxSortOrder = Math.max(0, ...tasks.map((t) => t.sortOrder || 0));
      return apiRequest("POST", "/api/shelter/tasks", {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        dogId: data.dogId || null,
        sortOrder: data.sortOrder ?? maxSortOrder + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks/pending/count"] });
      toast({ title: "Task Created", description: "New task has been added." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTaskInput) => {
      return apiRequest("PATCH", `/api/shelter/tasks/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/calendar"] });
      toast({ title: "Task Updated", description: "Task has been updated." });
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
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks/pending/count"] });
      toast({ title: "Task Updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("DELETE", `/api/shelter/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/calendar"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks/pending/count"] });
      toast({ title: "Task Deleted", description: "Task has been removed." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderTasksMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      return apiRequest("POST", "/api/shelter/tasks/reorder", { orderedIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const taskCounts = {
    all: parentTasks.length,
    pending: pendingTasks.length,
    completed: completedTasks.length,
    overdue: overdueTasks.length,
  };

  const getTasksByCategory = (categoryId: string) => {
    if (categoryId === "all") return parentTasks;
    return parentTasks.filter((t) => t.taskType === categoryId);
  };

  const getCategoryCounts = () => {
    const counts: Record<string, number> = { all: parentTasks.length };
    parentTasks.forEach((t) => {
      counts[t.taskType] = (counts[t.taskType] || 0) + 1;
    });
    return counts;
  };

  return {
    tasks,
    parentTasks,
    pendingTasks,
    completedTasks,
    overdueTasks,
    dogs,
    isLoading,
    error,
    taskCounts,
    getTasksByCategory,
    getCategoryCounts,
    createTask: createTaskMutation.mutate,
    updateTask: updateTaskMutation.mutate,
    completeTask: completeTaskMutation.mutate,
    deleteTask: deleteTaskMutation.mutate,
    reorderTasks: reorderTasksMutation.mutate,
    isCreating: createTaskMutation.isPending,
    isUpdating: updateTaskMutation.isPending,
    isDeleting: deleteTaskMutation.isPending,
  };
}

export function formatDueDate(dueDate: Date | string | null): string {
  if (!dueDate) return "";
  const date = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d");
}

export function getDueDateColor(dueDate: Date | string | null, status: string): string {
  if (status === "completed") return "text-muted-foreground";
  if (!dueDate) return "text-muted-foreground";
  const date = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  if (isPast(date) && !isToday(date)) return "text-red-500";
  if (isToday(date)) return "text-blue-500";
  return "text-muted-foreground";
}

export function getDueDateInfo(dueDate: Date | string | null, status: string) {
  if (!dueDate) return null;
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (status === "completed") {
    return { label: format(date, "MMM d"), className: "text-muted-foreground" };
  }
  if (isPast(date) && !isToday(date)) {
    return { label: "Overdue", className: "text-red-600 font-medium" };
  }
  if (isToday(date)) {
    return { label: "Today", className: "text-orange-600 font-medium" };
  }
  if (isTomorrow(date)) {
    return { label: "Tomorrow", className: "text-yellow-600" };
  }
  return { label: format(date, "MMM d"), className: "text-muted-foreground" };
}
