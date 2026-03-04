
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  Settings,
  Trash2,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { Plugin, PluginInstallation } from "@shared/schema";

export default function ShelterPlugins() {
  const { toast } = useToast();
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [configDialog, setConfigDialog] = useState(false);
  const [logsDialog, setLogsDialog] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [editingInstallationId, setEditingInstallationId] = useState<string | null>(null);

  // Fetch available plugins
  const { data: availablePlugins = [] } = useQuery<Plugin[]>({
    queryKey: ["/api/plugins"],
  });

  // Fetch installed plugins
  const { data: installedPlugins = [] } = useQuery<Array<PluginInstallation & { plugin: Plugin }>>({
    queryKey: ["/api/shelter/plugins"],
  });

  // Fetch webhook logs
  const { data: webhookLogs = [] } = useQuery({
    queryKey: ["/api/shelter/plugins", logsDialog, "logs"],
    enabled: !!logsDialog,
  });

  // Install plugin
  const installMutation = useMutation({
    mutationFn: async (pluginId: string) => {
      return apiRequest(`/api/shelter/plugins/install`, {
        method: "POST",
        body: JSON.stringify({ pluginId, config }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/plugins"] });
      toast({ title: "Plugin installed successfully" });
      setConfigDialog(false);
      setSelectedPlugin(null);
      setConfig({});
      setEditingInstallationId(null);
    },
  });

  // Update config
  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, config }: { id: string; config: Record<string, string> }) => {
      return apiRequest(`/api/shelter/plugins/${id}/config`, {
        method: "PUT",
        body: JSON.stringify({ config }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/plugins"] });
      toast({ title: "Configuration updated" });
      setConfigDialog(false);
      setSelectedPlugin(null);
      setConfig({});
      setEditingInstallationId(null);
    },
  });

  // Uninstall plugin
  const uninstallMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/shelter/plugins/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/plugins"] });
      toast({ title: "Plugin uninstalled" });
    },
  });

  const installedPluginIds = new Set(installedPlugins.map(i => i.pluginId));
  const availableToInstall = availablePlugins.filter(p => !installedPluginIds.has(p.id));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Plugins & Integrations</h1>
          <p className="text-muted-foreground">Connect external services to automate your workflow</p>
        </div>

        <Tabs defaultValue="installed">
          <TabsList>
            <TabsTrigger value="installed">Installed ({installedPlugins.length})</TabsTrigger>
            <TabsTrigger value="available">Available ({availableToInstall.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="installed" className="space-y-4 mt-6">
            {installedPlugins.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">No plugins installed yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {installedPlugins.map(installation => (
                  <Card key={installation.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {installation.plugin.iconUrl && (
                            <img src={installation.plugin.iconUrl} alt="" className="w-10 h-10 rounded" />
                          )}
                          <div>
                            <CardTitle className="text-lg">{installation.plugin.name}</CardTitle>
                            <CardDescription>{installation.plugin.description}</CardDescription>
                          </div>
                        </div>
                        <Badge variant={installation.isActive ? "default" : "secondary"}>
                          {installation.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Webhooks received:</span>
                        <span className="font-medium">{installation.totalWebhooksReceived}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Last activity:</span>
                        <span className="font-medium">
                          {installation.lastWebhookAt 
                            ? new Date(installation.lastWebhookAt).toLocaleDateString()
                            : "Never"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPlugin(installation.plugin);
                            setConfig(installation.config as Record<string, string>);
                            setEditingInstallationId(installation.id);
                            setConfigDialog(true);
                          }}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Configure
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsDialog(installation.id)}
                        >
                          <Activity className="w-4 h-4 mr-2" />
                          Logs
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => uninstallMutation.mutate(installation.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Uninstall
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="available" className="space-y-4 mt-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableToInstall.map(plugin => (
                <Card key={plugin.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      {plugin.iconUrl && (
                        <img src={plugin.iconUrl} alt="" className="w-10 h-10 rounded" />
                      )}
                      <div>
                        <CardTitle className="text-lg">{plugin.name}</CardTitle>
                        {plugin.isOfficial && (
                          <Badge variant="secondary" className="mt-1">Official</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{plugin.description}</p>
                    <Badge variant="outline">{plugin.category}</Badge>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setSelectedPlugin(plugin);
                        setConfig({});
                        setEditingInstallationId(null);
                        setConfigDialog(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Install
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Config Dialog */}
        <Dialog open={configDialog} onOpenChange={setConfigDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure {selectedPlugin?.name}</DialogTitle>
              <DialogDescription>{selectedPlugin?.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedPlugin?.configSchema && 
                Object.entries((selectedPlugin.configSchema as any).properties || {}).map(([key, schema]: [string, any]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{schema.description || key}</Label>
                    <Input
                      id={key}
                      type={key.includes('secret') || key.includes('token') ? 'password' : 'text'}
                      value={config[key] || ''}
                      onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      placeholder={schema.description}
                    />
                  </div>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigDialog(false)}>Cancel</Button>
              {editingInstallationId ? (
                <Button 
                  onClick={() => updateConfigMutation.mutate({ id: editingInstallationId, config })}
                  disabled={updateConfigMutation.isPending}
                >
                  Save Configuration
                </Button>
              ) : (
                <Button 
                  onClick={() => installMutation.mutate(selectedPlugin!.id)}
                  disabled={installMutation.isPending}
                >
                  Install Plugin
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Logs Dialog */}
        <Dialog open={!!logsDialog} onOpenChange={() => setLogsDialog(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Webhook Logs</DialogTitle>
              <DialogDescription>Recent webhook activity</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {webhookLogs.map((log: any) => (
                <div key={log.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {log.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="font-medium">{log.eventType}</span>
                      <Badge variant="outline">{log.direction}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {log.errorMessage && (
                    <p className="text-sm text-red-500">{log.errorMessage}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{log.processingTimeMs}ms</span>
                    {log.responseStatus && <span>HTTP {log.responseStatus}</span>}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}

