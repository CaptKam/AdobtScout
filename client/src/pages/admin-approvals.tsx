import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Building2, HeartHandshake, User, MapPin, Phone, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ShelterProfile {
  id: string;
  userId: string;
  organizationName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  ein: string;
  website?: string;
  approvalStatus: string;
  createdAt: Date;
}

interface FosterProfile {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  city?: string;
  state?: string;
  profileImage?: string;
  fosterApprovalStatus: string;
  fosterTimeCommitment?: string;
  fosterSizePreference?: string[];
  fosterSpecialNeedsWilling?: boolean;
  fosterEmergencyAvailability?: string;
  fosterPreviousExperience?: string;
  fosterCapacity?: number;
  createdAt: Date;
}

export default function AdminApprovals() {
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedItem, setSelectedItem] = useState<{ id: string; type: 'shelter' | 'foster' } | null>(null);

  const { data: pendingShelters = [], isLoading: loadingShelters } = useQuery<ShelterProfile[]>({
    queryKey: ['/api/admin/shelters/pending'],
  });

  const { data: pendingFosters = [], isLoading: loadingFosters } = useQuery<FosterProfile[]>({
    queryKey: ['/api/admin/fosters/pending'],
  });

  const approveShelterMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/shelters/${id}/approve`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/shelters/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/metrics'] });
      toast({
        title: "Shelter approved",
        description: "The shelter has been successfully approved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve shelter. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectShelterMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`/api/admin/shelters/${id}/reject`, 'PATCH', { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/shelters/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/metrics'] });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedItem(null);
      toast({
        title: "Shelter rejected",
        description: "The shelter has been rejected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject shelter. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveFosterMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/fosters/${id}/approve`, 'PATCH'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fosters/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/metrics'] });
      toast({
        title: "Foster approved",
        description: "The foster account has been successfully approved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve foster. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectFosterMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`/api/admin/fosters/${id}/reject`, 'PATCH', { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/fosters/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/metrics'] });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedItem(null);
      toast({
        title: "Foster rejected",
        description: "The foster account has been rejected.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reject foster. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReject = () => {
    if (!selectedItem || !rejectReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    if (selectedItem.type === 'shelter') {
      rejectShelterMutation.mutate({ id: selectedItem.id, reason: rejectReason });
    } else {
      rejectFosterMutation.mutate({ id: selectedItem.id, reason: rejectReason });
    }
  };

  const openRejectDialog = (id: string, type: 'shelter' | 'foster') => {
    setSelectedItem({ id, type });
    setRejectDialogOpen(true);
  };
  
  const formatTimeCommitment = (value?: string) => {
    const map: Record<string, string> = {
      'short_term': '2-4 weeks',
      'medium_term': '1-2 months',
      'long_term': '2+ months',
      'flexible': 'Flexible',
    };
    return map[value || ''] || value || 'Not specified';
  };

  const formatEmergencyAvailability = (value?: string) => {
    const map: Record<string, string> = {
      'same_day': 'Same day',
      'few_days': 'Few days notice',
      'week_notice': 'Week notice',
      'month_notice': 'Month notice',
    };
    return map[value || ''] || value || 'Not specified';
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-admin-approvals">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
        <p className="text-muted-foreground">
          Review and approve pending shelter registrations and foster accounts
        </p>
      </div>

      <Tabs defaultValue="shelters" className="w-full">
        <TabsList>
          <TabsTrigger value="shelters" data-testid="tab-shelters">
            <Building2 className="mr-2 h-4 w-4" />
            Shelters ({pendingShelters.length})
          </TabsTrigger>
          <TabsTrigger value="fosters" data-testid="tab-fosters">
            <HeartHandshake className="mr-2 h-4 w-4" />
            Foster Accounts ({pendingFosters.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shelters" className="space-y-4 mt-6">
          {loadingShelters ? (
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ) : pendingShelters.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No pending shelter approvals</p>
              </CardContent>
            </Card>
          ) : (
            pendingShelters.map((shelter) => (
              <Card key={shelter.id} data-testid={`card-shelter-${shelter.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{shelter.organizationName}</CardTitle>
                      <CardDescription>
                        {shelter.city}, {shelter.state} • Submitted {new Date(shelter.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      <Clock className="mr-1 h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Contact Name</p>
                      <p className="font-medium">{shelter.contactName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{shelter.email}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{shelter.phone}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">EIN</p>
                      <p className="font-medium">{shelter.ein}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Address</p>
                      <p className="font-medium">{shelter.address}, {shelter.city}, {shelter.state} {shelter.zipCode}</p>
                    </div>
                    {shelter.website && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Website</p>
                        <a href={shelter.website} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                          {shelter.website}
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => approveShelterMutation.mutate(shelter.id)}
                      disabled={approveShelterMutation.isPending}
                      data-testid={`button-approve-shelter-${shelter.id}`}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => openRejectDialog(shelter.id, 'shelter')}
                      disabled={rejectShelterMutation.isPending}
                      data-testid={`button-reject-shelter-${shelter.id}`}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="fosters" className="space-y-4 mt-6">
          {loadingFosters ? (
            <Card className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ) : pendingFosters.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No pending foster approvals</p>
              </CardContent>
            </Card>
          ) : (
            pendingFosters.map((foster) => (
              <Card key={foster.id} data-testid={`card-foster-${foster.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={foster.profileImage} alt={`${foster.firstName} ${foster.lastName}`} />
                        <AvatarFallback>
                          {(foster.firstName?.[0] || '') + (foster.lastName?.[0] || '')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle>{foster.firstName} {foster.lastName}</CardTitle>
                        <CardDescription>
                          {foster.city}, {foster.state} • Applied {new Date(foster.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      <Clock className="mr-1 h-3 w-3" />
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{foster.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{foster.phoneNumber || 'No phone'}</span>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Time Commitment</p>
                      <p className="font-medium">{formatTimeCommitment(foster.fosterTimeCommitment)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Emergency Availability</p>
                      <p className="font-medium">{formatEmergencyAvailability(foster.fosterEmergencyAvailability)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Capacity</p>
                      <p className="font-medium">{foster.fosterCapacity || 1} dog(s)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Special Needs</p>
                      <p className="font-medium">{foster.fosterSpecialNeedsWilling ? 'Willing' : 'Not willing'}</p>
                    </div>
                    {foster.fosterSizePreference && foster.fosterSizePreference.length > 0 && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Size Preference</p>
                        <div className="flex gap-1 mt-1">
                          {foster.fosterSizePreference.map((size) => (
                            <Badge key={size} variant="outline" className="capitalize">{size}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {foster.fosterPreviousExperience && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Previous Experience</p>
                        <p className="font-medium">{foster.fosterPreviousExperience}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => approveFosterMutation.mutate(foster.id)}
                      disabled={approveFosterMutation.isPending}
                      data-testid={`button-approve-foster-${foster.id}`}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => openRejectDialog(foster.id, 'foster')}
                      disabled={rejectFosterMutation.isPending}
                      data-testid={`button-reject-foster-${foster.id}`}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent data-testid="dialog-reject-reason">
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {selectedItem?.type === 'shelter' ? 'Shelter' : 'Foster Account'}</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for rejection. This will be sent to the applicant.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
            data-testid="input-reject-reason"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reject">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
