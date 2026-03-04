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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, MapPin, Trash2, Edit, ExternalLink, Phone, Mail, Store, Globe } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Advertiser, AdvertiserLocation } from "@shared/schema";

export default function AdminMarketing() {
  const { toast } = useToast();
  const [selectedAdvertiser, setSelectedAdvertiser] = useState<Advertiser | null>(null);
  const [isNewAdvertiserOpen, setIsNewAdvertiserOpen] = useState(false);
  const [isNewLocationOpen, setIsNewLocationOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'advertiser' | 'location'; id: string } | null>(null);
  const [editingAdvertiser, setEditingAdvertiser] = useState<Advertiser | null>(null);
  const [editingLocation, setEditingLocation] = useState<AdvertiserLocation | null>(null);

  const { data: advertisers, isLoading } = useQuery<Advertiser[]>({
    queryKey: ['/api/admin/advertisers'],
  });

  const { data: locations } = useQuery<AdvertiserLocation[]>({
    queryKey: ['/api/admin/advertisers', selectedAdvertiser?.id, 'locations'],
    enabled: !!selectedAdvertiser?.id,
  });

  const createAdvertiserMutation = useMutation({
    mutationFn: async (data: Partial<Advertiser>) => {
      const response = await apiRequest("POST", "/api/admin/advertisers", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/advertisers'] });
      setIsNewAdvertiserOpen(false);
      toast({ title: "Partner added", description: "Marketing partner has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create partner.", variant: "destructive" });
    },
  });

  const updateAdvertiserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Advertiser> }) => {
      const response = await apiRequest("PUT", `/api/admin/advertisers/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/advertisers'] });
      setEditingAdvertiser(null);
      toast({ title: "Partner updated", description: "Marketing partner has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update partner.", variant: "destructive" });
    },
  });

  const deleteAdvertiserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/advertisers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/advertisers'] });
      if (selectedAdvertiser?.id === deleteConfirm?.id) {
        setSelectedAdvertiser(null);
      }
      setDeleteConfirm(null);
      toast({ title: "Partner deleted", description: "Marketing partner and all locations have been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete partner.", variant: "destructive" });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: async (data: Partial<AdvertiserLocation>) => {
      const response = await apiRequest("POST", `/api/admin/advertisers/${selectedAdvertiser?.id}/locations`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/advertisers', selectedAdvertiser?.id, 'locations'] });
      setIsNewLocationOpen(false);
      toast({ title: "Location added", description: "Store location has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create location.", variant: "destructive" });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AdvertiserLocation> }) => {
      const response = await apiRequest("PUT", `/api/admin/advertiser-locations/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/advertisers', selectedAdvertiser?.id, 'locations'] });
      setEditingLocation(null);
      toast({ title: "Location updated", description: "Store location has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update location.", variant: "destructive" });
    },
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/advertiser-locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/advertisers', selectedAdvertiser?.id, 'locations'] });
      setDeleteConfirm(null);
      toast({ title: "Location deleted", description: "Store location has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete location.", variant: "destructive" });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'expired': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'premium': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing Partners</h1>
          <p className="text-muted-foreground">Manage businesses that advertise on Scout</p>
        </div>
        <Dialog open={isNewAdvertiserOpen} onOpenChange={setIsNewAdvertiserOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-partner">
              <Plus className="w-4 h-4 mr-2" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <AdvertiserForm
              onSubmit={(data) => createAdvertiserMutation.mutate(data)}
              isLoading={createAdvertiserMutation.isPending}
              onCancel={() => setIsNewAdvertiserOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Partners</CardTitle>
              <CardDescription>Click a partner to manage locations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : advertisers?.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  No marketing partners yet
                </p>
              ) : (
                advertisers?.map((advertiser) => (
                  <div
                    key={advertiser.id}
                    onClick={() => setSelectedAdvertiser(advertiser)}
                    className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                      selectedAdvertiser?.id === advertiser.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-card hover:bg-accent/50 border-border'
                    }`}
                    data-testid={`card-partner-${advertiser.id}`}
                  >
                    <div className="flex items-start gap-3">
                      {advertiser.logoUrl ? (
                        <img src={advertiser.logoUrl} alt={advertiser.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{advertiser.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-xs ${getStatusColor(advertiser.status)}`}>
                            {advertiser.status}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${getTierColor(advertiser.tier)}`}>
                            {advertiser.tier}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedAdvertiser ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {selectedAdvertiser.logoUrl ? (
                      <img src={selectedAdvertiser.logoUrl} alt={selectedAdvertiser.name} className="w-12 h-12 rounded object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-primary/20 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <CardTitle>{selectedAdvertiser.name}</CardTitle>
                      <CardDescription>{selectedAdvertiser.description || 'No description'}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingAdvertiser(selectedAdvertiser)}
                      data-testid="button-edit-partner"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setDeleteConfirm({ type: 'advertiser', id: selectedAdvertiser.id })}
                      data-testid="button-delete-partner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="locations">
                  <TabsList>
                    <TabsTrigger value="locations">Store Locations</TabsTrigger>
                    <TabsTrigger value="details">Partner Details</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="locations" className="mt-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {locations?.length || 0} location{(locations?.length || 0) !== 1 ? 's' : ''}
                      </p>
                      <Dialog open={isNewLocationOpen} onOpenChange={setIsNewLocationOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-add-location">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Location
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <LocationForm
                            onSubmit={(data) => createLocationMutation.mutate(data)}
                            isLoading={createLocationMutation.isPending}
                            onCancel={() => setIsNewLocationOpen(false)}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    {locations?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No store locations yet</p>
                        <p className="text-sm">Add locations to show them on the map</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {locations?.map((location) => (
                          <div
                            key={location.id}
                            className="p-4 rounded-lg border bg-card"
                            data-testid={`card-location-${location.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center">
                                  <Store className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                  <p className="font-medium">{location.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {location.address}, {location.city}, {location.state} {location.zipCode}
                                  </p>
                                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                                    {location.phone && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {location.phone}
                                      </span>
                                    )}
                                    {location.latitude && location.longitude && (
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant={location.isActive ? "default" : "secondary"}>
                                      {location.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                    {location.isFeatured && (
                                      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                        Featured
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditingLocation(location)}
                                  data-testid={`button-edit-location-${location.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => setDeleteConfirm({ type: 'location', id: location.id })}
                                  data-testid={`button-delete-location-${location.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="details" className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Contact Name</Label>
                        <p className="font-medium">{selectedAdvertiser.contactName || 'Not set'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Contact Email</Label>
                        <p className="font-medium">{selectedAdvertiser.contactEmail || 'Not set'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Contact Phone</Label>
                        <p className="font-medium">{selectedAdvertiser.contactPhone || 'Not set'}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Website</Label>
                        {selectedAdvertiser.website ? (
                          <a href={selectedAdvertiser.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                            {selectedAdvertiser.website}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <p className="font-medium">Not set</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Contract Start</Label>
                        <p className="font-medium">
                          {selectedAdvertiser.contractStartDate 
                            ? new Date(selectedAdvertiser.contractStartDate).toLocaleDateString() 
                            : 'Not set'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Contract End</Label>
                        <p className="font-medium">
                          {selectedAdvertiser.contractEndDate 
                            ? new Date(selectedAdvertiser.contractEndDate).toLocaleDateString() 
                            : 'Not set'}
                        </p>
                      </div>
                      {selectedAdvertiser.notes && (
                        <div className="col-span-2">
                          <Label className="text-muted-foreground">Notes</Label>
                          <p className="font-medium whitespace-pre-wrap">{selectedAdvertiser.notes}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a partner</p>
                <p className="text-sm">Choose a marketing partner to view and manage their store locations</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={!!editingAdvertiser} onOpenChange={() => setEditingAdvertiser(null)}>
        <DialogContent className="max-w-lg">
          {editingAdvertiser && (
            <AdvertiserForm
              initialData={editingAdvertiser}
              onSubmit={(data) => updateAdvertiserMutation.mutate({ id: editingAdvertiser.id, data })}
              isLoading={updateAdvertiserMutation.isPending}
              onCancel={() => setEditingAdvertiser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
        <DialogContent className="max-w-lg">
          {editingLocation && (
            <LocationForm
              initialData={editingLocation}
              onSubmit={(data) => updateLocationMutation.mutate({ id: editingLocation.id, data })}
              isLoading={updateLocationMutation.isPending}
              onCancel={() => setEditingLocation(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === 'advertiser'
                ? 'This will permanently delete the marketing partner and all their store locations.'
                : 'This will permanently delete this store location.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm?.type === 'advertiser') {
                  deleteAdvertiserMutation.mutate(deleteConfirm.id);
                } else if (deleteConfirm?.type === 'location') {
                  deleteLocationMutation.mutate(deleteConfirm.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface AdvertiserFormProps {
  initialData?: Advertiser;
  onSubmit: (data: Partial<Advertiser>) => void;
  isLoading: boolean;
  onCancel: () => void;
}

function AdvertiserForm({ initialData, onSubmit, isLoading, onCancel }: AdvertiserFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    logoUrl: initialData?.logoUrl || '',
    website: initialData?.website || '',
    contactName: initialData?.contactName || '',
    contactEmail: initialData?.contactEmail || '',
    contactPhone: initialData?.contactPhone || '',
    status: initialData?.status || 'active',
    tier: initialData?.tier || 'basic',
    notes: initialData?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? 'Edit Partner' : 'Add Marketing Partner'}</DialogTitle>
        <DialogDescription>
          {initialData ? 'Update partner information' : 'Add a new business to advertise on Scout'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="name">Business Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="PetSmart"
            required
            data-testid="input-partner-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the business"
            data-testid="input-partner-description"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger data-testid="select-partner-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tier">Tier</Label>
            <Select value={formData.tier} onValueChange={(v) => setFormData({ ...formData, tier: v })}>
              <SelectTrigger data-testid="select-partner-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL</Label>
          <Input
            id="logoUrl"
            value={formData.logoUrl}
            onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
            placeholder="https://example.com/logo.png"
            data-testid="input-partner-logo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://example.com"
            data-testid="input-partner-website"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input
            id="contactName"
            value={formData.contactName}
            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            placeholder="John Smith"
            data-testid="input-partner-contact-name"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="john@example.com"
              data-testid="input-partner-contact-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              value={formData.contactPhone}
              onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              placeholder="(555) 123-4567"
              data-testid="input-partner-contact-phone"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Internal Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Notes about this partnership..."
            data-testid="input-partner-notes"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isLoading || !formData.name} data-testid="button-submit-partner">
          {isLoading ? 'Saving...' : initialData ? 'Save Changes' : 'Add Partner'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface LocationFormProps {
  initialData?: AdvertiserLocation;
  onSubmit: (data: Partial<AdvertiserLocation>) => void;
  isLoading: boolean;
  onCancel: () => void;
}

function LocationForm({ initialData, onSubmit, isLoading, onCancel }: LocationFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    zipCode: initialData?.zipCode || '',
    latitude: initialData?.latitude?.toString() || '',
    longitude: initialData?.longitude?.toString() || '',
    phone: initialData?.phone || '',
    hours: initialData?.hours || '',
    heroImageUrl: initialData?.heroImageUrl || '',
    isActive: initialData?.isActive ?? true,
    isFeatured: initialData?.isFeatured ?? false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
      longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{initialData ? 'Edit Location' : 'Add Store Location'}</DialogTitle>
        <DialogDescription>
          {initialData ? 'Update store location details' : 'Add a new store location to display on the map'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="locationName">Store Name *</Label>
          <Input
            id="locationName"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="PetSmart - Downtown Seattle"
            required
            data-testid="input-location-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address *</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="123 Main St"
            required
            data-testid="input-location-address"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Seattle"
              required
              data-testid="input-location-city"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State *</Label>
            <Input
              id="state"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="WA"
              required
              data-testid="input-location-state"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zipCode">Zip Code</Label>
            <Input
              id="zipCode"
              value={formData.zipCode}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              placeholder="98101"
              data-testid="input-location-zip"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              placeholder="47.6062"
              data-testid="input-location-latitude"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              placeholder="-122.3321"
              data-testid="input-location-longitude"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(555) 123-4567"
            data-testid="input-location-phone"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hours">Hours</Label>
          <Input
            id="hours"
            value={formData.hours}
            onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
            placeholder="Mon-Sat 9am-9pm, Sun 10am-6pm"
            data-testid="input-location-hours"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="heroImageUrl">Hero Image URL</Label>
          <Input
            id="heroImageUrl"
            value={formData.heroImageUrl}
            onChange={(e) => setFormData({ ...formData, heroImageUrl: e.target.value })}
            placeholder="https://example.com/store.jpg"
            data-testid="input-location-hero"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              data-testid="switch-location-active"
            />
            <Label htmlFor="isActive">Active (show on map)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="isFeatured"
              checked={formData.isFeatured}
              onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
              data-testid="switch-location-featured"
            />
            <Label htmlFor="isFeatured">Featured</Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button 
          type="submit" 
          disabled={isLoading || !formData.name || !formData.address || !formData.city || !formData.state} 
          data-testid="button-submit-location"
        >
          {isLoading ? 'Saving...' : initialData ? 'Save Changes' : 'Add Location'}
        </Button>
      </DialogFooter>
    </form>
  );
}
