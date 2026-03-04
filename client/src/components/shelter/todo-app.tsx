import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Search,
  X,
  Calendar,
  CheckCircle2,
  Circle,
  GripVertical,
  MoreVertical,
  Trash2,
  Edit3,
  Menu,
  ListTodo,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShelterTasks, formatDueDate, getDueDateColor, type TaskWithDog } from "@/hooks/use-shelter-tasks";
import { TASK_CATEGORIES, TASK_PRIORITIES, getTaskCategory, getTaskPriority } from "@/lib/task-config";
import { format } from "date-fns";
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

interface TodoAppProps {
  className?: string;
}

function SortableTaskItem({
  task,
  onToggleComplete,
  onSelect,
  onDelete,
  isSelected,
  index,
}: {
  task: TaskWithDog;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onSelect: (task: TaskWithDog) => void;
  onDelete: (taskId: string) => void;
  isSelected: boolean;
  index: number;
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
    animationDelay: `${index * 0.05}s`,
  };

  const isCompleted = task.status === "completed";
  const category = getTaskCategory(task.taskType);
  const priority = getTaskPriority(task.priority);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "todo-item group animate-todo-fade-in",
        isDragging && "opacity-50",
        isSelected && "todo-item-selected"
      )}
      onClick={() => onSelect(task)}
      data-testid={`todo-item-${task.id}`}
    >
      <div className="flex items-center gap-3 w-full">
        <div
          {...attributes}
          {...listeners}
          className="handle opacity-0 group-hover:opacity-100 cursor-grab"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleComplete(task.id, !isCompleted);
          }}
          className="flex-shrink-0"
          data-testid={`button-toggle-task-${task.id}`}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary" />
          )}
        </button>

        <div className="todo-title-area flex-1 min-w-0">
          <span
            className={cn(
              "todo-title block truncate",
              isCompleted && "line-through text-muted-foreground"
            )}
            data-testid={`text-todo-title-${task.id}`}
          >
            {task.title}
          </span>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.dueDate && (
              <span
                className={cn(
                  "text-xs flex items-center gap-1",
                  getDueDateColor(task.dueDate, task.status)
                )}
              >
                <Calendar className="w-3 h-3" />
                {formatDueDate(task.dueDate)}
              </span>
            )}
            {task.dog && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {task.dog.name}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            className="todo-badge uppercase text-[10px] font-semibold px-2 py-0.5"
            style={{
              backgroundColor: category.badgeBg,
              color: category.badgeText,
            }}
          >
            {category.label}
          </Badge>
          {task.priority === "urgent" && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Urgent
            </Badge>
          )}
          {task.priority === "high" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500 text-orange-500">
              High
            </Badge>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 h-7 w-7"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-task-menu-${task.id}`}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelect(task); }}>
              <Edit3 className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function TodoSidebar({
  activeFilter,
  setActiveFilter,
  taskCounts,
  categoryCounts,
  onAddTask,
  isOpen,
  onClose,
}: {
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  taskCounts: { all: number; pending: number; completed: number; overdue: number };
  categoryCounts: Record<string, number>;
  onAddTask: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  const statusFilters = [
    { id: "all", label: "All Tasks", icon: ListTodo, count: taskCounts.all },
    { id: "pending", label: "Pending", icon: Clock, count: taskCounts.pending },
    { id: "completed", label: "Completed", icon: CheckCircle2, count: taskCounts.completed },
    { id: "overdue", label: "Overdue", icon: AlertTriangle, count: taskCounts.overdue },
  ];

  const content = (
    <div className="todo-sidebar h-full flex flex-col">
      <button
        className="sidebar-close-icon lg:invisible"
        onClick={onClose}
        data-testid="button-close-sidebar"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="todo-app-menu flex-1">
        <div className="add-task">
          <Button
            className="w-full justify-start gap-2"
            onClick={onAddTask}
            data-testid="button-sidebar-add-task"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>

        <ScrollArea className="sidebar-menu-list">
          <div className="space-y-1">
            <div className="filter-label text-xs uppercase tracking-wider mb-2 mt-4 px-1">
              Status
            </div>
            <div className="list-group space-y-0.5">
              {statusFilters.map((filter) => {
                const Icon = filter.icon;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={cn(
                      "list-group-item w-full flex items-center justify-between",
                      activeFilter === filter.id && "active"
                    )}
                    data-testid={`filter-status-${filter.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {filter.label}
                    </span>
                    <span className="text-xs opacity-70">{filter.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="filter-label text-xs uppercase tracking-wider mb-2 mt-6 px-1">
              Categories
            </div>
            <div className="list-group space-y-0.5">
              {TASK_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const count = categoryCounts[category.id] || 0;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveFilter(`category:${category.id}`)}
                    className={cn(
                      "list-group-item w-full flex items-center justify-between",
                      activeFilter === `category:${category.id}` && "active"
                    )}
                    data-testid={`filter-category-${category.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: category.badgeText }}
                      />
                      {category.label}
                    </span>
                    <span className="text-xs opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden lg:block sidebar">{content}</div>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="left" className="p-0 w-[280px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Task Filters</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TaskDetailPanel({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  dogs,
  isNew,
}: {
  task: TaskWithDog | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  onDelete: (taskId: string) => void;
  dogs: any[];
  isNew: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("custom");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [dogId, setDogId] = useState<string>("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setTaskType(task.taskType);
      setPriority(task.priority);
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setDogId(task.dogId || "");
    } else {
      setTitle("");
      setDescription("");
      setTaskType("custom");
      setPriority("medium");
      setDueDate(undefined);
      setDogId("");
    }
  }, [task]);

  const handleSave = () => {
    onSave({
      id: task?.id,
      title,
      description,
      taskType,
      priority,
      dueDate: dueDate?.toISOString(),
      dogId: dogId || null,
    });
    onClose();
  };

  const content = (
    <div className="todo-new-task-sidebar-content h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="task-header flex items-center gap-2">
          <h3 className="task-title font-semibold">
            {isNew ? "New Task" : "Edit Task"}
          </h3>
        </div>
        <Button variant="ghost" size="icon" className="close-icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              data-testid="input-task-title"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              className="min-h-[100px]"
              data-testid="input-task-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category</label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger data-testid="select-task-type">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.badgeText }}
                        />
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-task-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Due Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  data-testid="button-select-due-date"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
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

          <div>
            <label className="text-sm font-medium mb-1.5 block">Assign to Pet</label>
            <Select value={dogId || "none"} onValueChange={(val) => setDogId(val === "none" ? "" : val)}>
              <SelectTrigger data-testid="select-task-dog">
                <SelectValue placeholder="Select pet (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {dogs.map((dog: any) => (
                  <SelectItem key={dog.id} value={dog.id}>
                    {dog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t flex gap-2">
        {!isNew && (
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              if (task) onDelete(task.id);
              onClose();
            }}
            data-testid="button-delete-task"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        )}
        <Button className="flex-1 ml-auto" onClick={handleSave} data-testid="button-save-task">
          {isNew ? "Create Task" : "Save Changes"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "todo-new-task-sidebar hidden lg:block",
          isOpen && "show"
        )}
      >
        {content}
      </div>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="p-0 w-[400px] lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>{isNew ? "New Task" : "Edit Task"}</SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function TodoApp({ className }: TodoAppProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("pending");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithDog | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const {
    parentTasks,
    pendingTasks,
    completedTasks,
    overdueTasks,
    dogs,
    isLoading,
    taskCounts,
    getCategoryCounts,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    reorderTasks,
  } = useShelterTasks();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getFilteredTasks = () => {
    let tasks = parentTasks;

    if (activeFilter === "pending") {
      tasks = pendingTasks;
    } else if (activeFilter === "completed") {
      tasks = completedTasks;
    } else if (activeFilter === "overdue") {
      tasks = overdueTasks;
    } else if (activeFilter.startsWith("category:")) {
      const categoryId = activeFilter.replace("category:", "");
      tasks = parentTasks.filter((t) => t.taskType === categoryId);
    }

    if (searchQuery) {
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return tasks;
  };

  const filteredTasks = getFilteredTasks();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = filteredTasks.findIndex((t) => t.id === active.id);
      const newIndex = filteredTasks.findIndex((t) => t.id === over.id);
      const newOrder = arrayMove(filteredTasks, oldIndex, newIndex);
      reorderTasks(newOrder.map((t) => t.id));
    }
  };

  const handleToggleComplete = (taskId: string, completed: boolean) => {
    completeTask({ taskId, completed });
  };

  const handleSelectTask = (task: TaskWithDog) => {
    setSelectedTask(task);
    setIsCreatingNew(false);
  };

  const handleAddTask = () => {
    setSelectedTask(null);
    setIsCreatingNew(true);
  };

  const handleSaveTask = (data: any) => {
    if (data.id) {
      updateTask(data);
    } else {
      createTask(data);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(taskId);
  };

  const handleCloseDetail = () => {
    setSelectedTask(null);
    setIsCreatingNew(false);
  };

  return (
    <div className={cn("todo-application", className)} data-testid="todo-app">
      <div className="flex h-full">
        <TodoSidebar
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          taskCounts={taskCounts}
          categoryCounts={getCategoryCounts()}
          onAddTask={handleAddTask}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="content-right flex-1 min-w-0">
          <div className="todo-app-list-wrapper h-full flex flex-col">
            <div className="todo-fixed-search flex items-center gap-2">
              <button
                className="sidebar-toggle lg:hidden"
                onClick={() => setSidebarOpen(true)}
                data-testid="button-toggle-sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-0 focus-visible:ring-0"
                  data-testid="input-search-tasks"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={handleAddTask}
                data-testid="button-add-task-mobile"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            <div className="todo-app-list flex-1 min-h-0">
              <ScrollArea className="todo-task-list h-full">
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-14 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <ListTodo className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Tasks Found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery ? "No tasks match your search." : "Get started by adding your first task."}
                    </p>
                    {!searchQuery && (
                      <Button onClick={handleAddTask} data-testid="button-empty-add-task">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Task
                      </Button>
                    )}
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={filteredTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="todo-task-list-wrapper">
                        {filteredTasks.map((task, index) => (
                          <SortableTaskItem
                            key={task.id}
                            task={task}
                            onToggleComplete={handleToggleComplete}
                            onSelect={handleSelectTask}
                            onDelete={handleDeleteTask}
                            isSelected={selectedTask?.id === task.id}
                            index={index}
                          />
                        ))}
                      </ul>
                    </SortableContext>
                  </DndContext>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <TaskDetailPanel
          task={selectedTask}
          isOpen={!!selectedTask || isCreatingNew}
          onClose={handleCloseDetail}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          dogs={dogs}
          isNew={isCreatingNew}
        />
      </div>
    </div>
  );
}
