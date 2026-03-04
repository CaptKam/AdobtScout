import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ShelterStaff } from "@shared/schema";
import {
  Plus,
  Search,
  Users,
  UserCog,
  Shield,
  MoreVertical,
  Edit,
  Trash2,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
} from "lucide-react";

const ROLE_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  owner: { label: "Owner", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", description: "Full ownership and control" },
  manager: { label: "Manager", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", description: "Full access to operations" },
  medical: { label: "Medical Staff", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", description: "Medical records & treatments" },
  behavior: { label: "Behavior Team", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", description: "Assessments & training" },
  kennel: { label: "Kennel Staff", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", description: "Daily care & feeding" },
  foster_coordinator: { label: "Foster Coordinator", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300", description: "Foster network management" },
  adoption_counselor: { label: "Adoption Counselor", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", description: "Applications & meet & greets" },
  volunteer: { label: "Volunteer", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", description: "Assigned tasks only" },
  staff: { label: "Staff", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", description: "General staff member" },
};

const DEFAULT_STAFF = {
  name: "",
  email: "",
  phone: "",
  role: "kennel",
  customTitle: "",
  canManageDogs: false,
  canManageTasks: true,
  canViewMedical: false,
  canEditMedical: false,
  canManageStaff: false,
  canViewReports: false,
  canManageCalendar: false,
  canManageApplications: false,
  canManageFosters: false,
  canViewBehavior: false,
  canEditBehavior: false,
  canViewInbox: false,
  canSendMessages: false,
  isActive: true,
};

export default function ShelterStaffPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ShelterStaff | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<ShelterStaff | null>(null);
  const [formData, setFormData] = useState(DEFAULT_STAFF);

  const { data: staff = [], isLoading } = useQuery<ShelterStaff[]>({
    queryKey: ["/api/shelter/staff"],
  });

  const createStaffMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/shelter/staff", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/staff"] });
      toast({ title: "Staff Added", description: "New staff member has been added." });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/shelter/staff/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/staff"] });
      toast({ title: "Staff Updated", description: "Staff member has been updated." });
      setEditingStaff(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/shelter/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/staff"] });
      toast({ title: "Staff Removed", description: "Staff member has been removed." });
      setDeleteDialogOpen(false);
      setStaffToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData(DEFAULT_STAFF);
  };

  const openEditDialog = (member: ShelterStaff) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      email: member.email || "",
      phone: member.phone || "",
      role: member.role,
      customTitle: member.customTitle || "",
      canManageDogs: member.canManageDogs,
      canManageTasks: member.canManageTasks,
      canViewMedical: member.canViewMedical,
      canEditMedical: member.canEditMedical,
      canManageStaff: member.canManageStaff,
      canViewReports: member.canViewReports,
      canManageCalendar: member.canManageCalendar,
      canManageApplications: member.canManageApplications,
      canManageFosters: member.canManageFosters,
      canViewBehavior: member.canViewBehavior,
      canEditBehavior: member.canEditBehavior,
      canViewInbox: member.canViewInbox,
      canSendMessages: member.canSendMessages,
      isActive: member.isActive,
    });
  };

  const handleSubmit = () => {
    if (editingStaff) {
      updateStaffMutation.mutate({ id: editingStaff.id, data: formData });
    } else {
      createStaffMutation.mutate(formData);
    }
  };

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const staffCounts = {
    total: staff.length,
    active: staff.filter((s) => s.isActive).length,
    managers: staff.filter((s) => s.role === "manager" || s.role === "owner").length,
    volunteers: staff.filter((s) => s.role === "volunteer").length,
  };

  const getRoleConfig = (role: string) => {
    return ROLE_CONFIG[role] || ROLE_CONFIG.staff;
  };

  return (
    
      <div className="p-4 md:p-6 space-y-6" data-testid="page-shelter-staff">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Staff</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage your shelter's team members</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-staff">
            <Plus className="w-4 h-4 mr-2" />
            Add Staff
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{staffCounts.total}</div>
              <div className="text-xs text-muted-foreground">Total Staff</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold text-green-600">{staffCounts.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <UserCog className="w-5 h-5 mx-auto mb-1 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">{staffCounts.managers}</div>
              <div className="text-xs text-muted-foreground">Managers</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-orange-600" />
              <div className="text-2xl font-bold text-orange-600">{staffCounts.volunteers}</div>
              <div className="text-xs text-muted-foreground">Volunteers</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-role-filter">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="medical">Medical Staff</SelectItem>
              <SelectItem value="behavior">Behavior Team</SelectItem>
              <SelectItem value="kennel">Kennel Staff</SelectItem>
              <SelectItem value="foster_coordinator">Foster Coordinator</SelectItem>
              <SelectItem value="adoption_counselor">Adoption Counselor</SelectItem>
              <SelectItem value="volunteer">Volunteer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-5 bg-muted rounded w-2/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredStaff.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Staff Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery || roleFilter !== "all"
                  ? "No staff match your current filters."
                  : "Add your first team member to get started."}
              </p>
              {!searchQuery && roleFilter === "all" && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Staff
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredStaff.map((member) => {
              const roleConfig = getRoleConfig(member.role);

              return (
                <Card
                  key={member.id}
                  className={`${!member.isActive ? "opacity-60" : ""}`}
                  data-testid={`card-staff-${member.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{member.name}</h3>
                          {!member.isActive && (
                            <Badge variant="outline" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge className={roleConfig.color}>
                            {roleConfig.label}
                          </Badge>
                          {member.customTitle && (
                            <span className="text-xs text-muted-foreground italic">{member.customTitle}</span>
                          )}
                        </div>
                        {member.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <Phone className="w-3 h-3" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`button-staff-menu-${member.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(member)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setStaffToDelete(member);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex flex-wrap gap-1">
                        {member.canManageDogs && (
                          <Badge variant="outline" className="text-xs">Pets</Badge>
                        )}
                        {member.canViewMedical && (
                          <Badge variant="outline" className="text-xs">Medical</Badge>
                        )}
                        {member.canManageApplications && (
                          <Badge variant="outline" className="text-xs">Apps</Badge>
                        )}
                        {member.canManageFosters && (
                          <Badge variant="outline" className="text-xs">Foster</Badge>
                        )}
                        {member.canViewInbox && (
                          <Badge variant="outline" className="text-xs">Inbox</Badge>
                        )}
                        {member.canManageStaff && (
                          <Badge variant="outline" className="text-xs border-primary text-primary">Admin</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog
          open={showAddDialog || editingStaff !== null}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddDialog(false);
              setEditingStaff(null);
              resetForm();
            }
          }}
        >
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
              <DialogDescription>
                {editingStaff ? "Update staff member details and permissions." : "Add a new team member to your shelter."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Full name"
                  data-testid="input-staff-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    data-testid="input-staff-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-staff-phone"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger data-testid="select-staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner - Full control</SelectItem>
                    <SelectItem value="manager">Manager - Full operations</SelectItem>
                    <SelectItem value="medical">Medical Staff - Health records</SelectItem>
                    <SelectItem value="behavior">Behavior Team - Assessments</SelectItem>
                    <SelectItem value="kennel">Kennel Staff - Daily care</SelectItem>
                    <SelectItem value="foster_coordinator">Foster Coordinator</SelectItem>
                    <SelectItem value="adoption_counselor">Adoption Counselor</SelectItem>
                    <SelectItem value="volunteer">Volunteer - Limited access</SelectItem>
                  </SelectContent>
                </Select>
                {formData.role && ROLE_CONFIG[formData.role] && (
                  <p className="text-xs text-muted-foreground">{ROLE_CONFIG[formData.role].description}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="customTitle">Custom Title (optional)</Label>
                <Input
                  id="customTitle"
                  value={formData.customTitle}
                  onChange={(e) => setFormData({ ...formData, customTitle: e.target.value })}
                  placeholder="e.g., Head Veterinarian, Weekend Lead"
                  data-testid="input-staff-custom-title"
                />
              </div>

              <div className="space-y-3 pt-2">
                <Label className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Permissions
                </Label>
                <p className="text-xs text-muted-foreground">Customize what this staff member can access. Role defaults are applied automatically.</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canManageDogs" className="font-normal text-sm">Manage Pets</Label>
                    <Switch
                      id="canManageDogs"
                      checked={formData.canManageDogs}
                      onCheckedChange={(checked) => setFormData({ ...formData, canManageDogs: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canManageTasks" className="font-normal text-sm">Manage Tasks</Label>
                    <Switch
                      id="canManageTasks"
                      checked={formData.canManageTasks}
                      onCheckedChange={(checked) => setFormData({ ...formData, canManageTasks: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canViewMedical" className="font-normal text-sm">View Medical</Label>
                    <Switch
                      id="canViewMedical"
                      checked={formData.canViewMedical}
                      onCheckedChange={(checked) => setFormData({ ...formData, canViewMedical: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canEditMedical" className="font-normal text-sm">Edit Medical</Label>
                    <Switch
                      id="canEditMedical"
                      checked={formData.canEditMedical}
                      onCheckedChange={(checked) => setFormData({ ...formData, canEditMedical: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canViewBehavior" className="font-normal text-sm">View Behavior</Label>
                    <Switch
                      id="canViewBehavior"
                      checked={formData.canViewBehavior}
                      onCheckedChange={(checked) => setFormData({ ...formData, canViewBehavior: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canEditBehavior" className="font-normal text-sm">Edit Behavior</Label>
                    <Switch
                      id="canEditBehavior"
                      checked={formData.canEditBehavior}
                      onCheckedChange={(checked) => setFormData({ ...formData, canEditBehavior: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canManageApplications" className="font-normal text-sm">Applications</Label>
                    <Switch
                      id="canManageApplications"
                      checked={formData.canManageApplications}
                      onCheckedChange={(checked) => setFormData({ ...formData, canManageApplications: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canManageCalendar" className="font-normal text-sm">Calendar</Label>
                    <Switch
                      id="canManageCalendar"
                      checked={formData.canManageCalendar}
                      onCheckedChange={(checked) => setFormData({ ...formData, canManageCalendar: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canManageFosters" className="font-normal text-sm">Fosters</Label>
                    <Switch
                      id="canManageFosters"
                      checked={formData.canManageFosters}
                      onCheckedChange={(checked) => setFormData({ ...formData, canManageFosters: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canViewInbox" className="font-normal text-sm">View Inbox</Label>
                    <Switch
                      id="canViewInbox"
                      checked={formData.canViewInbox}
                      onCheckedChange={(checked) => setFormData({ ...formData, canViewInbox: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canSendMessages" className="font-normal text-sm">Send Messages</Label>
                    <Switch
                      id="canSendMessages"
                      checked={formData.canSendMessages}
                      onCheckedChange={(checked) => setFormData({ ...formData, canSendMessages: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="canViewReports" className="font-normal text-sm">View Reports</Label>
                    <Switch
                      id="canViewReports"
                      checked={formData.canViewReports}
                      onCheckedChange={(checked) => setFormData({ ...formData, canViewReports: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 col-span-2 pt-2 border-t">
                    <Label htmlFor="canManageStaff" className="font-normal text-sm font-medium">Manage Staff (Admin)</Label>
                    <Switch
                      id="canManageStaff"
                      checked={formData.canManageStaff}
                      onCheckedChange={(checked) => setFormData({ ...formData, canManageStaff: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="isActive" className="font-normal">Active Status</Label>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setEditingStaff(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || createStaffMutation.isPending || updateStaffMutation.isPending}
                data-testid="button-submit-staff"
              >
                {createStaffMutation.isPending || updateStaffMutation.isPending
                  ? "Saving..."
                  : editingStaff
                  ? "Update Staff"
                  : "Add Staff"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {staffToDelete?.name} from your team?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => staffToDelete && deleteStaffMutation.mutate(staffToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    
  );
}
