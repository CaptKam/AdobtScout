import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Sparkles, 
  Compass, 
  MessageSquare, 
  Settings, 
  AlertTriangle,
  Brain,
  Map,
  Heart,
  HandHelping,
  Home,
  Phone,
  Camera,
  Type,
  FileText,
  Video,
  RefreshCw,
  Stethoscope,
  Building2,
  Users,
  Kanban,
  Layers,
  Zap,
  Pencil,
  Syringe,
  DollarSign,
  ClipboardList
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FeatureFlag } from "@shared/schema";

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Sparkles; description: string }> = {
  ai: {
    label: "AI Features",
    icon: Brain,
    description: "AI-powered capabilities for enhanced matching and assistance"
  },
  discovery: {
    label: "Discovery",
    icon: Compass,
    description: "Ways for adopters to find and explore available pets"
  },
  modes: {
    label: "User Modes",
    icon: Heart,
    description: "Different user experiences based on their intent"
  },
  communication: {
    label: "Communication",
    icon: MessageSquare,
    description: "Messaging and contact features"
  },
  operations: {
    label: "Operations",
    icon: Settings,
    description: "Platform operational features"
  },
  shelter_crm: {
    label: "Shelter CRM",
    icon: Building2,
    description: "Shelter management and CRM features for pet care organizations"
  },
  user_features: {
    label: "User Features",
    icon: Users,
    description: "Features visible to adopters and public users on shelter profiles"
  },
};

const FEATURE_ICONS: Record<string, typeof Sparkles> = {
  ai_breed_identification: Camera,
  ai_name_generation: Type,
  ai_form_assistance: FileText,
  ai_bio_enhancement: FileText,
  ai_health_screening: Stethoscope,
  foster_mode: HandHelping,
  rehome_mode: Home,
  urgency_system: AlertTriangle,
  phone_screening: Phone,
  virtual_tours: Video,
  // Shelter CRM feature icons
  shelter_ai_health_screening: Stethoscope,
  shelter_foster_management: Users,
  shelter_pipeline_view: Kanban,
  shelter_bulk_operations: Layers,
  shelter_intake_automation: Zap,
  shelter_ai_bio_generator: Pencil,
  shelter_phone_screening: Phone,
  shelter_medical_tracking: Syringe,
  shelter_donations: DollarSign,
  shelter_resources: HandHelping,
  shelter_application_builder: ClipboardList,
  // User features icons
  user_donations: DollarSign,
  user_resources: HandHelping,
};

export default function AdminFeatures() {
  const { toast } = useToast();

  const { data: flags, isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/admin/features'],
  });

  // Fetch health screening plugin status to hide related feature flags when plugin is disabled
  const { data: healthScreeningPluginStatus } = useQuery<{ pluginEnabled: boolean }>({
    queryKey: ['/api/admin/plugins/health-screening/status'],
  });

  // Fetch automations plugin status to hide related feature flags when plugin is disabled
  const { data: automationsPluginStatus } = useQuery<{ pluginEnabled: boolean }>({
    queryKey: ['/api/admin/plugins/automations/status'],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, isEnabled }: { key: string; isEnabled: boolean }) => {
      const response = await apiRequest("PUT", `/api/admin/features/${key}`, { isEnabled });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
      queryClient.invalidateQueries({ queryKey: ['/api/features'] });
      toast({
        title: data.isEnabled ? "Feature enabled" : "Feature disabled",
        description: `${data.label} has been ${data.isEnabled ? "enabled" : "disabled"}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update feature. Please try again.",
        variant: "destructive",
      });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/features/seed", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/features'] });
      queryClient.invalidateQueries({ queryKey: ['/api/features'] });
      toast({
        title: "Features initialized",
        description: "All feature flags have been seeded with defaults.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to seed features. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: string, isEnabled: boolean) => {
    updateMutation.mutate({ key, isEnabled });
  };

  // Filter out feature flags when their corresponding plugin is disabled
  const healthScreeningPluginEnabled = healthScreeningPluginStatus?.pluginEnabled ?? true;
  const automationsPluginEnabled = automationsPluginStatus?.pluginEnabled ?? true;
  const HEALTH_SCREENING_FLAG_KEYS = ['ai_health_screening', 'shelter_ai_health_screening'];
  const AUTOMATIONS_FLAG_KEYS = ['automations_engine'];
  
  const filteredFlags = flags?.filter(flag => {
    // Hide health screening flags when the plugin is disabled
    if (!healthScreeningPluginEnabled && HEALTH_SCREENING_FLAG_KEYS.includes(flag.key)) {
      return false;
    }
    // Hide automations flags when the plugin is disabled
    if (!automationsPluginEnabled && AUTOMATIONS_FLAG_KEYS.includes(flag.key)) {
      return false;
    }
    return true;
  });

  const groupedFlags = filteredFlags?.reduce((acc, flag) => {
    const category = flag.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>) || {};

  const enabledCount = filteredFlags?.filter(f => f.isEnabled).length || 0;
  const totalCount = filteredFlags?.length || 0;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-features">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Settings className="h-6 w-6" />
            Feature Flags
          </h1>
          <p className="text-muted-foreground">
            Control platform features and capabilities. Changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm" data-testid="badge-feature-count">
            {enabledCount} / {totalCount} enabled
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            data-testid="button-seed-features"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${seedMutation.isPending ? 'animate-spin' : ''}`} />
            Initialize Defaults
          </Button>
        </div>
      </div>

      {totalCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Feature Flags Found</h3>
            <p className="text-muted-foreground mb-4">
              Click "Initialize Defaults" to set up the platform feature flags.
            </p>
            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${seedMutation.isPending ? 'animate-spin' : ''}`} />
              Initialize Feature Flags
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {Object.entries(CATEGORY_CONFIG).map(([categoryKey, config]) => {
            const categoryFlags = groupedFlags[categoryKey] || [];
            if (categoryFlags.length === 0) return null;

            const CategoryIcon = config.icon;
            const enabledInCategory = categoryFlags.filter(f => f.isEnabled).length;

            return (
              <Card key={categoryKey} data-testid={`card-category-${categoryKey}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <CategoryIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{config.label}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant={enabledInCategory === categoryFlags.length ? "default" : "secondary"}>
                      {enabledInCategory}/{categoryFlags.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {categoryFlags.map((flag, index) => {
                      const FeatureIcon = FEATURE_ICONS[flag.key] || Settings;
                      return (
                        <div key={flag.key}>
                          {index > 0 && <Separator className="my-3" />}
                          <div 
                            className="flex items-center justify-between py-2"
                            data-testid={`row-feature-${flag.key}`}
                          >
                            <div className="flex items-center gap-3">
                              <FeatureIcon className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <Label 
                                  htmlFor={flag.key} 
                                  className="font-medium cursor-pointer"
                                  data-testid={`label-feature-${flag.key}`}
                                >
                                  {flag.label}
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  {flag.description}
                                </p>
                              </div>
                            </div>
                            <Switch
                              id={flag.key}
                              checked={flag.isEnabled}
                              onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                              disabled={updateMutation.isPending}
                              data-testid={`switch-feature-${flag.key}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
