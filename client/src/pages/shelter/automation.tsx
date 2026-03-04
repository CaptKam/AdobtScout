import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Sparkles, Plus, Zap, Clock, Dog, Syringe, 
  Activity, ClipboardList, Bell, ArrowRight, Settings,
  Play, Pause, Trash2, Edit, CheckCircle, Calendar,
  FileText, Home, ShoppingCart
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MedicalTemplate } from "@shared/schema";

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  actionType: string;
  isActive: boolean;
  createdAt: string;
}

// Predefined automation rule templates
const RULE_TEMPLATES = [
  {
    id: 'intake_tasks',
    name: 'Create Intake Tasks',
    description: 'When a dog is added, automatically create intake assessment tasks',
    trigger: 'dog_created',
    action: 'create_tasks',
    icon: ClipboardList,
    color: 'bg-blue-500',
  },
  {
    id: 'vaccine_schedule',
    name: 'Schedule Next Vaccine',
    description: 'When a vaccine is administered, schedule the next dose',
    trigger: 'vaccine_applied',
    action: 'schedule_vaccine',
    icon: Syringe,
    color: 'bg-green-500',
  },
  {
    id: 'stray_hold_complete',
    name: 'Stray Hold Complete',
    description: 'After 72 hours, auto-move dog from stray hold to medical eval',
    trigger: 'hold_expired',
    action: 'update_pipeline',
    icon: Clock,
    color: 'bg-yellow-500',
  },
  {
    id: 'medical_complete',
    name: 'Medical Complete',
    description: 'When medical clearance is given, move to behavior eval',
    trigger: 'medical_cleared',
    action: 'update_pipeline',
    icon: Activity,
    color: 'bg-purple-500',
  },
  {
    id: 'ready_notification',
    name: 'Ready for Adoption',
    description: 'When dog is marked ready, push to adopt feed and notify',
    trigger: 'status_ready',
    action: 'publish_and_notify',
    icon: Bell,
    color: 'bg-orange-500',
  },
  {
    id: 'overdue_alert',
    name: 'Overdue Task Alert',
    description: 'When tasks are overdue, send alert to Operations Hub',
    trigger: 'task_overdue',
    action: 'create_alert',
    icon: Bell,
    color: 'bg-red-500',
  },
];

// Predefined protocols
const PROTOCOL_TEMPLATES = [
  {
    id: 'puppy_vaccine',
    name: 'Puppy Vaccine Series',
    description: 'Standard puppy vaccination protocol (6-16 weeks)',
    steps: [
      { week: 6, action: 'DHPP #1' },
      { week: 9, action: 'DHPP #2' },
      { week: 12, action: 'DHPP #3, Rabies' },
      { week: 16, action: 'DHPP #4' },
    ],
    icon: Syringe,
  },
  {
    id: 'adult_intake',
    name: 'Adult Dog Intake Protocol',
    description: 'Standard intake process for adult dogs',
    steps: [
      { day: 1, action: 'Initial health check, weight, photos' },
      { day: 1, action: 'DHPP vaccine if not current' },
      { day: 3, action: 'Behavior assessment' },
      { day: 7, action: 'Spay/neuter scheduling' },
    ],
    icon: Dog,
  },
  {
    id: 'medical_care',
    name: 'Medical Care Package',
    description: 'Standard medical treatments for all dogs',
    steps: [
      { day: 1, action: 'Flea/tick prevention' },
      { day: 1, action: 'Deworming' },
      { day: 1, action: 'Heartworm test' },
      { day: 30, action: 'Heartworm prevention' },
    ],
    icon: Activity,
  },
  {
    id: 'spay_neuter',
    name: 'Spay/Neuter Workflow',
    description: 'Pre and post surgery care protocol',
    steps: [
      { day: -1, action: 'Pre-surgical exam' },
      { day: -1, action: 'NPO after midnight' },
      { day: 0, action: 'Surgery' },
      { day: 1, action: 'Post-op check' },
      { day: 10, action: 'Suture removal' },
    ],
    icon: FileText,
  },
];

export default function AutomationEngine() {
  const [activeTab, setActiveTab] = useState("rules");
  const [showAddRule, setShowAddRule] = useState(false);
  const [applyProtocolId, setApplyProtocolId] = useState<string | null>(null);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: automationRules = [] } = useQuery<AutomationRule[]>({
    queryKey: ["/api/shelter/automation-rules"],
  });

  const { data: medicalTemplates = [] } = useQuery<MedicalTemplate[]>({
    queryKey: ["/api/shelter/medical-templates"],
  });

  const { data: shelterDogs = [] } = useQuery<{ id: string; name: string; breed?: string; photos?: string[] }[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const applyProtocolMutation = useMutation({
    mutationFn: async ({ protocolId, dogId }: { protocolId: string; dogId: string }) => {
      return apiRequest("POST", `/api/shelter/apply-protocol`, { protocolId, dogId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      setApplyProtocolId(null);
      setSelectedDogId(null);
      toast({
        title: "Protocol applied",
        description: "Tasks have been created for the selected dog.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply protocol",
        variant: "destructive",
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/shelter/automation-rules/${ruleId}`, { isActive: enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/automation-rules"] });
      toast({
        title: "Rule updated",
        description: "Automation rule has been updated.",
      });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (template: typeof RULE_TEMPLATES[0]) => {
      return apiRequest("POST", "/api/shelter/automation-rules", {
        name: template.name,
        description: template.description,
        triggerType: template.trigger,
        actionType: template.action,
        isActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/automation-rules"] });
      setShowAddRule(false);
      toast({
        title: "Rule created",
        description: "Automation rule has been created and enabled.",
      });
    },
  });

  return (
    
      <div className="p-4 md:p-6 space-y-6" data-testid="page-shelter-automation">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Automation & Protocols</h1>
            <p className="text-sm md:text-base text-muted-foreground">Let the shelter run itself with automated workflows</p>
          </div>
          <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Automation Rule</DialogTitle>
                <DialogDescription>
                  Choose a template to create a new automation rule
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {RULE_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <Card 
                      key={template.id}
                      className="cursor-pointer hover:shadow-md transition-all hover:border-primary"
                      onClick={() => createRuleMutation.mutate(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg ${template.color} flex items-center justify-center`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{template.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rules" className="gap-2">
              <Zap className="w-4 h-4" />
              Automation Rules
            </TabsTrigger>
            <TabsTrigger value="protocols" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Protocols
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />
              Medical Templates
            </TabsTrigger>
          </TabsList>

          {/* Automation Rules Tab */}
          <TabsContent value="rules" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Active Rules */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-500" />
                  Active Rules ({automationRules.filter(r => r.isActive).length})
                </h3>
                {automationRules.filter(r => r.isActive).length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No active automation rules</p>
                      <p className="text-sm mt-1">Add a rule to automate shelter workflows</p>
                    </CardContent>
                  </Card>
                ) : (
                  automationRules.filter(r => r.isActive).map((rule) => (
                    <Card key={rule.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                              <Zap className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                              <p className="font-medium">{rule.name}</p>
                              <p className="text-sm text-muted-foreground">{rule.description}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                  {rule.triggerType}
                                </Badge>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                <Badge variant="outline" className="text-xs">
                                  {rule.actionType}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={(checked) => {
                              toggleRuleMutation.mutate({ ruleId: rule.id, enabled: checked });
                            }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Inactive Rules */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-muted-foreground">
                  <Pause className="w-4 h-4" />
                  Inactive Rules ({automationRules.filter(r => !r.isActive).length})
                </h3>
                {automationRules.filter(r => !r.isActive).map((rule) => (
                  <Card key={rule.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Zap className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={(checked) => {
                            toggleRuleMutation.mutate({ ruleId: rule.id, enabled: checked });
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Protocols Tab */}
          <TabsContent value="protocols" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PROTOCOL_TEMPLATES.map((protocol) => {
                const Icon = protocol.icon;
                return (
                  <Card key={protocol.id}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{protocol.name}</CardTitle>
                          <CardDescription>{protocol.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {protocol.steps.map((step, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {'week' in step ? `Week ${step.week}` : `Day ${step.day}`}
                                </Badge>
                                <span className="text-sm">{step.action}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setApplyProtocolId(protocol.id)}
                          data-testid={`apply-protocol-${protocol.id}`}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Apply Protocol
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Apply Protocol Dialog */}
            <Dialog open={!!applyProtocolId} onOpenChange={(open) => {
              if (!open) {
                setApplyProtocolId(null);
                setSelectedDogId(null);
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Apply Protocol to Pet</DialogTitle>
                  <DialogDescription>
                    Select a pet to apply the {PROTOCOL_TEMPLATES.find(p => p.id === applyProtocolId)?.name} protocol. 
                    This will create scheduled tasks for the protocol steps.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <ScrollArea className="h-64 border rounded-lg">
                    <div className="p-2 space-y-2">
                      {shelterDogs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Dog className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No pets available</p>
                        </div>
                      ) : (
                        shelterDogs.map((dog) => (
                          <div
                            key={dog.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                              selectedDogId === dog.id 
                                ? 'bg-primary/10 border border-primary' 
                                : 'hover:bg-muted border border-transparent'
                            }`}
                            onClick={() => setSelectedDogId(dog.id)}
                            data-testid={`select-dog-${dog.id}`}
                          >
                            <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                              {dog.photos?.[0] ? (
                                <img src={dog.photos[0]} alt={dog.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Dog className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{dog.name}</p>
                              {dog.breed && <p className="text-sm text-muted-foreground truncate">{dog.breed}</p>}
                            </div>
                            {selectedDogId === dog.id && (
                              <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2 justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setApplyProtocolId(null);
                        setSelectedDogId(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => {
                        if (applyProtocolId && selectedDogId) {
                          applyProtocolMutation.mutate({ protocolId: applyProtocolId, dogId: selectedDogId });
                        }
                      }}
                      disabled={!selectedDogId || applyProtocolMutation.isPending}
                      data-testid="confirm-apply-protocol"
                    >
                      {applyProtocolMutation.isPending ? "Applying..." : "Apply Protocol"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Medical Templates Tab */}
          <TabsContent value="templates" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {medicalTemplates.length === 0 ? (
                <Card className="col-span-full border-dashed">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Syringe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No medical templates yet</p>
                    <p className="text-sm mt-1">Create templates for common vaccines and treatments</p>
                    <Button variant="outline" className="mt-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Template
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                medicalTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">{template.category}</p>
                          {template.vaccineName && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              {template.vaccineName}
                            </Badge>
                          )}
                        </div>
                        <Button variant="ghost" size="icon">
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    
  );
}
