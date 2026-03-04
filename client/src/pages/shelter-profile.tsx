import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  Home,
  Heart,
  UtensilsCrossed,
  Syringe,
  Scissors,
  Cpu,
  GraduationCap,
  Brain,
  Package,
  AlertTriangle,
  HelpCircle,
  Clock,
  DollarSign,
  ExternalLink,
  HandHelping,
  Globe,
  PawPrint,
  Users,
  Calendar,
  ChevronRight,
} from "lucide-react";
import type { ShelterProfile, Dog, ShelterResource } from "@shared/schema";
import { Progress } from "@/components/ui/progress";

const RESOURCE_ICONS: Record<string, typeof UtensilsCrossed> = {
  food_pantry: UtensilsCrossed,
  vaccinations: Syringe,
  spay_neuter: Scissors,
  microchipping: Cpu,
  training: GraduationCap,
  behavior_support: Brain,
  supplies: Package,
  emergency_shelter: AlertTriangle,
  other: HelpCircle,
};

function getResourceIcon(type: string) {
  return RESOURCE_ICONS[type] || HelpCircle;
}

export default function ShelterProfile() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: shelter, isLoading: shelterLoading } = useQuery<ShelterProfile>({
    queryKey: [`/api/shelters/${params.id}`],
  });

  const { data: dogs, isLoading: dogsLoading } = useQuery<Dog[]>({
    queryKey: [`/api/shelters/${params.id}/dogs`],
    enabled: !!shelter,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: resources = [] } = useQuery<ShelterResource[]>({
    queryKey: [`/api/shelters/${params.id}/resources`],
    enabled: !!shelter,
  });

  const { data: featureFlags } = useFeatureFlags();
  const donationsEnabled = featureFlags?.enabledFeatures?.includes('user_donations') ?? true;
  const resourcesEnabled = featureFlags?.enabledFeatures?.includes('user_resources') ?? true;

  const { data: donationInfo } = useQuery<{
    settings: { acceptsDonations: boolean; suggestedAmounts?: number[] };
    campaigns: Array<{
      id: string;
      title: string;
      description?: string;
      goalAmount: number;
      currentAmount: number;
      donorCount: number;
    }>;
  }>({
    queryKey: [`/api/donate/${shelter?.userId}`],
    enabled: !!shelter?.userId,
  });

  if (shelterLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-64 bg-muted animate-pulse" />
        <div className="max-w-6xl mx-auto px-4 -mt-16 relative z-10">
          <Skeleton className="h-32 w-32 rounded-2xl" />
          <Skeleton className="h-8 w-64 mt-4" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
      </div>
    );
  }

  if (!shelter) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Shelter not found</h2>
          <p className="text-muted-foreground mb-4">This shelter may no longer be available.</p>
          <div className="flex justify-center">
            <Button 
              onClick={() => setLocation("/map")} 
              data-testid="button-back-map"
              size="lg"
              className="text-lg px-8 relative z-10"
            >
              Back to Map
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Filter to only show dogs with photos that can be displayed
  const availableDogs = (dogs || []).filter(d => d.photos && d.photos.length > 0 && d.photos[0]);
  const urgentDogs = availableDogs.filter(d => (d as any).isUrgent);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Floating Back Button */}
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setLocation("/map")}
        className="fixed top-4 left-4 z-50 rounded-full shadow-lg bg-background/80 backdrop-blur-sm"
        data-testid="button-back-nav"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
      {/* Hero Section */}
      <div className="relative h-32 md:h-40 bg-gradient-to-br from-primary via-primary/80 to-primary/60 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yIDItNCAyLTRzMiAyIDIgNC0yIDQtMiA0LTItMi0yLTR6bS0xMiAwYzAtMiAyLTQgMi00czIgMiAyIDQtMiA0LTIgNC0yLTItMi00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
      </div>
      {/* Profile Card - Overlapping Hero */}
      <div className="max-w-6xl mx-auto px-4 -mt-20 relative z-10">
        <div className="bg-card rounded-2xl shadow-xl border p-6 md:p-8 pt-[24px] pb-[24px] pl-[29px] pr-[29px]">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Shelter Icon */}
            <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center flex-shrink-0 mx-auto md:mx-0">
              <Home className="w-10 h-10 md:w-14 md:h-14 text-primary-foreground" />
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
                <h1 className="text-2xl md:text-3xl font-bold">{shelter.shelterName}</h1>
                {shelter.isVerified && (
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 w-fit mx-auto md:mx-0">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>

              {shelter.description && (
                <p className="text-muted-foreground mb-4 max-w-2xl">
                  {shelter.description}
                </p>
              )}

              {/* Contact Info - Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <a 
                  href={`https://maps.google.com/?q=${encodeURIComponent(shelter.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover-elevate"
                >
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="truncate">{shelter.location}</span>
                </a>
                <a 
                  href={`tel:${shelter.phone}`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover-elevate"
                >
                  <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{shelter.phone}</span>
                </a>
                <a 
                  href={`mailto:${shelter.email}`}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover-elevate"
                >
                  <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="truncate">{shelter.email}</span>
                </a>
              </div>

              {shelter.licenseNumber && (
                <p className="text-xs text-muted-foreground mt-3">
                  License: {shelter.licenseNumber}
                </p>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className={`grid ${resourcesEnabled ? 'grid-cols-3' : 'grid-cols-2'} gap-4 mt-6 pt-6 border-t`}>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-primary">{availableDogs.length}</div>
              <div className="text-xs text-muted-foreground">Available Pets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-orange-500">{urgentDogs.length}</div>
              <div className="text-xs text-muted-foreground">Urgent Need</div>
            </div>
            {resourcesEnabled && (
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-green-500">{resources.length}</div>
                <div className="text-xs text-muted-foreground">Resources</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Action Buttons */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex flex-wrap gap-3">
          {donationsEnabled && donationInfo?.settings?.acceptsDonations && (
            <Button 
              onClick={() => setLocation(`/donate/${shelter.userId}`)}
              className="bg-pink-500 hover:bg-pink-600 flex-1 sm:flex-none"
              data-testid="button-donate"
            >
              <Heart className="w-4 h-4 mr-2" />
              Donate
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(shelter.location)}`, '_blank')}
            className="flex-1 sm:flex-none"
            data-testid="button-directions"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Get Directions
          </Button>
          <Button 
            variant="outline"
            onClick={() => window.location.href = `tel:${shelter.phone}`}
            className="flex-1 sm:flex-none"
            data-testid="button-call"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call
          </Button>
        </div>
      </div>
      {/* Tabbed Content */}
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <Tabs defaultValue="pets" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pets" className="gap-2">
              <PawPrint className="w-4 h-4" />
              <span className="hidden sm:inline">Pets</span>
              <Badge variant="secondary" className="ml-1 text-xs">{availableDogs.length}</Badge>
            </TabsTrigger>
            {resourcesEnabled && (
              <TabsTrigger value="resources" className="gap-2">
                <HandHelping className="w-4 h-4" />
                <span className="hidden sm:inline">Resources</span>
                {resources.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{resources.length}</Badge>
                )}
              </TabsTrigger>
            )}
            {donationsEnabled && donationInfo?.settings?.acceptsDonations && (
              <TabsTrigger value="support" className="gap-2">
                <Heart className="w-4 h-4" />
                <span className="hidden sm:inline">Support</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Pets Tab */}
          <TabsContent value="pets" className="mt-0">
            {dogsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
                ))}
              </div>
            ) : availableDogs.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {availableDogs.map((dog) => (
                  <Card
                    key={dog.id}
                    className="group overflow-hidden hover-elevate cursor-pointer border-0 shadow-md"
                    onClick={() => setLocation(`/dogs/${dog.id}`)}
                    data-testid={`card-dog-${dog.id}`}
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      <img
                        src={dog.photos[0]}
                        alt={dog.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {(dog as any).isUrgent && (
                        <Badge className="absolute top-2 left-2 bg-orange-500 text-white text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Urgent
                        </Badge>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base truncate">{dog.name}</h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {dog.breed}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {dog.age} {dog.age === 1 ? 'yr' : 'yrs'}
                        </Badge>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {dog.goodWithKids && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-300">Kids</span>
                        )}
                        {dog.goodWithDogs && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300">Dogs</span>
                        )}
                        {dog.goodWithCats && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300">Cats</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <PawPrint className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No pets available</h3>
                  <p className="text-muted-foreground text-sm">
                    This shelter doesn't have any pets listed at the moment. Check back soon!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Resources Tab */}
          {resourcesEnabled && (
            <TabsContent value="resources" className="mt-0">
              {resources.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {resources.map((resource) => {
                    const Icon = getResourceIcon(resource.resourceType);
                    return (
                      <Card key={resource.id} className="hover-elevate">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                              <Icon className="w-6 h-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold mb-1">{resource.title}</h3>
                              <Badge variant="secondary" className="text-xs capitalize mb-2">
                                {resource.resourceType.replace(/_/g, " ")}
                              </Badge>
                              
                              {resource.description && (
                                <p className="text-sm text-muted-foreground mb-3">
                                  {resource.description}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-2 mb-3">
                                {resource.cost && (
                                  <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-muted">
                                    <DollarSign className="w-3 h-3 mr-1" />
                                    {resource.cost.replace(/_/g, " ")}
                                  </span>
                                )}
                                {resource.availability && (
                                  <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-muted">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {resource.availability.replace(/_/g, " ")}
                                  </span>
                                )}
                              </div>

                              {resource.schedule && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                                  <Calendar className="w-3 h-3" />
                                  {resource.schedule}
                                </p>
                              )}

                              {resource.eligibilityNotes && (
                                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                                  {resource.eligibilityNotes}
                                </p>
                              )}

                              <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
                                {resource.contactPhone && (
                                  <a href={`tel:${resource.contactPhone}`} className="inline-flex items-center text-xs text-primary hover:underline">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {resource.contactPhone}
                                  </a>
                                )}
                                {resource.contactEmail && (
                                  <a href={`mailto:${resource.contactEmail}`} className="inline-flex items-center text-xs text-primary hover:underline">
                                    <Mail className="w-3 h-3 mr-1" />
                                    Email
                                  </a>
                                )}
                                {resource.websiteUrl && (
                                  <a href={resource.websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">
                                    <Globe className="w-3 h-3 mr-1" />
                                    Website
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <HandHelping className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No resources available</h3>
                    <p className="text-muted-foreground text-sm">
                      This shelter hasn't listed any community resources yet.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* Support Tab */}
          {donationsEnabled && donationInfo?.settings?.acceptsDonations && (
            <TabsContent value="support" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quick Donate */}
                <Card className="bg-gradient-to-br from-pink-500/10 to-orange-500/10 border-pink-500/20">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4">
                      <Heart className="w-6 h-6 text-pink-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Make a Donation</h3>
                    <p className="text-muted-foreground mb-6">
                      Your generosity helps us provide food, shelter, and medical care for pets waiting for their forever homes.
                    </p>
                    
                    {donationInfo.settings.suggestedAmounts && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {donationInfo.settings.suggestedAmounts.slice(0, 4).map((amount) => (
                          <Button
                            key={amount}
                            variant="outline"
                            size="sm"
                            className="border-pink-500/30 hover:bg-pink-500/10"
                            onClick={() => setLocation(`/donate/${shelter.userId}?amount=${amount}`)}
                          >
                            ${amount}
                          </Button>
                        ))}
                      </div>
                    )}

                    <Button 
                      onClick={() => setLocation(`/donate/${shelter.userId}`)}
                      className="w-full bg-pink-500 hover:bg-pink-600"
                      data-testid="button-donate-main"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      Donate Now
                    </Button>
                  </CardContent>
                </Card>

                {/* Active Campaigns */}
                {donationInfo.campaigns && donationInfo.campaigns.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Active Campaigns
                    </h4>
                    {donationInfo.campaigns.map((campaign) => {
                      const progress = campaign.goalAmount > 0 
                        ? Math.min(100, (campaign.currentAmount / campaign.goalAmount) * 100) 
                        : 0;
                      return (
                        <Card 
                          key={campaign.id} 
                          className="hover-elevate cursor-pointer" 
                          onClick={() => setLocation(`/donate/${shelter.userId}`)}
                        >
                          <CardContent className="p-4">
                            <h5 className="font-medium mb-1">{campaign.title}</h5>
                            {campaign.description && (
                              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                                {campaign.description}
                              </p>
                            )}
                            <Progress value={progress} className="h-2 mb-2" />
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-primary">
                                ${(campaign.currentAmount / 100).toLocaleString()} raised
                              </span>
                              <span className="text-muted-foreground">
                                of ${(campaign.goalAmount / 100).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {campaign.donorCount} {campaign.donorCount === 1 ? 'donor' : 'donors'}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
