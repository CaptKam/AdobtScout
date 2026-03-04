import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Puzzle, Trash2, Edit, Shield, Globe, Webhook, Settings, BarChart3, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Plugin } from "@shared/schema";

const PLUGIN_CATEGORIES = [
  { value: "payment", label: "Payment Processing" },
  { value: "background_check", label: "Background Checks" },
  { value: "communication", label: "Communication" },
  { value: "automation", label: "Automation" },
  { value: "crm", label: "CRM Integration" },
  { value: "analytics", label: "Analytics" },
  { value: "medical", label: "Medical/Vet" },
  { value: "other", label: "Other" },
];

const WEBHOOK_EVENTS = [
  "adoption.completed",
  "application.received",
  "application.approved",
  "application.rejected",
  "dog.created",
  "dog.updated",
  "intake.created",
  "foster.assigned",
  "medical.record.created",
];

interface PluginStats {
  totalInstallations: number;
  activeInstallations: number;
  totalWebhooksProcessed: number;
}

interface SystemPluginStatus {
  pluginEnabled: boolean;
  featureFlagEnabled: boolean;
  pluginName: string;
  description: string;
}

export default function AdminPlugins() {
  const { toast } = useToast();
  const [isNewPluginOpen, setIsNewPluginOpen] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    category: "automation",
    iconUrl: "",
    isOfficial: false,
    isPublic: true,
    isActive: true,
    webhookUrl: "",
    webhookEvents: [] as string[],
    supportsOAuth: false,
    oauthAuthUrl: "",
    oauthTokenUrl: "",
    configSchema: '{"type": "object", "properties": {}}',
    requiredScopes: [] as string[],
  });

  const { data: plugins, isLoading } = useQuery<Plugin[]>({
    queryKey: ['/api/admin/plugins'],
  });

  const { data: pluginStats } = useQuery<PluginStats>({
    queryKey: ['/api/admin/plugins', selectedPlugin?.id, 'stats'],
    enabled: !!selectedPlugin?.id,
  });

  // System plugins (code-based, not database-stored)
  const { data: healthScreeningStatus, isLoading: healthScreeningLoading } = useQuery<SystemPluginStatus>({
    queryKey: ['/api/admin/plugins/health-screening/status'],
  });

  const { data: automationsStatus, isLoading: automationsLoading } = useQuery<SystemPluginStatus>({
    queryKey: ['/api/admin/plugins/automations/status'],
  });

  const toggleAutomationsMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("POST", "/api/admin/plugins/automations/toggle", { enabled });
      return response.json();
    },
    onSuccess: (data: { pluginEnabled: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plugins/automations/status'] });
      toast({ 
        title: data.pluginEnabled ? "Plugin enabled" : "Plugin disabled", 
        description: `Automations plugin has been ${data.pluginEnabled ? 'enabled' : 'disabled'}.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle automations plugin.", variant: "destructive" });
    },
  });

  const toggleHealthScreeningMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("POST", "/api/admin/plugins/health-screening/toggle", { enabled });
      return response.json();
    },
    onSuccess: (data: { pluginEnabled: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plugins/health-screening/status'] });
      toast({ 
        title: data.pluginEnabled ? "Plugin enabled" : "Plugin disabled", 
        description: `Health screening plugin has been ${data.pluginEnabled ? 'enabled' : 'disabled'}.` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle health screening plugin.", variant: "destructive" });
    },
  });

  const createPluginMutation = useMutation({
    mutationFn: async (data: Partial<Plugin>) => {
      const response = await apiRequest("POST", "/api/admin/plugins", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plugins'] });
      setIsNewPluginOpen(false);
      resetForm();
      toast({ title: "Plugin created", description: "The plugin has been added to the marketplace." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create plugin.", variant: "destructive" });
    },
  });

  const updatePluginMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Plugin> }) => {
      const response = await apiRequest("PATCH", `/api/admin/plugins/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plugins'] });
      setEditingPlugin(null);
      resetForm();
      toast({ title: "Plugin updated", description: "The plugin has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update plugin.", variant: "destructive" });
    },
  });

  const deletePluginMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/plugins/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plugins'] });
      setDeleteConfirm(null);
      if (selectedPlugin?.id === deleteConfirm) {
        setSelectedPlugin(null);
      }
      toast({ title: "Plugin deleted", description: "The plugin and all installations have been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete plugin.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      category: "automation",
      iconUrl: "",
      isOfficial: false,
      isPublic: true,
      isActive: true,
      webhookUrl: "",
      webhookEvents: [],
      supportsOAuth: false,
      oauthAuthUrl: "",
      oauthTokenUrl: "",
      configSchema: '{"type": "object", "properties": {}}',
      requiredScopes: [],
    });
  };

  const openEditDialog = (plugin: Plugin) => {
    setFormData({
      name: plugin.name,
      slug: plugin.slug,
      description: plugin.description,
      category: plugin.category,
      iconUrl: plugin.iconUrl || "",
      isOfficial: plugin.isOfficial,
      isPublic: plugin.isPublic ?? true,
      isActive: plugin.isActive ?? true,
      webhookUrl: plugin.webhookUrl || "",
      webhookEvents: plugin.webhookEvents || [],
      supportsOAuth: plugin.supportsOAuth,
      oauthAuthUrl: plugin.oauthAuthUrl || "",
      oauthTokenUrl: plugin.oauthTokenUrl || "",
      configSchema: JSON.stringify(plugin.configSchema || { type: "object", properties: {} }, null, 2),
      requiredScopes: plugin.requiredScopes || [],
    });
    setEditingPlugin(plugin);
  };

  const handleSubmit = () => {
    let configSchema;
    try {
      configSchema = JSON.parse(formData.configSchema);
    } catch {
      toast({ title: "Invalid JSON", description: "Config schema must be valid JSON.", variant: "destructive" });
      return;
    }

    const pluginData = {
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      category: formData.category,
      iconUrl: formData.iconUrl || null,
      isOfficial: formData.isOfficial,
      isPublic: formData.isPublic,
      isActive: formData.isActive,
      webhookUrl: formData.webhookUrl || null,
      webhookEvents: formData.webhookEvents,
      supportsOAuth: formData.supportsOAuth,
      oauthAuthUrl: formData.oauthAuthUrl || null,
      oauthTokenUrl: formData.oauthTokenUrl || null,
      configSchema,
      requiredScopes: formData.requiredScopes,
    };

    if (editingPlugin) {
      updatePluginMutation.mutate({ id: editingPlugin.id, data: pluginData });
    } else {
      createPluginMutation.mutate(pluginData);
    }
  };

  const toggleWebhookEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      webhookEvents: prev.webhookEvents.includes(event)
        ? prev.webhookEvents.filter(e => e !== event)
        : [...prev.webhookEvents, event],
    }));
  };

  const activePlugins = plugins?.filter(p => p.isActive) || [];
  const inactivePlugins = plugins?.filter(p => !p.isActive) || [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Plugin Marketplace Management</h1>
          <p className="text-muted-foreground">Manage plugins available for shelters to install</p>
        </div>
        <Button onClick={() => { resetForm(); setIsNewPluginOpen(true); }} data-testid="button-add-plugin">
          <Plus className="w-4 h-4 mr-2" />
          Add Plugin
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-plugins">{plugins?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-plugins">{activePlugins.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Official Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-official-plugins">
              {plugins?.filter(p => p.isOfficial).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive Plugins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground" data-testid="text-inactive-plugins">{inactivePlugins.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active">Active ({activePlugins.length})</TabsTrigger>
          <TabsTrigger value="inactive" data-testid="tab-inactive">Inactive ({inactivePlugins.length})</TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">System Plugins</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activePlugins.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Puzzle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active plugins. Add your first plugin to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePlugins.map(plugin => (
                <Card 
                  key={plugin.id} 
                  className={`cursor-pointer transition-all ${selectedPlugin?.id === plugin.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedPlugin(plugin)}
                  data-testid={`card-plugin-${plugin.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {plugin.iconUrl ? (
                          <img src={plugin.iconUrl} alt="" className="w-10 h-10 rounded" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Puzzle className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-lg">{plugin.name}</CardTitle>
                          <CardDescription className="text-xs">{plugin.slug}</CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {plugin.isOfficial && (
                          <Badge variant="default" className="gap-1">
                            <Shield className="w-3 h-3" />
                            Official
                          </Badge>
                        )}
                        {plugin.isPublic && (
                          <Badge variant="outline" className="gap-1">
                            <Globe className="w-3 h-3" />
                            Public
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">{plugin.description}</p>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant="secondary">{plugin.category}</Badge>
                      {plugin.webhookEvents && plugin.webhookEvents.length > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Webhook className="w-3 h-3" />
                          {plugin.webhookEvents.length} events
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); openEditDialog(plugin); }}
                        data-testid={`button-edit-plugin-${plugin.id}`}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(plugin.id); }}
                        data-testid={`button-delete-plugin-${plugin.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inactive">
          {inactivePlugins.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">No inactive plugins.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inactivePlugins.map(plugin => (
                <Card key={plugin.id} className="opacity-60" data-testid={`card-plugin-inactive-${plugin.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Puzzle className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{plugin.name}</CardTitle>
                          <CardDescription className="text-xs">{plugin.slug}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="secondary">Inactive</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-2">{plugin.description}</p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openEditDialog(plugin)}
                        data-testid={`button-edit-inactive-plugin-${plugin.id}`}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDeleteConfirm(plugin.id)}
                        data-testid={`button-delete-inactive-plugin-${plugin.id}`}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="system">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              System plugins are built-in features that can be enabled or disabled globally.
            </p>
            
            {(healthScreeningLoading || automationsLoading) ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card data-testid="card-system-plugin-health-screening">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <Settings className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            Health Screening
                          </CardTitle>
                          <CardDescription className="text-xs">{healthScreeningStatus?.pluginName || "health-screening"}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="default" className="gap-1">
                        <Shield className="w-3 h-3" />
                        System
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {healthScreeningStatus?.description || "AI-powered health screening for shelter dogs"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">medical</Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {healthScreeningStatus?.pluginEnabled ? "Enabled" : "Disabled"}
                        </span>
                        <Switch
                          checked={healthScreeningStatus?.pluginEnabled ?? false}
                          onCheckedChange={(checked) => toggleHealthScreeningMutation.mutate(checked)}
                          disabled={toggleHealthScreeningMutation.isPending}
                          data-testid="switch-health-screening-toggle"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-system-plugin-automations">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            Automations Engine
                          </CardTitle>
                          <CardDescription className="text-xs">{automationsStatus?.pluginName || "automations-engine"}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="default" className="gap-1">
                        <Shield className="w-3 h-3" />
                        System
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {automationsStatus?.description || "Rule-based task automation triggered by events"}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">automation</Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {automationsStatus?.pluginEnabled ? "Enabled" : "Disabled"}
                        </span>
                        <Switch
                          checked={automationsStatus?.pluginEnabled ?? false}
                          onCheckedChange={(checked) => toggleAutomationsMutation.mutate(checked)}
                          disabled={toggleAutomationsMutation.isPending}
                          data-testid="switch-automations-toggle"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {selectedPlugin && pluginStats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              {selectedPlugin.name} - Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{pluginStats.totalInstallations}</div>
                <div className="text-sm text-muted-foreground">Total Installations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{pluginStats.activeInstallations}</div>
                <div className="text-sm text-muted-foreground">Active Installations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{pluginStats.totalWebhooksProcessed}</div>
                <div className="text-sm text-muted-foreground">Webhooks Processed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isNewPluginOpen || !!editingPlugin} onOpenChange={(open) => {
        if (!open) {
          setIsNewPluginOpen(false);
          setEditingPlugin(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlugin ? 'Edit Plugin' : 'Add New Plugin'}</DialogTitle>
            <DialogDescription>
              {editingPlugin ? 'Update plugin settings and configuration.' : 'Create a new plugin for shelters to install.'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="basic" className="mt-4">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="oauth">OAuth</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plugin Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Stripe Payments"
                    data-testid="input-plugin-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (unique identifier)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                    placeholder="stripe_payments"
                    data-testid="input-plugin-slug"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Accept payments for adoption fees, donations, and more."
                  data-testid="input-plugin-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger data-testid="select-plugin-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLUGIN_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iconUrl">Icon URL (optional)</Label>
                  <Input
                    id="iconUrl"
                    value={formData.iconUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, iconUrl: e.target.value }))}
                    placeholder="https://example.com/icon.png"
                    data-testid="input-plugin-icon"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isOfficial"
                    checked={formData.isOfficial}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOfficial: checked }))}
                    data-testid="switch-plugin-official"
                  />
                  <Label htmlFor="isOfficial">Official Plugin</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isPublic"
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: checked }))}
                    data-testid="switch-plugin-public"
                  />
                  <Label htmlFor="isPublic">Public (visible to shelters)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                    data-testid="switch-plugin-active"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="configSchema">Configuration Schema (JSON)</Label>
                <Textarea
                  id="configSchema"
                  value={formData.configSchema}
                  onChange={(e) => setFormData(prev => ({ ...prev, configSchema: e.target.value }))}
                  className="font-mono text-sm min-h-[150px]"
                  placeholder='{"type": "object", "properties": {"api_key": {"type": "string", "description": "API Key"}}}'
                  data-testid="input-plugin-config-schema"
                />
              </div>
            </TabsContent>

            <TabsContent value="webhooks" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://api.example.com/webhooks/scout"
                  data-testid="input-plugin-webhook-url"
                />
              </div>

              <div className="space-y-2">
                <Label>Webhook Events</Label>
                <p className="text-sm text-muted-foreground mb-2">Select which events this plugin should receive</p>
                <div className="grid grid-cols-2 gap-2">
                  {WEBHOOK_EVENTS.map(event => (
                    <div key={event} className="flex items-center gap-2">
                      <Switch
                        id={`event-${event}`}
                        checked={formData.webhookEvents.includes(event)}
                        onCheckedChange={() => toggleWebhookEvent(event)}
                        data-testid={`switch-webhook-event-${event}`}
                      />
                      <Label htmlFor={`event-${event}`} className="text-sm font-mono">{event}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="oauth" className="space-y-4 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <Switch
                  id="supportsOAuth"
                  checked={formData.supportsOAuth}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, supportsOAuth: checked }))}
                  data-testid="switch-plugin-oauth"
                />
                <Label htmlFor="supportsOAuth">Supports OAuth Authentication</Label>
              </div>

              {formData.supportsOAuth && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="oauthAuthUrl">OAuth Authorization URL</Label>
                    <Input
                      id="oauthAuthUrl"
                      value={formData.oauthAuthUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, oauthAuthUrl: e.target.value }))}
                      placeholder="https://api.example.com/oauth/authorize"
                      data-testid="input-plugin-oauth-auth-url"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oauthTokenUrl">OAuth Token URL</Label>
                    <Input
                      id="oauthTokenUrl"
                      value={formData.oauthTokenUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, oauthTokenUrl: e.target.value }))}
                      placeholder="https://api.example.com/oauth/token"
                      data-testid="input-plugin-oauth-token-url"
                    />
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => { setIsNewPluginOpen(false); setEditingPlugin(null); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createPluginMutation.isPending || updatePluginMutation.isPending}
              data-testid="button-save-plugin"
            >
              {editingPlugin ? 'Update Plugin' : 'Create Plugin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plugin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the plugin and uninstall it from all shelters. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirm && deletePluginMutation.mutate(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Plugin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
