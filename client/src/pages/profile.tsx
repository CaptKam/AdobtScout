import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSection } from "@/components/form-templates";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  User,
  Home,
  Heart,
  MapPin,
  Settings,
  LogOut,
  Search,
  PawPrint,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Phone,
  Shield,
  Sparkles,
  Calendar,
  Users,
  HeartHandshake,
  Dog,
  FileText,
  Zap,
  Target,
  Eye,
  MessageCircle,
  ArrowRight,
  CircleDot,
  Check,
  X,
  Edit3,
  Building2,
  TreePine,
  PlusCircle,
  ChevronDown,
} from "lucide-react";
import type { UserProfile, DogWithCompatibility, FamilyMember } from "@shared/schema";
import { useLocation } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdopterVerificationStatus } from "@/components/adopter-verification-status";
import { HouseholdPetsManager } from "@/components/household-pets-manager";
import { ModeSwitcher } from "@/components/mode-switcher";
import { useRoleSwitch } from "@/lib/role-switch-engine";
import { FamilyMembersManager } from "@/components/family-members-manager";

export default function Profile() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { currentMode } = useRoleSwitch();
  const [searchRadius, setSearchRadius] = useState(25);
  const [citySearch, setCitySearch] = useState("");
  const [showFosterDialog, setShowFosterDialog] = useState(false);
  const [fosterPhoneNumber, setFosterPhoneNumber] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [withdrawJourneyId, setWithdrawJourneyId] = useState<string | null>(null);
  const [withdrawDogName, setWithdrawDogName] = useState<string>("");
  const [isChecklistExpanded, setIsChecklistExpanded] = useState(false);
  const [isVerificationExpanded, setIsVerificationExpanded] = useState(false);
  const [isSearchSettingsExpanded, setIsSearchSettingsExpanded] = useState(true);
  const [isHomeInfoExpanded, setIsHomeInfoExpanded] = useState(true);
  const [isFosterInfoExpanded, setIsFosterInfoExpanded] = useState(true);
  const [isRehomeInfoExpanded, setIsRehomeInfoExpanded] = useState(true);
  const [isPetDialogOpen, setIsPetDialogOpen] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState({
    phoneNumber: "",
    city: "",
    state: "",
    homeType: "",
    hasYard: false,
    hasOtherPets: false,
    hasChildren: false,
    childrenAges: [] as string[],
    familySize: 1,
    activityLevel: "",
    workSchedule: "",
    experienceLevel: "",
    reasonForRehoming: "",
    fosterTimeCommitment: "",
    fosterSpecialNeedsWilling: false,
    fosterEmergencyAvailability: "",
    fosterPreviousExperience: "",
  });

  // Check authentication status first
  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/me"],
    retry: false,
  });

  // Redirect shelters to their operations hub
  useEffect(() => {
    if (user && user.role === 'shelter') {
      setLocation('/shelter/operations');
    }
  }, [user, setLocation]);

  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
    enabled: !!user && (user.role === 'adopter' || user.role === 'owner'),
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      if (data && !data.mode) {
        return { ...data, mode: 'adopt' as const };
      }
      return data;
    },
  });

  const { data: likedDogs } = useQuery<DogWithCompatibility[]>({
    queryKey: ["/api/dogs/liked"],
    enabled: !!user,
  });

  const { data: adoptionJourneys } = useQuery<any[]>({
    queryKey: ["/api/my-adoption-journeys"],
    enabled: !!user,
  });

  const { data: verification } = useQuery<any>({
    queryKey: ["/api/adopter-verification"],
    enabled: !!user && profile?.mode !== 'rehome',
  });

  const { data: pets } = useQuery<any[]>({
    queryKey: ["/api/household-pets"],
    enabled: !!user,
  });

  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!user,
  });

  // Sync local searchRadius state with profile data
  useEffect(() => {
    if (profile?.searchRadius) {
      setSearchRadius(profile.searchRadius);
    }
  }, [profile?.searchRadius]);

  // Pre-populate profile data when editing
  useEffect(() => {
    if (profile && isEditingProfile) {
      setProfileData({
        phoneNumber: profile.phoneNumber || "",
        city: profile.city || "",
        state: profile.state || "",
        homeType: profile.homeType || "",
        hasYard: profile.hasYard || false,
        hasOtherPets: profile.hasOtherPets || false,
        hasChildren: profile.hasChildren || false,
        childrenAges: profile.childrenAges || [],
        familySize: profile.familySize || 1,
        activityLevel: profile.activityLevel || "",
        workSchedule: profile.workSchedule || "",
        experienceLevel: profile.experienceLevel || "",
        reasonForRehoming: profile.reasonForRehoming || "",
        fosterTimeCommitment: profile.fosterTimeCommitment || "",
        fosterSpecialNeedsWilling: profile.fosterSpecialNeedsWilling || false,
        fosterEmergencyAvailability: profile.fosterEmergencyAvailability || "",
        fosterPreviousExperience: profile.fosterPreviousExperience || "",
      });
    }
  }, [profile, isEditingProfile]);

  // Label mappings
  const labels = useMemo(() => ({
    homeType: {
      house: "House",
      apartment: "Apartment",
      condo: "Condo/Townhouse",
    },
    activity: {
      very_active: "Very Active",
      active: "Active",
      moderate: "Moderate",
      relaxed: "Relaxed",
    },
    work: {
      home_all_day: "Work from Home",
      hybrid: "Hybrid",
      office_full_time: "Full-time Office",
      varies: "Flexible Schedule",
    },
    experience: {
      first_time: "First Time Owner",
      some_experience: "Some Experience",
      experienced: "Experienced",
      very_experienced: "Very Experienced",
    },
    fosterTime: {
      short_term: "Short Term (2-4 weeks)",
      medium_term: "Medium Term (1-2 months)",
      long_term: "Long Term (2+ months)",
      flexible: "Flexible",
    },
    fosterEmergency: {
      same_day: "Same Day",
      few_days: "Within Few Days",
      week_notice: "Week's Notice",
      month_notice: "Month's Notice",
    },
    childrenAges: {
      infant: "Infant (0-1 year)",
      toddler: "Toddler (1-3 years)",
      child: "Child (4-12 years)",
      teen: "Teenager (13-17 years)",
    },
  }), []);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<typeof profileData>) => {
      await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setIsEditingProfile(false);
      setActiveSection(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update radius mutation
  const updateRadiusMutation = useMutation({
    mutationFn: async (radius: number) => {
      await apiRequest("PATCH", "/api/profile", { searchRadius: radius });
    },
    onSuccess: () => {
      toast({ title: "Search radius updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
    },
  });

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async () => {
      return new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      }).then(async (position) => {
        await apiRequest("PATCH", "/api/profile", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      });
    },
    onSuccess: () => {
      toast({ title: "Location updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
    },
  });

  // Geocode city mutation
  const geocodeMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`
      );
      const data = await response.json();
      if (data.length === 0) throw new Error("Location not found");
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    },
    onSuccess: async (coords) => {
      await apiRequest("PATCH", "/api/profile", {
        latitude: coords.lat,
        longitude: coords.lon,
      });
      toast({ title: "Location updated", description: `Set to ${citySearch}` });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
      setCitySearch("");
    },
    onError: () => {
      toast({ title: "Location not found", variant: "destructive" });
    },
  });

  // Withdraw from adoption journey mutation
  const withdrawJourneyMutation = useMutation({
    mutationFn: async (journeyId: string) => {
      await apiRequest("DELETE", `/api/adoption-journeys/${journeyId}`);
    },
    onSuccess: () => {
      toast({ 
        title: "Application withdrawn", 
        description: "You have successfully withdrawn your application." 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my-adoption-journeys"] });
      setWithdrawJourneyId(null);
      setWithdrawDogName("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to withdraw", 
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive" 
      });
    },
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.clear();
      window.location.href = "/";
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Calculate profile completeness with grouped tasks
  const getProfileCompleteness = () => {
    if (!profile) return { percent: 0, tasks: [], groups: [], completed: 0, total: 0 };
    
    type TaskItem = { 
      id: string; 
      label: string; 
      description: string;
      completed: boolean; 
      action?: () => void;
      icon: 'location' | 'shield' | 'home' | 'activity' | 'paw' | 'clock' | 'zap' | 'phone' | 'message';
    };
    
    type TaskGroup = {
      id: string;
      title: string;
      tasks: TaskItem[];
    };
    
    const groups: TaskGroup[] = [];
    const mode = profile.mode;

    // Common tasks for adopt/foster
    if (mode === 'adopt' || mode === 'foster') {
      groups.push({
        id: 'essentials',
        title: 'Essential Setup',
        tasks: [
          {
            id: 'location',
            label: 'Set your location',
            description: 'Help us find dogs near you',
            completed: !!(profile.latitude && profile.longitude && profile.latitude !== 0),
            action: () => {
              const locationSection = document.querySelector('[data-testid="button-use-gps"]');
              if (locationSection) {
                locationSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            },
            icon: 'location',
          },
          {
            id: 'verification',
            label: 'Verify your identity',
            description: 'Build trust with shelters',
            completed: verification?.idVerified || false,
            action: () => {
              setIsChecklistExpanded(true);
              setIsVerificationExpanded(!isVerificationExpanded);
            },
            icon: 'shield',
          },
        ],
      });
    }

    if (mode === 'adopt') {
      groups.push({
        id: 'lifestyle',
        title: 'Your Lifestyle',
        tasks: [
          {
            id: 'homeType',
            label: 'Living situation',
            description: 'House, apartment, or condo?',
            completed: !!profile.homeType,
            action: () => { setIsEditingProfile(true); setActiveSection('lifestyle'); },
            icon: 'home',
          },
          {
            id: 'activity',
            label: 'Activity level',
            description: 'How active is your lifestyle?',
            completed: !!profile.activityLevel,
            action: () => { setIsEditingProfile(true); setActiveSection('lifestyle'); },
            icon: 'activity',
          },
        ],
      });
      groups.push({
        id: 'preferences',
        title: 'Dog Preferences',
        tasks: [
          {
            id: 'preferences',
            label: 'Size & age preferences',
            description: 'What type of dog are you looking for?',
            completed: !!(profile.preferredSize?.length || profile.preferredAge?.length),
            action: () => setActiveSection('preferences'),
            icon: 'paw',
          },
        ],
      });
    }

    if (mode === 'foster') {
      groups.push({
        id: 'foster',
        title: 'Foster Details',
        tasks: [
          {
            id: 'fosterTime',
            label: 'Time commitment',
            description: 'How long can you foster?',
            completed: !!profile.fosterTimeCommitment,
            action: () => { setIsEditingProfile(true); setActiveSection('foster'); },
            icon: 'clock',
          },
          {
            id: 'fosterEmergency',
            label: 'Emergency availability',
            description: 'How quickly can you take in a dog?',
            completed: !!profile.fosterEmergencyAvailability,
            action: () => { setIsEditingProfile(true); setActiveSection('foster'); },
            icon: 'zap',
          },
        ],
      });
    }

    if (mode === 'rehome') {
      groups.push({
        id: 'contact',
        title: 'Contact Information',
        tasks: [
          {
            id: 'phone',
            label: 'Phone number',
            description: 'So adopters can reach you',
            completed: !!profile.phoneNumber,
            action: () => { setIsEditingProfile(true); setActiveSection('contact'); },
            icon: 'phone',
          },
          {
            id: 'reason',
            label: 'Rehoming reason',
            description: 'Help adopters understand your situation',
            completed: !!profile.reasonForRehoming,
            action: () => { setIsEditingProfile(true); setActiveSection('rehome'); },
            icon: 'message',
          },
        ],
      });
    }

    // Flatten tasks for counting
    const allTasks = groups.flatMap(g => g.tasks);
    const completed = allTasks.filter(t => t.completed).length;
    const total = allTasks.length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
    
    return { percent, tasks: allTasks, groups, completed, total };
  };

  const profileStatus = getProfileCompleteness();

  // Loading state
  if (userLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <User className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Sign In Required</h2>
              <p className="text-muted-foreground">Please sign in to view your profile</p>
            </div>
            <Button onClick={() => setLocation("/")} className="w-full" size="lg" data-testid="button-go-landing">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <PawPrint className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Complete Your Profile</h2>
              <p className="text-muted-foreground">Tell us about yourself to get started</p>
            </div>
            <Button onClick={() => setLocation("/onboarding")} className="w-full" size="lg" data-testid="button-start-onboarding">
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/5 to-muted/10 pb-24 overflow-x-hidden w-full">
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 space-y-3 sm:space-y-4 md:space-y-6 overflow-x-hidden">
        
        {/* ===== HERO SECTION ===== */}
        <Card className="overflow-hidden border-0 shadow-2xl w-full relative">
          {/* Warm gradient background with subtle pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-orange-100/50 to-amber-50/30 dark:from-primary/20 dark:via-orange-900/20 dark:to-amber-900/10" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(251,146,60,0.1),_transparent_50%)]" />
          
          <CardContent className="relative p-3 sm:p-5 md:p-6 lg:p-8 overflow-hidden">
            {/* Welcome Section with larger avatar */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-5 mb-4 sm:mb-6">
              {/* Large Avatar with decorative ring */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-orange-400 rounded-full blur-md opacity-30 scale-110" />
                <Avatar className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 ring-4 ring-white/80 dark:ring-background/80 shadow-xl flex-shrink-0">
                  <AvatarImage src={profile.profileImage || undefined} alt="Profile" loading="eager" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-orange-500 text-white text-xl sm:text-2xl md:text-3xl font-bold">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {verification?.idVerified && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-green-500 ring-2 ring-white dark:ring-background flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                )}
              </div>
              
              {/* Welcome text and badge */}
              <div className="flex-1 text-center sm:text-left space-y-1 sm:space-y-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">Welcome back</p>
                <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground truncate max-w-[200px] sm:max-w-none">
                  {user.email?.split('@')[0] || 'Your Profile'}
                </h1>
                <Badge 
                  className="capitalize text-[10px] sm:text-xs px-2.5 py-0.5 sm:px-3 sm:py-1"
                  style={{
                    backgroundColor: currentMode === 'adopt' 
                      ? 'hsl(var(--primary) / 0.15)' 
                      : currentMode === 'foster' 
                        ? 'hsl(var(--mode-foster) / 0.15)' 
                        : 'hsl(var(--mode-rehome) / 0.15)',
                    color: currentMode === 'adopt' 
                      ? 'hsl(var(--primary))' 
                      : currentMode === 'foster' 
                        ? 'hsl(var(--mode-foster))' 
                        : 'hsl(var(--mode-rehome))',
                    border: 'none'
                  }}
                >
                  {currentMode === 'adopt' ? (
                    <><Heart className="w-3 h-3 mr-1" /> Adopter</>
                  ) : currentMode === 'foster' ? (
                    <><Home className="w-3 h-3 mr-1" /> Foster</>
                  ) : (
                    <><HeartHandshake className="w-3 h-3 mr-1" /> Rehomer</>
                  )}
                </Badge>
              </div>
            </div>

            {/* Stats Row - Card-style with icons */}
            <div className="flex justify-center sm:justify-start gap-2 sm:gap-3 mb-4 sm:mb-5">
              {currentMode !== 'rehome' && (
                <>
                  <div className="flex items-center gap-1.5 sm:gap-2 bg-white/60 dark:bg-background/40 backdrop-blur-sm rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2 shadow-sm">
                    <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
                    <span className="text-sm sm:text-base font-bold text-foreground">{likedDogs?.length || 0}</span>
                    <span className="text-[9px] sm:text-xs text-muted-foreground">Saved</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 bg-white/60 dark:bg-background/40 backdrop-blur-sm rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2 shadow-sm">
                    <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                    <span className="text-sm sm:text-base font-bold text-foreground">{adoptionJourneys?.length || 0}</span>
                    <span className="text-[9px] sm:text-xs text-muted-foreground">Applied</span>
                  </div>
                </>
              )}
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white/60 dark:bg-background/40 backdrop-blur-sm rounded-full px-2.5 py-1.5 sm:px-4 sm:py-2 shadow-sm">
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                <span className="text-sm sm:text-base font-bold text-foreground">{searchRadius}</span>
                <span className="text-[9px] sm:text-xs text-muted-foreground">mi</span>
              </div>
            </div>

            {/* Household Section - Larger, more visible layout */}
            <div className="bg-white/60 dark:bg-background/40 backdrop-blur-sm rounded-2xl p-4 sm:p-5 space-y-4">
              <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Home className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                My Household
              </h3>

              {/* Two-row grid layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Family Row */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">Family</span>
                    <span className="text-xs text-blue-500/70 dark:text-blue-400/70">
                      ({1 + (familyMembers?.length || 0)} {1 + (familyMembers?.length || 0) === 1 ? 'person' : 'people'})
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* You - Primary user */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="relative">
                        <Avatar className="w-12 h-12 sm:w-14 sm:h-14 ring-2 ring-primary/50 shadow-lg">
                          <AvatarImage src={profile.profileImage || undefined} loading="lazy" />
                          <AvatarFallback className="bg-gradient-to-br from-primary/40 to-primary/20 text-primary text-base sm:text-lg font-bold">
                            {user.email?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-white dark:ring-background">
                          <User className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">You</span>
                    </div>

                    {/* Family Members */}
                    {familyMembers && familyMembers.length > 0 && (
                      familyMembers.slice(0, 3).map((member) => {
                        const isChild = member.relation === 'child' || member.ageGroup?.includes('child') || member.ageGroup?.includes('infant') || member.ageGroup?.includes('toddler');
                        return (
                          <div key={member.id} className="flex flex-col items-center gap-1">
                            <Avatar className="w-12 h-12 sm:w-14 sm:h-14 ring-2 shadow-lg" style={{
                              '--tw-ring-color': isChild ? 'rgb(168 85 247 / 0.5)' : 'rgb(59 130 246 / 0.5)'
                            } as React.CSSProperties}>
                              {member.photo && <AvatarImage src={member.photo} loading="lazy" />}
                              <AvatarFallback className="text-base sm:text-lg font-bold" style={{
                                background: isChild 
                                  ? 'linear-gradient(135deg, rgb(168 85 247 / 0.3), rgb(168 85 247 / 0.15))' 
                                  : 'linear-gradient(135deg, rgb(59 130 246 / 0.3), rgb(59 130 246 / 0.15))',
                                color: isChild ? 'rgb(147 51 234)' : 'rgb(37 99 235)'
                              }}>
                                {member.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[50px] sm:max-w-[60px]">{member.name.split(' ')[0]}</span>
                          </div>
                        );
                      })
                    )}

                    {/* +N more */}
                    {familyMembers && familyMembers.length > 3 && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-100 dark:bg-blue-800/40 flex items-center justify-center shadow-md">
                          <span className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-300">+{familyMembers.length - 3}</span>
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">more</span>
                      </div>
                    )}

                    {/* Add family member */}
                    <div className="flex flex-col items-center gap-1">
                      <button 
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-blue-300/50 dark:border-blue-600/30 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center justify-center transition-all"
                        onClick={() => { setIsEditingProfile(true); setActiveSection('family'); }}
                      >
                        <PlusCircle className="w-5 h-5 text-blue-400/60" />
                      </button>
                      <span className="text-[10px] sm:text-xs text-muted-foreground/70">Add</span>
                    </div>
                  </div>
                </div>

                {/* Pets Row */}
                <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Dog className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-300">Pets</span>
                    <span className="text-xs text-amber-500/70 dark:text-amber-400/70">
                      ({pets?.length || 0} {(pets?.length || 0) === 1 ? 'pet' : 'pets'})
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-wrap">
                    {pets && pets.length > 0 ? (
                      pets.slice(0, 3).map((pet) => (
                        <button 
                          key={pet.id} 
                          className="flex flex-col items-center gap-1 group"
                          onClick={() => {
                            setEditingPetId(pet.id);
                            setIsPetDialogOpen(true);
                          }}
                        >
                          <Avatar className="w-12 h-12 sm:w-14 sm:h-14 ring-2 ring-amber-400/50 shadow-lg group-hover:ring-amber-500 transition-all">
                            {pet.photo && <AvatarImage src={pet.photo} loading="lazy" />}
                            <AvatarFallback className="bg-gradient-to-br from-amber-200 to-orange-100 dark:from-amber-800/50 dark:to-orange-900/30">
                              <Dog className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[50px] sm:max-w-[60px]">{pet.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600/60 dark:text-amber-400/60">
                        <Dog className="w-5 h-5" />
                        <span className="text-xs sm:text-sm italic">No pets yet</span>
                      </div>
                    )}

                    {/* +N more pets */}
                    {pets && pets.length > 3 && (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center shadow-md">
                          <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-300">+{pets.length - 3}</span>
                        </div>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">more</span>
                      </div>
                    )}

                    {/* Add pet button */}
                    <div className="flex flex-col items-center gap-1">
                      <button 
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed border-amber-300/50 dark:border-amber-600/30 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center transition-all"
                        onClick={() => {
                          setEditingPetId(null);
                          setIsPetDialogOpen(true);
                        }}
                        data-testid="button-add-pet"
                      >
                        <PlusCircle className="w-5 h-5 text-amber-400/60" />
                      </button>
                      <span className="text-[10px] sm:text-xs text-muted-foreground/70">Add</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== PROFILE COMPLETION CHECKLIST (Collapsible) ===== */}
        {profileStatus.percent < 100 && (
          <Card className="shadow-lg overflow-hidden" data-testid="profile-completion-card">
            <button
              onClick={() => setIsChecklistExpanded(!isChecklistExpanded)}
              className="w-full text-left p-4 flex items-center gap-3 hover-elevate transition-colors"
              data-testid="button-toggle-checklist"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">Complete Your Profile</div>
                <div className="text-sm text-muted-foreground">
                  {profileStatus.total - profileStatus.completed} {profileStatus.total - profileStatus.completed === 1 ? 'task' : 'tasks'} remaining
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{profileStatus.percent}%</div>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isChecklistExpanded ? 'rotate-180' : ''}`} />
              </div>
            </button>
            
            {/* Progress bar always visible */}
            <div className="px-4 pb-3">
              <Progress value={profileStatus.percent} className="h-1.5" />
            </div>
            
            {/* Expandable tasks section */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isChecklistExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="border-t border-border/50">
                {profileStatus.groups.map((group, groupIndex) => {
                  const groupCompleted = group.tasks.filter(t => t.completed).length;
                  const groupTotal = group.tasks.length;
                  const isGroupComplete = groupCompleted === groupTotal;
                  
                  return (
                    <div 
                      key={group.id} 
                      className={`${groupIndex > 0 ? 'border-t border-border/50' : ''}`}
                    >
                      <div className="px-4 py-2 bg-muted/30 flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h4>
                        <Badge 
                          variant={isGroupComplete ? "default" : "secondary"} 
                          className={`text-xs ${isGroupComplete ? 'bg-green-500/90' : ''}`}
                        >
                          {groupCompleted}/{groupTotal}
                        </Badge>
                      </div>
                      <div className="divide-y divide-border/30">
                        {group.tasks.map((task) => {
                          const TaskIcon = {
                            location: MapPin,
                            shield: Shield,
                            home: Home,
                            activity: Zap,
                            paw: PawPrint,
                            clock: Clock,
                            zap: Zap,
                            phone: Phone,
                            message: MessageCircle,
                          }[task.icon];
                          
                          return (
                            <div key={task.id}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!task.completed && task.action) {
                                    task.action();
                                  }
                                }}
                                disabled={task.completed}
                                className={`flex items-center gap-3 px-4 py-3 w-full text-left transition-colors ${
                                  task.completed 
                                    ? 'bg-green-50/50 dark:bg-green-950/10 cursor-default' 
                                    : 'hover:bg-muted/50 cursor-pointer group'
                                }`}
                                data-testid={`task-${task.id}`}
                              >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                                  task.completed 
                                    ? 'bg-green-500/20' 
                                    : 'bg-primary/10 group-hover:bg-primary/20'
                                }`}>
                                  {task.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <TaskIcon className="w-4 h-4 text-primary" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-medium ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {task.label}
                                  </div>
                                </div>
                                {!task.completed && task.id !== 'verification' && (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                                )}
                                {task.id === 'verification' && (
                                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isVerificationExpanded ? 'rotate-180' : ''}`} />
                                )}
                              </button>
                              
                              {/* Inline verification content */}
                              {task.id === 'verification' && (
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isVerificationExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                  <div className="px-4 py-3 bg-muted/20 border-t border-border/30">
                                    <AdopterVerificationStatus embedded />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}

        {/* ===== MODE SWITCHER ===== */}
        <Card className="shadow-lg overflow-hidden w-full">
          <CardContent className="p-2 sm:p-4 overflow-hidden">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">Current Mode</h3>
                <ModeSwitcher variant="tabs" className="w-full" />
              </div>

              {/* Mode Description */}
              <div className="p-3 bg-muted/50 rounded-lg">
                {currentMode === 'adopt' && (
                  <p className="text-sm text-muted-foreground">
                    <Heart className="w-4 h-4 inline mr-1 text-primary" />
                    <strong className="text-foreground">Adoption Mode:</strong> Discover dogs available for permanent adoption. Swipe through compatible matches and apply to shelters.
                  </p>
                )}
                {currentMode === 'foster' && (
                  <p className="text-sm text-muted-foreground">
                    <Home className="w-4 h-4 inline mr-1 text-[hsl(var(--mode-foster))]" />
                    <strong className="text-foreground">Foster Mode:</strong> Find dogs needing temporary care from owners in transition. Offer your home and help dogs until they find permanent homes.
                  </p>
                )}
                {currentMode === 'rehome' && (
                  <p className="text-sm text-muted-foreground">
                    <HeartHandshake className="w-4 h-4 inline mr-1 text-[hsl(var(--mode-rehome))]" />
                    <strong className="text-foreground">Rehome Mode:</strong> List your dog and find foster volunteers or adopters. Connect with caring people who can provide temporary or permanent care.
                  </p>
                )}
              </div>
            </div>

            <Tabs value={currentMode} className="w-full">

              {/* ADOPT MODE CONTENT */}
              <TabsContent value="adopt" className="mt-6 space-y-4">
                {/* Search Settings - Collapsible */}
                <Card className="shadow-md overflow-hidden">
                  <button
                    onClick={() => setIsSearchSettingsExpanded(!isSearchSettingsExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    data-testid="button-toggle-search-settings"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Search className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-foreground">Search Settings</div>
                        <div className="text-sm text-muted-foreground">Location & search radius</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isSearchSettingsExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSearchSettingsExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 pb-4 pt-2 space-y-6 border-t">
                      {/* Location & Search */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          Location & Radius
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Current Location</div>
                            <div className="font-mono text-sm">
                              {profile.latitude && profile.longitude 
                                ? `${profile.latitude.toFixed(4)}°N, ${profile.longitude.toFixed(4)}°W`
                                : "Not set"}
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Search Radius</span>
                              <span className="font-bold text-primary">{searchRadius} miles</span>
                            </div>
                            <Slider
                              value={[searchRadius]}
                              onValueChange={(v) => setSearchRadius(v[0])}
                              min={5}
                              max={100}
                              step={5}
                              data-testid="slider-radius"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex gap-2 flex-1">
                            <Input
                              placeholder="Search city..."
                              value={citySearch}
                              onChange={(e) => setCitySearch(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && citySearch && geocodeMutation.mutate(citySearch)}
                              className="text-sm"
                              data-testid="input-city-search"
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => citySearch && geocodeMutation.mutate(citySearch)}
                              disabled={geocodeMutation.isPending}
                              data-testid="button-search-city"
                            >
                              <Search className="w-4 h-4" />
                            </Button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateLocationMutation.mutate()}
                            disabled={updateLocationMutation.isPending}
                            data-testid="button-use-gps"
                          >
                            <MapPin className="w-4 h-4 mr-2" />
                            Use GPS
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => updateRadiusMutation.mutate(searchRadius)}
                            disabled={updateRadiusMutation.isPending}
                            data-testid="button-update-radius"
                          >
                            Update
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* About Your Home - Collapsible */}
                <Card className="shadow-md overflow-hidden">
                  <button
                    onClick={() => setIsHomeInfoExpanded(!isHomeInfoExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    data-testid="button-toggle-home-info"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Home className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-foreground">About Your Home</div>
                        <div className="text-sm text-muted-foreground">Lifestyle & dog preferences</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isHomeInfoExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isHomeInfoExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 pb-4 pt-2 space-y-6 border-t">
                      {/* Lifestyle & Home Section */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <Home className="w-4 h-4" />
                            Lifestyle & Home
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setIsEditingProfile(true); setActiveSection('lifestyle'); }}
                            data-testid="button-edit-lifestyle"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Home Type</div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              {profile.homeType === 'house' && <Home className="w-3 h-3" />}
                              {profile.homeType === 'apartment' && <Building2 className="w-3 h-3" />}
                              {labels.homeType[profile.homeType as keyof typeof labels.homeType] || 'Not set'}
                            </div>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Yard</div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              <TreePine className="w-3 h-3" />
                              {profile.hasYard ? 'Yes' : 'No'}
                            </div>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Activity</div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              <Activity className="w-3 h-3" />
                              {labels.activity[profile.activityLevel as keyof typeof labels.activity] || 'Not set'}
                            </div>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">Work</div>
                            <div className="font-medium text-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {labels.work[profile.workSchedule as keyof typeof labels.work] || 'Not set'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Experience Level</div>
                          <div className="font-medium text-sm">
                            {labels.experience[profile.experienceLevel as keyof typeof labels.experience] || 'Not set'}
                          </div>
                        </div>
                      </div>

                      {/* Dog Preferences Section */}
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <Sparkles className="w-4 h-4" />
                          Dog Preferences
                        </div>
                        
                        <div className="grid sm:grid-cols-3 gap-4">
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-2">Preferred Size</div>
                            <div className="flex flex-wrap gap-1">
                              {profile.preferredSize?.length ? profile.preferredSize.map((size) => (
                                <Badge key={size} variant="secondary" className="capitalize text-xs">{size}</Badge>
                              )) : <span className="text-sm text-muted-foreground">Any</span>}
                            </div>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-2">Preferred Age</div>
                            <div className="flex flex-wrap gap-1">
                              {profile.preferredAge?.length ? profile.preferredAge.map((age) => (
                                <Badge key={age} variant="secondary" className="capitalize text-xs">{age}</Badge>
                              )) : <span className="text-sm text-muted-foreground">Any</span>}
                            </div>
                          </div>
                          <div className="p-3 bg-muted/30 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-2">Preferred Energy</div>
                            <div className="flex flex-wrap gap-1">
                              {profile.preferredEnergy?.length ? profile.preferredEnergy.map((energy) => (
                                <Badge key={energy} variant="secondary" className="capitalize text-xs">{energy.replace('_', ' ')}</Badge>
                              )) : <span className="text-sm text-muted-foreground">Any</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* FOSTER MODE CONTENT */}
              <TabsContent value="foster" className="mt-6 space-y-4">
                <Card className="shadow-md overflow-hidden">
                  <button
                    onClick={() => setIsFosterInfoExpanded(!isFosterInfoExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    data-testid="button-toggle-foster-info"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[hsl(var(--mode-foster)/0.1)] flex items-center justify-center">
                        <HeartHandshake className="w-5 h-5 text-[hsl(var(--mode-foster))]" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-foreground">Foster Parent Profile</div>
                        <div className="text-sm text-muted-foreground">Availability & preferences</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isFosterInfoExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isFosterInfoExpanded ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 pb-4 pt-2 space-y-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        As a foster parent, you provide temporary care for dogs while they wait for their forever homes.
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Time Commitment</div>
                          <div className="font-medium text-sm">
                            {labels.fosterTime[profile.fosterTimeCommitment as keyof typeof labels.fosterTime] || 'Not set'}
                          </div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Emergency</div>
                          <div className="font-medium text-sm">
                            {labels.fosterEmergency[profile.fosterEmergencyAvailability as keyof typeof labels.fosterEmergency] || 'Not set'}
                          </div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Special Needs</div>
                          <div className="font-medium text-sm">
                            {profile.fosterSpecialNeedsWilling ? 'Willing' : 'Not now'}
                          </div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Experience</div>
                          <div className="font-medium text-sm truncate">
                            {profile.fosterPreviousExperience || 'Not set'}
                          </div>
                        </div>
                      </div>

                      <Button 
                        className="w-full bg-[hsl(var(--mode-foster))] hover:bg-[hsl(var(--mode-foster)/0.9)] text-white"
                        onClick={() => { setIsEditingProfile(true); setActiveSection('foster'); }}
                        data-testid="button-edit-foster"
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit Foster Profile
                      </Button>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* REHOME MODE CONTENT */}
              <TabsContent value="rehome" className="mt-6 space-y-4">
                <Card className="shadow-md overflow-hidden">
                  <button
                    onClick={() => setIsRehomeInfoExpanded(!isRehomeInfoExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                    data-testid="button-toggle-rehome-info"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[hsl(var(--mode-rehome)/0.1)] flex items-center justify-center">
                        <HeartHandshake className="w-5 h-5 text-[hsl(var(--mode-rehome))]" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-foreground">Rehoming Profile</div>
                        <div className="text-sm text-muted-foreground">Contact & listing info</div>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isRehomeInfoExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isRehomeInfoExpanded ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-4 pb-4 pt-2 space-y-4 border-t">
                      <p className="text-sm text-muted-foreground">
                        We understand that rehoming a pet is a difficult decision. Scout helps you find the perfect new family.
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Phone</div>
                          <div className="font-medium text-sm flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {profile.phoneNumber || 'Not set'}
                          </div>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Location</div>
                          <div className="font-medium text-sm flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            {profile.city && profile.state ? `${profile.city}, ${profile.state}` : 'Not set'}
                          </div>
                        </div>
                      </div>

                      {profile.reasonForRehoming && (
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">Reason for Rehoming</div>
                          <div className="text-sm">{profile.reasonForRehoming}</div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button 
                          variant="outline"
                          className="flex-1"
                          onClick={() => { setIsEditingProfile(true); setActiveSection('rehome'); }}
                          data-testid="button-edit-rehome"
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Edit Info
                        </Button>
                        <Button 
                          className="flex-1 bg-[hsl(var(--mode-rehome))] hover:bg-[hsl(var(--mode-rehome)/0.9)] text-white"
                          onClick={() => setLocation('/my-listings')}
                          data-testid="button-my-listings"
                        >
                          <Dog className="w-4 h-4 mr-2" />
                          My Listings
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ===== ACTIVE ADOPTION JOURNEYS ===== */}
        {adoptionJourneys && adoptionJourneys.length > 0 && currentMode === 'adopt' && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Your Adoption Journeys
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Track your progress with each pup</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {adoptionJourneys.map((journey: any) => {
                  const dogName = journey.dog?.name || journey.dogName || 'Dog';
                  const steps = ['application', 'phone_screening', 'meet_greet', 'adoption'];
                  const currentStepIndex = steps.indexOf(journey.currentStep) + 1;
                  const totalSteps = steps.length;
                  
                  const getJourneyStatus = () => {
                    if (journey.status === 'rejected') {
                      return { label: 'Application declined', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-950/30' };
                    }
                    if (journey.completedAt) {
                      return { label: 'Adopted!', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/30' };
                    }
                    
                    switch (journey.currentStep) {
                      case 'application':
                        if (journey.status === 'approved') {
                          return { label: 'Application approved!', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-950/30' };
                        }
                        return { label: 'Under review', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/30' };
                      case 'phone_screening':
                        if (journey.phoneScreeningStatus === 'awaiting_review') {
                          return { label: 'Call complete - reviewing', color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950/30' };
                        }
                        if (journey.phoneScreeningStatus === 'in_progress') {
                          return { label: 'Call in progress', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30' };
                        }
                        if (journey.status === 'approved') {
                          return { label: 'Ready for phone call', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/30' };
                        }
                        return { label: 'Awaiting approval', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/30' };
                      case 'meet_greet':
                        return { label: 'Schedule meet & greet', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-950/30' };
                      case 'adoption':
                        return { label: 'Ready for adoption!', color: 'text-primary', bgColor: 'bg-primary/10' };
                      default:
                        return { label: 'In progress', color: 'text-muted-foreground', bgColor: 'bg-muted/50' };
                    }
                  };
                  
                  const getNextAction = () => {
                    if (journey.status === 'rejected' || journey.completedAt) return null;
                    
                    switch (journey.currentStep) {
                      case 'application':
                        if (journey.status === 'approved') {
                          return 'Proceed to phone screening';
                        }
                        return 'We\'ll review your application soon';
                      case 'phone_screening':
                        if (journey.phoneScreeningStatus === 'awaiting_review') {
                          return 'We\'re reviewing your call';
                        }
                        if (journey.phoneScreeningStatus === 'in_progress') {
                          return 'Answer the incoming call';
                        }
                        if (journey.status === 'approved') {
                          return 'Tap to start your phone screening';
                        }
                        return 'Waiting for approval to proceed';
                      case 'meet_greet':
                        return 'Contact us to schedule a visit';
                      case 'adoption':
                        return 'Complete your adoption paperwork';
                      default:
                        return null;
                    }
                  };
                  
                  const status = getJourneyStatus();
                  const nextAction = getNextAction();
                  
                  return (
                    <div
                      key={journey.id}
                      className={`w-full p-4 rounded-xl border transition-colors hover:shadow-md cursor-pointer ${status.bgColor}`}
                      onClick={() => setLocation(`/dogs/${journey.dogId}`)}
                      data-testid={`journey-${journey.id}`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center flex-shrink-0">
                          <PawPrint className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-base sm:text-lg truncate" data-testid={`text-dog-name-${journey.id}`}>
                              {dogName}
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWithdrawJourneyId(journey.id);
                                setWithdrawDogName(dogName);
                              }}
                              data-testid={`button-withdraw-${journey.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className={`text-sm font-medium ${status.color} mb-2`} data-testid={`text-status-${journey.id}`}>
                            {status.label}
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1">
                              {steps.map((step, index) => (
                                <div
                                  key={step}
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    index < currentStepIndex 
                                      ? 'bg-green-500' 
                                      : index === currentStepIndex - 1 
                                        ? 'bg-primary' 
                                        : 'bg-gray-300 dark:bg-gray-600'
                                  }`}
                                  data-testid={`progress-dot-${step}-${journey.id}`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Step {currentStepIndex} of {totalSteps}
                            </span>
                          </div>
                          
                          {nextAction && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Next:</span>
                              <span data-testid={`text-next-action-${journey.id}`}>{nextAction}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== ACCOUNT ACTIONS ===== */}
        <Card className="shadow-md">
          <CardContent className="p-4">
            <Button 
              variant="outline" 
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
      {/* ===== EDIT PROFILE DIALOG ===== */}
      <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Lifestyle Section */}
            {(activeSection === 'lifestyle' || activeSection === null) && currentMode === 'adopt' && (
              <>
                <FormSection
                  title="Your Lifestyle"
                  description="Help us match you with the perfect dog"
                  icon={Home}
                  variant="ai"
                />
                <div className="space-y-2">
                  <Label>Home Type</Label>
                  <Select
                    value={profileData.homeType}
                    onValueChange={(v) => setProfileData({ ...profileData, homeType: v })}
                  >
                    <SelectTrigger data-testid="select-home-type">
                      <SelectValue placeholder="Select home type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="house">House</SelectItem>
                      <SelectItem value="apartment">Apartment</SelectItem>
                      <SelectItem value="condo">Condo/Townhouse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="hasYard"
                    checked={profileData.hasYard}
                    onCheckedChange={(c) => setProfileData({ ...profileData, hasYard: !!c })}
                  />
                  <Label htmlFor="hasYard">I have a yard</Label>
                </div>

                <div className="space-y-2">
                  <Label>Activity Level</Label>
                  <Select
                    value={profileData.activityLevel}
                    onValueChange={(v) => setProfileData({ ...profileData, activityLevel: v })}
                  >
                    <SelectTrigger data-testid="select-activity">
                      <SelectValue placeholder="Select activity level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="very_active">Very Active</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="relaxed">Relaxed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Work Schedule</Label>
                  <Select
                    value={profileData.workSchedule}
                    onValueChange={(v) => setProfileData({ ...profileData, workSchedule: v })}
                  >
                    <SelectTrigger data-testid="select-work">
                      <SelectValue placeholder="Select work schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home_all_day">Work from Home</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="office_full_time">Full-time Office</SelectItem>
                      <SelectItem value="varies">Flexible Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Experience Level</Label>
                  <Select
                    value={profileData.experienceLevel}
                    onValueChange={(v) => setProfileData({ ...profileData, experienceLevel: v })}
                  >
                    <SelectTrigger data-testid="select-experience">
                      <SelectValue placeholder="Select experience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="first_time">First Time Owner</SelectItem>
                      <SelectItem value="some_experience">Some Experience</SelectItem>
                      <SelectItem value="experienced">Experienced</SelectItem>
                      <SelectItem value="very_experienced">Very Experienced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Family Section */}
            {activeSection === 'family' && currentMode === 'adopt' && (
              <>
                <FamilyMembersManager />

                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Why this matters:</span> Dogs have different temperaments and energy levels. 
                      Knowing about your household helps us match you with dogs that will thrive in your environment.
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Foster Section */}
            {activeSection === 'foster' && currentMode === 'foster' && (
              <>
                <FormSection
                  title="Foster Details"
                  description="Let us know your fostering preferences"
                  icon={HeartHandshake}
                  variant="ai"
                />
                <div className="space-y-2">
                  <Label>Time Commitment</Label>
                  <Select
                    value={profileData.fosterTimeCommitment}
                    onValueChange={(v) => setProfileData({ ...profileData, fosterTimeCommitment: v })}
                  >
                    <SelectTrigger data-testid="select-foster-time">
                      <SelectValue placeholder="How long can you foster?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short_term">Short Term (2-4 weeks)</SelectItem>
                      <SelectItem value="medium_term">Medium Term (1-2 months)</SelectItem>
                      <SelectItem value="long_term">Long Term (2+ months)</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Emergency Availability</Label>
                  <Select
                    value={profileData.fosterEmergencyAvailability}
                    onValueChange={(v) => setProfileData({ ...profileData, fosterEmergencyAvailability: v })}
                  >
                    <SelectTrigger data-testid="select-foster-emergency">
                      <SelectValue placeholder="How quickly can you take in a dog?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="same_day">Same Day</SelectItem>
                      <SelectItem value="few_days">Within Few Days</SelectItem>
                      <SelectItem value="week_notice">Week's Notice</SelectItem>
                      <SelectItem value="month_notice">Month's Notice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3">
                  <Checkbox
                    id="fosterSpecialNeeds"
                    checked={profileData.fosterSpecialNeedsWilling}
                    onCheckedChange={(c) => setProfileData({ ...profileData, fosterSpecialNeedsWilling: !!c })}
                  />
                  <Label htmlFor="fosterSpecialNeeds">I'm willing to foster dogs with special needs</Label>
                </div>

                <div className="space-y-2">
                  <Label>Previous Foster Experience</Label>
                  <Textarea
                    value={profileData.fosterPreviousExperience}
                    onChange={(e) => setProfileData({ ...profileData, fosterPreviousExperience: e.target.value })}
                    placeholder="Describe any previous fostering experience..."
                    data-testid="textarea-foster-experience"
                  />
                </div>
              </>
            )}

            {/* Rehome Section */}
            {(activeSection === 'rehome' || activeSection === 'contact') && currentMode === 'rehome' && (
              <>
                <FormSection
                  title="Rehoming Information"
                  description="Your contact information for potential adopters"
                  icon={Dog}
                  variant="ai"
                />
                <div className="space-y-2">
                  <Label>Phone Number *</Label>
                  <Input
                    value={profileData.phoneNumber}
                    onChange={(e) => setProfileData({ ...profileData, phoneNumber: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Input
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                      placeholder="Austin"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Input
                      value={profileData.state}
                      onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                      placeholder="TX"
                      data-testid="input-state"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Reason for Rehoming *</Label>
                  <Textarea
                    value={profileData.reasonForRehoming}
                    onChange={(e) => setProfileData({ ...profileData, reasonForRehoming: e.target.value })}
                    placeholder="Tell us why you're rehoming your dog..."
                    rows={4}
                    data-testid="textarea-reason"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsEditingProfile(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              onClick={() => updateProfileMutation.mutate(profileData)}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-profile"
              className="w-full sm:w-auto"
            >
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== WITHDRAW APPLICATION CONFIRMATION DIALOG ===== */}
      <AlertDialog open={!!withdrawJourneyId} onOpenChange={(open) => !open && setWithdrawJourneyId(null)}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw Application?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to withdraw your application for <strong>{withdrawDogName}</strong>? 
              This action cannot be undone and you will need to reapply if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel 
              className="w-full sm:w-auto"
              onClick={() => {
                setWithdrawJourneyId(null);
                setWithdrawDogName("");
              }}
            >
              Keep Application
            </AlertDialogCancel>
            <AlertDialogAction
              className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (withdrawJourneyId) {
                  withdrawJourneyMutation.mutate(withdrawJourneyId);
                }
              }}
              disabled={withdrawJourneyMutation.isPending}
              data-testid="button-confirm-withdraw"
            >
              {withdrawJourneyMutation.isPending ? 'Withdrawing...' : 'Withdraw Application'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== PET DIALOG (controlled from hero section) ===== */}
      <HouseholdPetsManager 
        dialogOnly 
        open={isPetDialogOpen} 
        onOpenChange={setIsPetDialogOpen}
        editPetId={editingPetId}
      />
    </div>
  );
}
