import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Plus, User as UserIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@shared/schema";

export default function OwnerDashboard() {
  const [, setLocation] = useLocation();

  // Check user role and redirect if not authorized
  const { data: currentUser, isLoading: userLoading } = useQuery<User | null>({
    queryKey: ["/api/me"],
  });

  // Fetch user profile to check mode for adopters and legacy owners
  const { data: userProfile, isLoading: profileLoading } = useQuery<{ mode?: 'adopt' | 'foster' | 'rehome' } | null>({
    queryKey: ["/api/profile"],
    enabled: !!currentUser && (currentUser.role === "adopter" || currentUser.role === "owner"),
  });

  useEffect(() => {
    if (!userLoading && !profileLoading && currentUser) {
      // Redirect users with wrong role to their appropriate home page
      if (currentUser.role === "shelter") {
        setLocation("/shelter/operations");
      } else if ((currentUser.role === "adopter" || currentUser.role === "owner") && userProfile?.mode !== "rehome") {
        // Adopters/owners not in rehome mode should go to discover
        setLocation("/discover");
      }
      // If adopter in rehome mode OR legacy owner role, continue rendering
    } else if (!userLoading && !currentUser) {
      // Not authenticated - redirect to home
      setLocation("/");
    }
  }, [currentUser, userLoading, profileLoading, userProfile, setLocation]);

  const isRehomer = (currentUser?.role === "adopter" && userProfile?.mode === "rehome") || currentUser?.role === "owner";
  
  const { data: dogs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/dogs/user"],
    enabled: !!currentUser && isRehomer, // Only fetch if authorized
  });

  const myDog = dogs[0]; // Rehomers typically have one dog

  // Show loading state while checking authorization
  if (userLoading || profileLoading) {
    return (
      <div className="h-full bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Don't render if unauthorized (will redirect)
  if (!currentUser || !isRehomer) {
    return null;
  }

  return (
    <div className="h-full bg-gradient-to-br from-primary/5 via-background to-accent/5 p-8 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-md">
              <UserIcon className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-serif text-3xl font-bold">Your Dog's Profile</h1>
              <p className="text-muted-foreground">Find the perfect home for your companion</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Profile Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Interested Adopters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Dog Profile</CardTitle>
              {!myDog && (
                <Link href="/dog-form">
                  <Button data-testid="button-add-dog-profile">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Profile
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : !myDog ? (
              <div className="text-center py-12">
                <Heart className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No profile created yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create a profile for your dog to start finding potential adopters
                </p>
                <Link href="/dog-form">
                  <Button variant="outline" data-testid="button-create-first-profile">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Dog Profile
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <Card className="overflow-hidden">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="aspect-square bg-muted relative">
                      <img
                        src={myDog.photos[0]}
                        alt={myDog.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-6">
                      <h2 className="font-serif text-3xl mb-2" data-testid="text-dog-name">
                        {myDog.name}
                      </h2>
                      <p className="text-lg text-muted-foreground mb-4">
                        {myDog.breed} • {myDog.age} {myDog.age === 1 ? 'year' : 'years'} • {myDog.weight} lbs
                      </p>
                      <p className="text-muted-foreground mb-6">
                        {myDog.bio}
                      </p>
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => setLocation(`/dog-form?edit=${myDog.id}`)}
                        >
                          Edit Profile
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => setLocation(`/dog/${myDog.id}`)}
                        >
                          View Public Profile
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
