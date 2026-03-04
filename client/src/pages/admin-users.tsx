import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Ban, 
  CheckCircle, 
  Search, 
  Users, 
  Eye, 
  User, 
  Shield, 
  PawPrint, 
  Home, 
  HeartHandshake,
  Loader2,
  XCircle,
  Cat,
  Dog as DogIcon,
  MapPin,
  Phone,
  Mail
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
}

interface UserProfile {
  id: string;
  userId: string;
  phoneNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  homeType?: string;
  hasYard?: boolean;
  activityLevel?: string;
  workSchedule?: string;
  familySize?: number;
  hasChildren?: boolean;
  childrenAges?: string[];
  hasOtherPets?: boolean;
  otherPetsType?: string;
  experienceLevel?: string;
  preferredSize?: string[];
  preferredAge?: string[];
  preferredEnergy?: string[];
  exerciseCommitment?: string;
  mode?: string;
  fosterTimeCommitment?: string;
  fosterEmergencyAvailability?: string;
  fosterSpecialNeedsWilling?: boolean;
  fosterPreviousExperience?: string;
  reasonForRehoming?: string;
  profileImage?: string;
}

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  age?: number;
  profileImage?: string;
}

interface HouseholdPet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  temperament?: string[] | string;
  photo?: string;
}

interface Verification {
  userId: string;
  idVerified?: boolean;
  addressVerified?: boolean;
  phoneVerified?: boolean;
  backgroundCheckStatus?: string;
}

interface UserDog {
  id: string;
  name: string;
  breed: string;
  age: number;
  ageCategory: string;
  size: string;
  photos: string[];
  approvalStatus: string;
  urgencyLevel: string;
  listingType: string;
  intakeRecord?: {
    pipelineStatus: string;
  } | null;
}

interface UserDetails extends User {
  userProfile?: UserProfile;
  familyMembers?: FamilyMember[];
  householdPets?: HouseholdPet[];
  verification?: Verification;
  dogs?: UserDog[];
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  const { data: userDetails, isLoading: isLoadingDetails } = useQuery<UserDetails>({
    queryKey: ['/api/admin/users', selectedUserId],
    enabled: !!selectedUserId && profileDialogOpen,
    staleTime: 0,
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      apiRequest(`/api/admin/users/${userId}/status`, 'PATCH', { isActive }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/metrics'] });
      toast({
        title: variables.isActive ? "User activated" : "User suspended",
        description: variables.isActive 
          ? "The user account has been activated." 
          : "The user account has been suspended.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.firstName?.toLowerCase().includes(query) ||
      user.lastName?.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'shelter':
        return 'default';
      case 'adopter':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleViewProfile = (userId: string) => {
    setSelectedUserId(userId);
    setProfileDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-admin-users">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Search, view, and manage user accounts
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredUsers.length} of {users.length} users
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Users className="mx-auto h-12 w-12 mb-2 opacity-50" />
              <p>No users found matching your search</p>
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.email}
                      {user.isAdmin && (
                        <Badge variant="default" className="ml-2">Admin</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      {user.email}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </Badge>
                    {user.isActive ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        Suspended
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground flex-1">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewProfile(user.id)}
                      data-testid={`button-view-profile-${user.id}`}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Profile
                    </Button>
                    {user.isActive ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => toggleUserStatusMutation.mutate({ userId: user.id, isActive: false })}
                        disabled={toggleUserStatusMutation.isPending || user.isAdmin}
                        data-testid={`button-suspend-user-${user.id}`}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => toggleUserStatusMutation.mutate({ userId: user.id, isActive: true })}
                        disabled={toggleUserStatusMutation.isPending}
                        data-testid={`button-activate-user-${user.id}`}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
                {user.isAdmin && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Admin accounts cannot be suspended
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-user-profile">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Profile
            </DialogTitle>
            <DialogDescription>
              Complete profile information for {userDetails?.firstName} {userDetails?.lastName || userDetails?.email}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingDetails ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={userDetails.userProfile?.profileImage} />
                  <AvatarFallback className="text-lg bg-primary/10 text-primary">
                    {userDetails.firstName?.charAt(0) || userDetails.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    {userDetails.firstName && userDetails.lastName 
                      ? `${userDetails.firstName} ${userDetails.lastName}` 
                      : userDetails.email}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {userDetails.email}
                  </div>
                  {userDetails.userProfile?.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {userDetails.userProfile.phoneNumber}
                    </div>
                  )}
                  {userDetails.userProfile?.city && userDetails.userProfile?.state && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {userDetails.userProfile.city}, {userDetails.userProfile.state}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Badge variant={getRoleBadgeVariant(userDetails.role)}>
                    {userDetails.role.charAt(0).toUpperCase() + userDetails.role.slice(1)}
                  </Badge>
                  {userDetails.userProfile?.mode && (
                    <Badge variant="outline" className="capitalize">
                      {userDetails.userProfile.mode} Mode
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Lifestyle & Home
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Home Type</p>
                    <p className="font-medium capitalize">{userDetails.userProfile?.homeType || "Not set"}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Has Yard</p>
                    <p className="font-medium">{userDetails.userProfile?.hasYard ? "Yes" : "No"}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Activity Level</p>
                    <p className="font-medium capitalize">{userDetails.userProfile?.activityLevel?.replace('_', ' ') || "Not set"}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Work Schedule</p>
                    <p className="font-medium capitalize">{userDetails.userProfile?.workSchedule?.replace(/_/g, ' ') || "Not set"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Family & Experience
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Family Size</p>
                    <p className="font-medium">{userDetails.userProfile?.familySize || 1} {(userDetails.userProfile?.familySize || 1) === 1 ? 'person' : 'people'}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Has Children</p>
                    <p className="font-medium">{userDetails.userProfile?.hasChildren ? "Yes" : "No"}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Other Pets</p>
                    <p className="font-medium">{userDetails.userProfile?.hasOtherPets ? (userDetails.userProfile?.otherPetsType || "Yes") : "No"}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Experience</p>
                    <p className="font-medium capitalize">{userDetails.userProfile?.experienceLevel?.replace(/_/g, ' ') || "Not set"}</p>
                  </div>
                </div>
              </div>

              {(userDetails.userProfile?.preferredSize?.length || 
                userDetails.userProfile?.preferredAge?.length || 
                userDetails.userProfile?.preferredEnergy?.length) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Dog Preferences</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Preferred Size</p>
                        <p className="font-medium capitalize">
                          {userDetails.userProfile?.preferredSize?.length 
                            ? userDetails.userProfile.preferredSize.join(', ') 
                            : "Any"}
                        </p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Preferred Age</p>
                        <p className="font-medium capitalize">
                          {userDetails.userProfile?.preferredAge?.length 
                            ? userDetails.userProfile.preferredAge.join(', ') 
                            : "Any"}
                        </p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Energy Level</p>
                        <p className="font-medium capitalize">
                          {userDetails.userProfile?.preferredEnergy?.length 
                            ? userDetails.userProfile.preferredEnergy.map(e => e.replace('_', ' ')).join(', ') 
                            : "Any"}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Additional Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">Exercise Commitment</p>
                    <p className="font-medium capitalize">{userDetails.userProfile?.exerciseCommitment?.replace(/_/g, ' ') || "Not set"}</p>
                  </div>
                  {userDetails.userProfile?.hasChildren && userDetails.userProfile?.childrenAges?.length ? (
                    <div className="p-2 bg-muted/30 rounded">
                      <p className="text-xs text-muted-foreground">Children Ages</p>
                      <p className="font-medium capitalize">{userDetails.userProfile.childrenAges.join(', ')}</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {userDetails.verification && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Verification Status
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="p-2 bg-muted/30 rounded flex items-center gap-2">
                        {userDetails.verification.idVerified ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className={userDetails.verification.idVerified ? "font-medium" : "text-muted-foreground"}>
                          ID Verified
                        </span>
                      </div>
                      <div className="p-2 bg-muted/30 rounded flex items-center gap-2">
                        {userDetails.verification.addressVerified ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className={userDetails.verification.addressVerified ? "font-medium" : "text-muted-foreground"}>
                          Address Verified
                        </span>
                      </div>
                      <div className="p-2 bg-muted/30 rounded flex items-center gap-2">
                        {userDetails.verification.phoneVerified ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className={userDetails.verification.phoneVerified ? "font-medium" : "text-muted-foreground"}>
                          Phone Verified
                        </span>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Background Check</p>
                        <p className="font-medium capitalize">{userDetails.verification.backgroundCheckStatus || "Not started"}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {userDetails.familyMembers && userDetails.familyMembers.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Family Members ({userDetails.familyMembers.length})
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {userDetails.familyMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={member.profileImage} />
                            <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                              {member.name?.charAt(0)?.toUpperCase() || 'F'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {member.relationship}{member.age ? `, ${member.age}` : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {userDetails.householdPets && userDetails.householdPets.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <PawPrint className="h-4 w-4" />
                      Household Pets ({userDetails.householdPets.length})
                    </h4>
                    <div className="flex flex-wrap gap-3">
                      {userDetails.householdPets.map((pet) => (
                        <div key={pet.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={pet.photo} />
                            <AvatarFallback className="text-xs bg-amber-100 text-amber-700">
                              {pet.species === 'cat' ? <Cat className="w-4 h-4" /> : <DogIcon className="w-4 h-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm">
                            <p className="font-medium">{pet.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {pet.species}{pet.breed ? ` (${pet.breed})` : ''}{pet.age ? `, ${pet.age}y` : ''}
                            </p>
                            {pet.temperament && (
                              <p className="text-xs text-muted-foreground capitalize">
                                {Array.isArray(pet.temperament) ? pet.temperament.join(', ') : pet.temperament}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {userDetails.userProfile?.mode === 'foster' && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <HeartHandshake className="h-4 w-4" />
                      Foster Information
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Time Commitment</p>
                        <p className="font-medium capitalize">{userDetails.userProfile.fosterTimeCommitment?.replace(/_/g, ' ') || "Not set"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Emergency Availability</p>
                        <p className="font-medium capitalize">{userDetails.userProfile.fosterEmergencyAvailability?.replace(/_/g, ' ') || "Not set"}</p>
                      </div>
                      <div className="p-2 bg-muted/30 rounded">
                        <p className="text-xs text-muted-foreground">Special Needs Willing</p>
                        <p className="font-medium">{userDetails.userProfile.fosterSpecialNeedsWilling ? "Yes" : "No"}</p>
                      </div>
                      {userDetails.userProfile.fosterPreviousExperience && (
                        <div className="p-2 bg-muted/30 rounded col-span-2">
                          <p className="text-xs text-muted-foreground">Previous Experience</p>
                          <p className="font-medium">{userDetails.userProfile.fosterPreviousExperience}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {userDetails.userProfile?.mode === 'rehome' && userDetails.userProfile?.reasonForRehoming && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Rehoming Information
                    </h4>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Reason for Rehoming</p>
                      <p className="text-sm">{userDetails.userProfile.reasonForRehoming}</p>
                    </div>
                  </div>
                </>
              )}

              {userDetails.dogs && userDetails.dogs.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <DogIcon className="h-4 w-4" />
                      Listed Animals ({userDetails.dogs.length})
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {userDetails.dogs.map((dog) => (
                        <div key={dog.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                          <Avatar className="w-12 h-12 rounded-lg">
                            <AvatarImage src={dog.photos?.[0]} className="object-cover" />
                            <AvatarFallback className="text-xs bg-orange-100 text-orange-700 rounded-lg">
                              <DogIcon className="w-5 h-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{dog.name}</p>
                              {dog.urgencyLevel === 'urgent' && (
                                <Badge variant="destructive" className="text-xs">Urgent</Badge>
                              )}
                              {dog.urgencyLevel === 'critical' && (
                                <Badge variant="destructive" className="text-xs bg-red-600">Critical</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {dog.breed} · {dog.ageCategory} · {dog.size}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={dog.intakeRecord?.pipelineStatus === 'ready' ? 'default' : 'secondary'}
                                className="text-xs capitalize"
                              >
                                {dog.intakeRecord?.pipelineStatus?.replace(/_/g, ' ') || dog.approvalStatus}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {dog.listingType}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              <div className="text-sm text-muted-foreground">
                <p>Account created: {new Date(userDetails.createdAt).toLocaleDateString()}</p>
                <p>Status: {userDetails.isActive ? 'Active' : 'Suspended'}</p>
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              <p>Unable to load user details</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
