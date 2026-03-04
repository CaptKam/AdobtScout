import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { 
  Sparkles, 
  Plus,
  Zap,
  Clock,
  Calendar,
  AlertTriangle,
  Dog,
  Stethoscope,
  ClipboardList,
  Trash2,
  Edit,
  Play,
  Pause
} from "lucide-react";

interface TaskRule {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  triggerConditions: any;
  taskTitle: string;
  taskDescription: string;
  taskCategory: string;
  taskPriority: string;
  dueDateOffset: number;
  dueTimeOfDay: string;
  assignToRole: string;
  isRecurring: boolean;
  recurrencePattern: string;
  recurrenceInterval: number;
  isActive: boolean;
  createdAt: string;
}

const TRIGGER_TYPES = [
  { value: 'intake', label: 'Pet Intake', icon: Dog, description: 'When a new pet is added' },
  { value: 'medical_due', label: 'Medical Due', icon: Stethoscope, description: 'When medical care is due' },
  { value: 'application_received', label: 'Application Received', icon: ClipboardList, description: 'When adoption application is submitted' },
  { value: 'time_in_shelter', label: 'Time in Shelter', icon: Clock, description: 'After X days in shelter' },
  { value: 'schedule', label: 'Scheduled', icon: Calendar, description: 'On a recurring schedule' },
];

const TASK_CATEGORIES = [
  { value: 'medical', label: 'Medical' },
  { value: 'feeding', label: 'Feeding' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'general', label: 'General' },
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
];

export default function ShelterTaskAutomation() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<TaskRule | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      triggerType: 'intake',
      taskTitle: '',
      taskDescription: '',
      taskCategory: 'general',
      taskPriority: 'medium',
      dueDateOffset: 0,
      dueTimeOfDay: '09:00',
      assignToRole: 'staff',
      isRecurring: false,
      recurrencePattern: 'daily',
      recurrenceInterval: 1,
      isActive: true,
    },
  });

  const { data: rules = [], isLoading } = useQuery<TaskRule[]>({
    queryKey: ["/api/shelter/task-rules"],
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/shelter/task-rules", data),
    onSuccess: () => {
      toast({ title: "Success", description: "Task rule created" });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/task-rules"] });
      setShowAddDialog(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/shelter/task-rules/${id}`, data),
    onSuccess: () => {
      toast({ title: "Success", description: "Task rule updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/task-rules"] });
      setEditingRule(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shelter/task-rules/${id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Task rule deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/task-rules"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/shelter/task-rules/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/task-rules"] });
    },
  });

  const onSubmit = (data: any) => {
    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, data });
    } else {
      createRuleMutation.mutate(data);
    }
  };

  const handleEdit = (rule: TaskRule) => {
    setEditingRule(rule);
    form.reset({
      name: rule.name,
      description: rule.description || '',
      triggerType: rule.triggerType,
      taskTitle: rule.taskTitle,
      taskDescription: rule.taskDescription || '',
      taskCategory: rule.taskCategory,
      taskPriority: rule.taskPriority,
      dueDateOffset: rule.dueDateOffset || 0,
      dueTimeOfDay: rule.dueTimeOfDay || '09:00',
      assignToRole: rule.assignToRole || 'staff',
      isRecurring: rule.isRecurring || false,
      recurrencePattern: rule.recurrencePattern || 'daily',
      recurrenceInterval: rule.recurrenceInterval || 1,
      isActive: rule.isActive,
    });
    setShowAddDialog(true);
  };

  const activeRules = rules.filter(r => r.isActive);
  const inactiveRules = rules.filter(r => !r.isActive);

  return (
    <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              Task Automation
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">Set up automatic task generation rules</p>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              setEditingRule(null);
              form.reset();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-rule">
                <Plus className="w-4 h-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Task Rule'}</DialogTitle>
                <DialogDescription>
                  Define when and what tasks should be automatically created
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rule Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., New Intake Health Check" {...field} data-testid="input-rule-name" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="triggerType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trigger</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-trigger-type">
                              <SelectValue placeholder="Select trigger" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TRIGGER_TYPES.map((trigger) => (
                              <SelectItem key={trigger.value} value={trigger.value}>
                                <div className="flex items-center gap-2">
                                  <trigger.icon className="w-4 h-4" />
                                  {trigger.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>When should this rule trigger?</FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Task Details</h4>
                    
                    <FormField
                      control={form.control}
                      name="taskTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Task Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Initial Health Exam" {...field} data-testid="input-task-title" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <FormField
                        control={form.control}
                        name="taskCategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-category">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {TASK_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="taskPriority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-task-priority">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {PRIORITY_LEVELS.map((p) => (
                                  <SelectItem key={p.value} value={p.value}>
                                    {p.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="dueDateOffset"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Due Date (days from trigger)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={0} 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-due-date-offset"
                            />
                          </FormControl>
                          <FormDescription>0 = same day, 1 = next day, etc.</FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="taskDescription"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Task instructions..."
                              {...field}
                              data-testid="textarea-task-description"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t pt-4">
                    <FormField
                      control={form.control}
                      name="isRecurring"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <div>
                            <FormLabel>Recurring Task</FormLabel>
                            <FormDescription>Repeat this task on a schedule</FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {form.watch('isRecurring') && (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <FormField
                          control={form.control}
                          name="recurrencePattern"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Frequency</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="recurrenceInterval"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Every X</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min={1}
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={createRuleMutation.isPending || updateRuleMutation.isPending} data-testid="button-save-rule">
                      {editingRule ? 'Update Rule' : 'Create Rule'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeRules.length}</p>
                <p className="text-sm text-muted-foreground">Active Rules</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Pause className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{inactiveRules.length}</p>
                <p className="text-sm text-muted-foreground">Paused Rules</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.length}</p>
                <p className="text-sm text-muted-foreground">Total Rules</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">Active ({activeRules.length})</TabsTrigger>
            <TabsTrigger value="inactive">Paused ({inactiveRules.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : activeRules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No active rules</h3>
                  <p className="text-muted-foreground mb-4">Create your first automation rule to get started</p>
                  <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeRules.map((rule) => {
                  const trigger = TRIGGER_TYPES.find(t => t.value === rule.triggerType);
                  const priority = PRIORITY_LEVELS.find(p => p.value === rule.taskPriority);
                  const TriggerIcon = trigger?.icon || Zap;
                  
                  return (
                    <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mt-1">
                              <TriggerIcon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{rule.name}</h3>
                              <p className="text-sm text-muted-foreground">{trigger?.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{rule.taskCategory}</Badge>
                                <Badge className={priority?.color}>{priority?.label}</Badge>
                                {rule.isRecurring && (
                                  <Badge variant="outline" className="gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {rule.recurrencePattern}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={(checked) =>
                                toggleRuleMutation.mutate({ id: rule.id, isActive: checked })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(rule)}
                              data-testid={`button-edit-rule-${rule.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              data-testid={`button-delete-rule-${rule.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="inactive" className="mt-4">
            {inactiveRules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Pause className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No paused rules</h3>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {inactiveRules.map((rule) => {
                  const trigger = TRIGGER_TYPES.find(t => t.value === rule.triggerType);
                  const TriggerIcon = trigger?.icon || Zap;
                  
                  return (
                    <Card key={rule.id} className="opacity-60" data-testid={`card-rule-inactive-${rule.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <TriggerIcon className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <h3 className="font-medium">{rule.name}</h3>
                              <p className="text-sm text-muted-foreground">{rule.taskTitle}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={(checked) =>
                                toggleRuleMutation.mutate({ id: rule.id, isActive: checked })
                              }
                            />
                            <Button variant="ghost" size="icon" onClick={() => deleteRuleMutation.mutate(rule.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
  );
}