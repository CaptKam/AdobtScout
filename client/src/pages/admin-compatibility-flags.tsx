import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle, Clock, Eye, Flag, MessageSquare, User, Dog } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompatibilityFlag {
  id: number;
  userId: string;
  flagType: "yellow" | "red";
  category: string;
  title: string;
  description: string;
  triggerReason: string;
  relatedDogId: number | null;
  relatedBreed: string | null;
  status: "pending" | "reviewed" | "dismissed" | "action_taken";
  adminComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  userNotified: boolean;
  userNotificationMessage: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  dog?: {
    name: string;
    breed: string;
  };
}

interface FlagStats {
  total: number;
  pending: number;
  reviewed: number;
  dismissed: number;
  actionTaken: number;
  yellowFlags: number;
  redFlags: number;
}

export default function AdminCompatibilityFlags() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedFlag, setSelectedFlag] = useState<CompatibilityFlag | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const { data: flags, isLoading } = useQuery<CompatibilityFlag[]>({
    queryKey: ["/api/admin/compatibility-flags", statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("flagType", typeFilter);
      const response = await fetch(`/api/admin/compatibility-flags?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch flags");
      return response.json();
    },
  });

  const { data: stats } = useQuery<FlagStats>({
    queryKey: ["/api/admin/compatibility-flags/stats"],
  });

  const updateFlagMutation = useMutation({
    mutationFn: async ({ id, status, adminComment }: { id: number; status: string; adminComment: string }) => {
      return apiRequest("PATCH", `/api/admin/compatibility-flags/${id}`, {
        status,
        adminComment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === "/api/admin/compatibility-flags"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compatibility-flags/stats"] });
      setReviewDialogOpen(false);
      setSelectedFlag(null);
      setAdminComment("");
      setNewStatus("");
      toast({
        title: "Flag updated",
        description: "The compatibility flag has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update the flag. Please try again.",
        variant: "destructive",
      });
    },
  });

  const openReviewDialog = (flag: CompatibilityFlag) => {
    setSelectedFlag(flag);
    setAdminComment(flag.adminComment || "");
    setNewStatus(flag.status);
    setReviewDialogOpen(true);
  };

  const handleUpdateFlag = () => {
    if (!selectedFlag || !newStatus) return;
    updateFlagMutation.mutate({
      id: selectedFlag.id,
      status: newStatus,
      adminComment,
    });
  };

  const getFlagTypeColor = (flagType: string) => {
    return flagType === "red" 
      ? "bg-red-500/10 text-red-600 border-red-500/30" 
      : "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "reviewed":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><Eye className="w-3 h-3 mr-1" />Reviewed</Badge>;
      case "dismissed":
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/30"><CheckCircle className="w-3 h-3 mr-1" />Dismissed</Badge>;
      case "action_taken":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Action Taken</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid gap-6 md:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-20" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-admin-compatibility-flags">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compatibility Flags</h1>
          <p className="text-muted-foreground">
            Review profile compatibility issues and potential adoption concerns
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-stat-total">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total Flags</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-pending">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-red">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Critical (Red)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.redFlags || 0}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-yellow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Warning (Yellow)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.yellowFlags || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Flagged Profiles</CardTitle>
              <CardDescription>
                Users with potential compatibility concerns requiring review
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                  <SelectItem value="action_taken">Action Taken</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
                  <SelectValue placeholder="Flag Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="red">Red (Critical)</SelectItem>
                  <SelectItem value="yellow">Yellow (Warning)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!flags || flags.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No compatibility flags found</p>
              <p className="text-sm">Flags will appear here when potential adoption concerns are detected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flags.map((flag) => (
                <div
                  key={flag.id}
                  className="border rounded-lg p-4 hover-elevate"
                  data-testid={`flag-card-${flag.id}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={getFlagTypeColor(flag.flagType)}>
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {flag.flagType === "red" ? "Critical" : "Warning"}
                        </Badge>
                        {getStatusBadge(flag.status)}
                        <Badge variant="outline">{flag.category}</Badge>
                      </div>
                      <h3 className="font-semibold text-lg">{flag.title}</h3>
                      <p className="text-muted-foreground">{flag.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="w-4 h-4" />
                          <span>
                            {flag.user?.firstName && flag.user?.lastName
                              ? `${flag.user.firstName} ${flag.user.lastName}`
                              : flag.user?.email || "Unknown User"}
                          </span>
                        </div>
                        {flag.dog && (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Dog className="w-4 h-4" />
                            <span>{flag.dog.name} ({flag.dog.breed})</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Trigger: {flag.triggerReason}
                      </p>
                      {flag.adminComment && (
                        <div className="mt-2 p-2 bg-muted rounded-md">
                          <p className="text-sm flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{flag.adminComment}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => openReviewDialog(flag)}
                      data-testid={`button-review-${flag.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Compatibility Flag</DialogTitle>
            <DialogDescription>
              Update the status and add comments for this flag
            </DialogDescription>
          </DialogHeader>
          {selectedFlag && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={getFlagTypeColor(selectedFlag.flagType)}>
                    {selectedFlag.flagType === "red" ? "Critical" : "Warning"}
                  </Badge>
                  <span className="font-medium">{selectedFlag.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{selectedFlag.description}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-new-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                    <SelectItem value="action_taken">Action Taken</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Admin Comment</label>
                <Textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="Add notes about this flag and any actions taken..."
                  rows={4}
                  data-testid="textarea-admin-comment"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              data-testid="button-cancel-review"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateFlag}
              disabled={updateFlagMutation.isPending || !newStatus}
              data-testid="button-save-review"
            >
              {updateFlagMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
