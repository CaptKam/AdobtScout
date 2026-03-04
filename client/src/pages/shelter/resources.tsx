import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  UtensilsCrossed,
  Syringe,
  Scissors,
  Cpu,
  GraduationCap,
  Brain,
  Package,
  AlertTriangle,
  HelpCircle,
  Globe,
  Clock,
  DollarSign,
  Phone,
  Mail,
} from "lucide-react";
import type { ShelterResource } from "@shared/schema";

const RESOURCE_TYPES = [
  { value: "food_pantry", label: "Pet Food Pantry", icon: UtensilsCrossed },
  { value: "vaccinations", label: "Vaccinations", icon: Syringe },
  { value: "spay_neuter", label: "Spay/Neuter Services", icon: Scissors },
  { value: "microchipping", label: "Microchipping", icon: Cpu },
  { value: "training", label: "Training Classes", icon: GraduationCap },
  { value: "behavior_support", label: "Behavior Support", icon: Brain },
  { value: "supplies", label: "Pet Supplies", icon: Package },
  { value: "emergency_shelter", label: "Emergency Shelter", icon: AlertTriangle },
  { value: "other", label: "Other", icon: HelpCircle },
];

const AVAILABILITY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "by_appointment", label: "By Appointment" },
  { value: "emergency_only", label: "Emergency Only" },
];

const COST_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "low_cost", label: "Low Cost" },
  { value: "sliding_scale", label: "Sliding Scale" },
  { value: "varies", label: "Varies" },
];

function getResourceIcon(type: string) {
  const resource = RESOURCE_TYPES.find((r) => r.value === type);
  return resource?.icon || HelpCircle;
}

function getResourceLabel(type: string) {
  const resource = RESOURCE_TYPES.find((r) => r.value === type);
  return resource?.label || type;
}

export default function ShelterResources() {
  const { toast } = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ShelterResource | null>(null);
  const [formData, setFormData] = useState({
    resourceType: "",
    title: "",
    description: "",
    availability: "",
    schedule: "",
    eligibilityNotes: "",
    cost: "",
    contactPhone: "",
    contactEmail: "",
    websiteUrl: "",
    isActive: true,
  });

  const { data: resources = [], isLoading } = useQuery<ShelterResource[]>({
    queryKey: ["/api/shelter/resources"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", "/api/shelter/resources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/resources"] });
      toast({ title: "Resource Added", description: "Community resource has been created." });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      apiRequest("PATCH", `/api/shelter/resources/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/resources"] });
      toast({ title: "Resource Updated", description: "Changes have been saved." });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/shelter/resources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/resources"] });
      toast({ title: "Resource Removed", description: "The resource has been deleted." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      resourceType: "",
      title: "",
      description: "",
      availability: "",
      schedule: "",
      eligibilityNotes: "",
      cost: "",
      contactPhone: "",
      contactEmail: "",
      websiteUrl: "",
      isActive: true,
    });
    setEditingResource(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (resource: ShelterResource) => {
    setEditingResource(resource);
    setFormData({
      resourceType: resource.resourceType,
      title: resource.title,
      description: resource.description || "",
      availability: resource.availability || "",
      schedule: resource.schedule || "",
      eligibilityNotes: resource.eligibilityNotes || "",
      cost: resource.cost || "",
      contactPhone: resource.contactPhone || "",
      contactEmail: resource.contactEmail || "",
      websiteUrl: resource.websiteUrl || "",
      isActive: resource.isActive ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.resourceType || !formData.title) {
      toast({ title: "Missing Fields", description: "Please fill in required fields.", variant: "destructive" });
      return;
    }

    if (editingResource) {
      updateMutation.mutate({ id: editingResource.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const activeResources = resources.filter((r) => r.isActive);
  const inactiveResources = resources.filter((r) => !r.isActive);

  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="page-shelter-resources">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Community Resources</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage services and resources you offer to pet owners in your community
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-resource">
            <Plus className="w-4 h-4 mr-2" />
            Add Resource
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-green-500" />
                <span className="text-2xl font-bold">{activeResources.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">Active Resources</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-2xl font-bold">{inactiveResources.length}</span>
              </div>
              <p className="text-xs text-muted-foreground">Inactive Resources</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-500" />
                <span className="text-2xl font-bold">
                  {resources.filter((r) => r.cost === "free").length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Free Services</p>
            </CardContent>
          </Card>
        </div>

        {/* Resources List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading resources...</div>
        ) : resources.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Resources Yet</h3>
              <p className="text-muted-foreground mb-4">
                Add community resources that pet owners can access, like food pantry, vaccinations, and more.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Resource
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map((resource) => {
              const Icon = getResourceIcon(resource.resourceType);
              return (
                <Card key={resource.id} className={!resource.isActive ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base line-clamp-1">{resource.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {getResourceLabel(resource.resourceType)}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-resource-menu-${resource.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(resource)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => confirm({
                              title: "Delete Resource",
                              description: `Are you sure you want to delete "${resource.title}"? This action cannot be undone.`,
                              actionType: "delete",
                              confirmLabel: "Delete",
                              onConfirm: () => deleteMutation.mutate(resource.id),
                            })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {resource.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {resource.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {resource.cost && (
                        <Badge variant="secondary" className="capitalize">
                          {resource.cost.replace("_", " ")}
                        </Badge>
                      )}
                      {resource.availability && (
                        <Badge variant="outline" className="capitalize">
                          {resource.availability.replace("_", " ")}
                        </Badge>
                      )}
                      {!resource.isActive && (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </div>
                    {(resource.contactPhone || resource.contactEmail) && (
                      <div className="flex gap-3 text-xs text-muted-foreground pt-2 border-t">
                        {resource.contactPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {resource.contactPhone}
                          </span>
                        )}
                        {resource.contactEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {resource.contactEmail}
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingResource ? "Edit Resource" : "Add Community Resource"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resourceType">Resource Type *</Label>
                  <Select
                    value={formData.resourceType}
                    onValueChange={(v) => setFormData({ ...formData, resourceType: v })}
                  >
                    <SelectTrigger data-testid="select-resource-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Free Pet Food Distribution"
                    data-testid="input-resource-title"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this resource and how pet owners can access it..."
                  rows={3}
                  data-testid="input-resource-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="availability">Availability</Label>
                  <Select
                    value={formData.availability}
                    onValueChange={(v) => setFormData({ ...formData, availability: v })}
                  >
                    <SelectTrigger data-testid="select-availability">
                      <SelectValue placeholder="Select availability" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABILITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost</Label>
                  <Select
                    value={formData.cost}
                    onValueChange={(v) => setFormData({ ...formData, cost: v })}
                  >
                    <SelectTrigger data-testid="select-cost">
                      <SelectValue placeholder="Select cost" />
                    </SelectTrigger>
                    <SelectContent>
                      {COST_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule">Schedule / Hours</Label>
                <Input
                  id="schedule"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder="e.g., Tuesdays and Thursdays, 10am-2pm"
                  data-testid="input-schedule"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eligibilityNotes">Eligibility Requirements</Label>
                <Textarea
                  id="eligibilityNotes"
                  value={formData.eligibilityNotes}
                  onChange={(e) => setFormData({ ...formData, eligibilityNotes: e.target.value })}
                  placeholder="Any income, location, or other requirements..."
                  rows={2}
                  data-testid="input-eligibility"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-contact-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="resources@shelter.org"
                    data-testid="input-contact-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://..."
                  data-testid="input-website"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <Label htmlFor="isActive" className="font-medium">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Show this resource on your public profile
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  data-testid="switch-is-active"
                />
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-resource"
              >
                {editingResource ? "Save Changes" : "Add Resource"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <ConfirmDialog {...dialogProps} />
      </div>
  );
}
