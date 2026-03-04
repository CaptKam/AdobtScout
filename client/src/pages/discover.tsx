import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { X, MessageCircle, Heart, RotateCcw, AlertTriangle, Filter } from "lucide-react";
import { DogCard } from "@/components/dog-card";
import { FosterDiscover } from "@/components/foster-discover";
import { DogsNeedFoster } from "@/components/dogs-need-foster";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import type { DogWithCompatibility, UserProfile } from "@shared/schema";
import { useLocation } from "wouter";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Wrapper component that handles mode-based routing
export default function Discover() {
  // Check if user is authenticated
  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user profile to check mode
  const { data: userProfile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // Show loading state while profile is being fetched for authenticated users
  if (currentUser && profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary mb-3"></div>
        <p className="text-muted-foreground">Loading your profile...</p>
      </div>
    );
  }

  // Route to mode-specific content using separate components
  // This avoids hooks ordering issues by keeping each component's hooks isolated
  if (currentUser && userProfile?.mode === 'rehome') {
    return <FosterDiscover />;
  }
  
  if (currentUser && userProfile?.mode === 'foster') {
    return <DogsNeedFoster />;
  }

  // Default: Adopt mode or guest users
  return <AdoptModeDiscover currentUser={currentUser} userProfile={userProfile} />;
}

// Session storage keys for flow state persistence
const DISCOVER_INDEX_KEY = 'discover_currentIndex';
const DISCOVER_URGENT_FILTER_KEY = 'discover_showUrgentOnly';
const DISCOVER_ANIMAL_TYPE_KEY = 'discover_selectedAnimalType';

// Local storage key for guest user swipes (persists across sessions)
const GUEST_SWIPES_KEY = 'guest_swipes';

// Helper functions for guest swipe storage
interface GuestSwipe {
  dogId: string;
  direction: 'left' | 'right';
  timestamp: number;
}

function getGuestSwipes(): GuestSwipe[] {
  try {
    const saved = localStorage.getItem(GUEST_SWIPES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveGuestSwipe(dogId: string, direction: 'left' | 'right'): void {
  const swipes = getGuestSwipes();
  // Remove any existing swipe for this dog (in case of re-swipe)
  const filtered = swipes.filter(s => s.dogId !== dogId);
  filtered.push({ dogId, direction, timestamp: Date.now() });
  localStorage.setItem(GUEST_SWIPES_KEY, JSON.stringify(filtered));
}

function clearGuestSwipes(): void {
  localStorage.removeItem(GUEST_SWIPES_KEY);
}

// Export for use after user signup to migrate swipes
export { getGuestSwipes, clearGuestSwipes };

// The original Discover component, now only for adopt mode
function AdoptModeDiscover({ currentUser, userProfile }: { currentUser: any; userProfile: UserProfile | undefined }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Initialize state from sessionStorage to preserve flow state
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = sessionStorage.getItem(DISCOVER_INDEX_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      // Guard against NaN or negative values
      return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
    }
    return 0;
  });
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const exitDirectionRef = useRef<"left" | "right" | null>(null); // Ref for immediate access
  const [isDragging, setIsDragging] = useState(false);
  const [showUrgentOnly, setShowUrgentOnly] = useState(() => {
    const saved = sessionStorage.getItem(DISCOVER_URGENT_FILTER_KEY);
    return saved === 'true';
  });
  const [selectedAnimalType, setSelectedAnimalType] = useState<string>(() => {
    const saved = sessionStorage.getItem(DISCOVER_ANIMAL_TYPE_KEY);
    return saved || 'all';
  });

  // Fetch enabled animal types from admin settings
  const { data: enabledAnimalTypes } = useQuery<{ id: string; label: string }[]>({
    queryKey: ["/api/animal-types"],
  });

  // Motion values for drag - smoother animations
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(x, [-300, -150, 0, 150, 300], [0, 1, 1, 1, 0]);

  // Fetch matched dogs for authenticated user
  const { data: dogs, isLoading, error, refetch } = useQuery<DogWithCompatibility[]>({
    queryKey: ["/api/dogs/discover"],
    staleTime: 30 * 1000, // Cache for 30 seconds to prevent redundant fetches
    gcTime: 60 * 1000, // Keep in garbage collection for 1 minute
    refetchOnMount: false, // Don't refetch if data is fresh
    refetchOnWindowFocus: false,
  });

  // Record swipe mutation
  const swipeMutation = useMutation({
    mutationFn: async ({ dogId, direction }: { dogId: string; direction: "left" | "right" }) => {
      return apiRequest("POST", "/api/swipes", { dogId, direction });
    },
    onSuccess: async (_, { direction }) => {
      if (direction === "right") {
        queryClient.invalidateQueries({ queryKey: ["/api/dogs/liked"] });
      }
    },
    onError: (error) => {
      console.error("Error recording swipe:", error);
      toast({
        title: "Error saving your choice",
        description: "Don't worry, you can try again. If the problem persists, please refresh the page.",
        variant: "destructive",
      });
    },
  });

  // Force refetch when user authentication changes
  useEffect(() => {
    if (currentUser && userProfile?.mode === 'adopt') {
      console.log('[Discover] User authenticated in adopt mode, forcing fresh data fetch');
      refetch();
    }
  }, [currentUser?.id, userProfile?.mode, refetch]);

  // Persist currentIndex to sessionStorage for flow state preservation
  useEffect(() => {
    sessionStorage.setItem(DISCOVER_INDEX_KEY, currentIndex.toString());
  }, [currentIndex]);

  // Persist filter preferences to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(DISCOVER_URGENT_FILTER_KEY, showUrgentOnly.toString());
  }, [showUrgentOnly]);

  useEffect(() => {
    sessionStorage.setItem(DISCOVER_ANIMAL_TYPE_KEY, selectedAnimalType);
  }, [selectedAnimalType]);

  // Filter dogs based on urgency and animal type filters
  const filteredDogs = useMemo(() => {
    if (!dogs) return [];
    let filtered = dogs;
    
    // Filter by animal type
    if (selectedAnimalType !== "all") {
      filtered = filtered.filter(dog => (dog as any).animalType === selectedAnimalType);
    }
    
    // Filter by urgency
    if (showUrgentOnly) {
      filtered = filtered.filter(dog => dog.urgencyLevel === 'urgent' || dog.urgencyLevel === 'critical');
    }
    
    return filtered;
  }, [dogs, showUrgentOnly, selectedAnimalType]);

  // Count urgent dogs for the badge
  const urgentDogCount = useMemo(() => {
    if (!dogs) return 0;
    return dogs.filter(dog => dog.urgencyLevel === 'urgent' || dog.urgencyLevel === 'critical').length;
  }, [dogs]);

  const currentDog = useMemo(() => {
    if (!filteredDogs || filteredDogs.length === 0) return null;
    return filteredDogs[currentIndex];
  }, [filteredDogs, currentIndex]);

  const nextDog = useMemo(() => {
    if (!filteredDogs || filteredDogs.length <= currentIndex + 1) return null;
    return filteredDogs[currentIndex + 1];
  }, [filteredDogs, currentIndex]);

  // Validate saved index against current filtered dogs length
  useEffect(() => {
    if (filteredDogs.length > 0 && currentIndex >= filteredDogs.length) {
      // If saved index is out of bounds, reset to 0
      setCurrentIndex(0);
    }
  }, [filteredDogs.length, currentIndex]);

  // Note: Mode routing and profile loading are handled by the wrapper component

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const swipeThreshold = 150; // Higher threshold for more intentional swipes
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    setIsDragging(false);

    // Determine if swipe was strong enough
    if (Math.abs(offset) > swipeThreshold || Math.abs(velocity) > 800) {
      const direction = offset > 0 ? "right" : "left";
      handleSwipe(direction);
    } else {
      // Reset with spring animation for smooth return
      // No need to manually set - motion will handle it
    }
  };

  const handleSwipe = async (direction: "left" | "right") => {
    // Use ref as primary lock since state updates are async
    if (!currentDog || exitDirectionRef.current !== null) return; // Prevent multiple swipes during animation

    const swipedDog = currentDog; // Store reference before incrementing

    // Set ref immediately as a lock to prevent race conditions on rapid swipes
    exitDirectionRef.current = direction;
    // Then update state to trigger re-render with animation
    setExitDirection(direction);
    x.stop(); // Stop any active drag motion

    // For guest users, save swipes locally so they can be migrated after signup
    if (!currentUser) {
      saveGuestSwipe(swipedDog.id, direction);
    }

    // Record the swipe via API (will work for authenticated users)
    swipeMutation.mutate({
      dogId: swipedDog.id,
      direction,
    });

    // Show feedback toast with warm, encouraging copy
    if (direction === "right") {
      toast({
        title: `${swipedDog.name} saved to favorites`,
        description: currentUser 
          ? "Find them in Messages when you're ready to connect!"
          : "Create an account to keep your favorites safe.",
        duration: 2500,
      });
    } else {
      toast({
        title: "No worries",
        description: `Maybe ${swipedDog.name} wasn't the one. Keep looking!`,
        duration: 1500,
      });
    }

    // Animation will complete via onAnimationComplete callback
  };

  const handleMessage = async () => {
    if (!currentDog) return;

    try {
      console.log('[Discover] Starting conversation for dog:', currentDog.id);

      // Get or create conversation
      const response = await apiRequest("GET", `/api/conversations/by-dog/${currentDog.id}`);
      const conversation = await response.json();
      console.log('[Discover] Got conversation:', conversation.id);

      // Navigate to the conversation page
      setLocation(`/messages/${conversation.id}`);
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    sessionStorage.removeItem(DISCOVER_INDEX_KEY); // Clear saved position on reset
    x.set(0);
    queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
  };

  // Calculate like/nope indicator opacity and scale - much smoother transitions
  const likeOpacity = useTransform(x, [0, 30, 100, 200], [0, 0.3, 0.8, 1]);
  const likeScale = useTransform(x, [0, 30, 100, 200], [0.8, 0.9, 1, 1.1]);
  const nopeOpacity = useTransform(x, [-200, -100, -30, 0], [1, 0.8, 0.3, 0]);
  const nopeScale = useTransform(x, [-200, -100, -30, 0], [1.1, 1, 0.9, 0.8]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/20">
        <div className="text-center space-y-6 max-w-md">
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
              <Heart className="w-12 h-12 text-primary/60 animate-pulse" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-shimmer rounded-2xl" />
          </div>
          <div>
            <h2 className="text-3xl font-bold animate-fadeInUp">
              Finding your matches...
            </h2>
            <p className="text-muted-foreground text-lg animate-fadeInUp pt-2" style={{ animationDelay: "0.1s" }}>
              Scout is analyzing compatible dogs near you
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-gradient-to-b from-background via-background to-muted/20">
        <div className="text-center space-y-6 max-w-md animate-fadeInUp">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-destructive/20 to-destructive/5 rounded-2xl flex items-center justify-center">
              <X className="w-12 h-12 text-destructive/50" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              We're having trouble loading dogs right now. This is usually temporary.
            </p>
          </div>
          <div className="flex gap-4 justify-center flex-col sm:flex-row pt-4">
            <Button 
              onClick={() => window.location.reload()} 
              data-testid="button-retry-load"
              className="btn-premium flex-1 sm:flex-none text-lg px-8 py-6"
              size="lg"
            >
              <RotateCcw className="w-5 h-5 mr-3" />
              Retry
            </Button>
            <Button 
              onClick={() => setLocation("/map")} 
              variant="outline" 
              data-testid="button-view-map-error"
              className="btn-premium flex-1 sm:flex-none text-lg px-8 py-6"
              size="lg"
            >
              View Map
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!filteredDogs || filteredDogs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-gradient-to-b from-background via-background to-muted/20">
        <div className="text-center space-y-6 max-w-md animate-fadeInUp">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center group hover-elevate">
              <Heart className="w-12 h-12 text-primary/50 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">
              {showUrgentOnly ? "No urgent pets right now" : "No pets right now"}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {showUrgentOnly 
                ? "Great news! There are no pets in urgent need at the moment. Check back soon or explore all pets."
                : "Check back soon as shelters add more adoptable pets. We're always growing our community!"}
            </p>
          </div>
          <div className="flex gap-4 justify-center flex-col sm:flex-row pt-4">
            {showUrgentOnly && (
              <Button 
                onClick={() => setShowUrgentOnly(false)} 
                data-testid="button-show-all-dogs"
                className="btn-premium text-lg px-8 py-6"
                size="lg"
              >
                Show All Pets
              </Button>
            )}
            <Button 
              onClick={() => setLocation("/map")} 
              variant="outline" 
              data-testid="button-view-map"
              className="btn-premium text-lg px-8 py-6"
              size="lg"
            >
              Explore Map
            </Button>
            {!currentUser && !showUrgentOnly && (
              <Button 
                onClick={() => setLocation("/onboarding")} 
                data-testid="button-start-matching"
                className="btn-premium text-lg px-8 py-6"
                size="lg"
              >
                Create Account
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentIndex >= filteredDogs.length) {
    return (
      <div className="h-full flex items-center justify-center px-4 bg-gradient-to-b from-background via-background to-muted/20">
        <div className="text-center space-y-6 max-w-md animate-fadeInUp">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl flex items-center justify-center">
              <Heart className="w-12 h-12 text-green-500/60" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-3">Amazing work!</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {currentUser 
                ? "You've seen all the current pets. Your favorites are saved in Messages. New pets are added daily!" 
                : "Create a free account to save your favorites and get personalized matches tailored to your lifestyle."}
            </p>
          </div>
          <div className="flex gap-4 justify-center flex-col sm:flex-row pt-4">
            {currentUser ? (
              <>
                <Button 
                  onClick={() => setLocation("/messages")} 
                  data-testid="button-view-matches"
                  className="btn-premium"
                  size="lg"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  View Favorites
                </Button>
                <Button 
                  onClick={handleReset} 
                  variant="outline" 
                  data-testid="button-reset"
                  size="lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Start Fresh
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={() => setLocation("/onboarding")} 
                  data-testid="button-create-account"
                  className="btn-premium"
                  size="lg"
                >
                  Create Free Account
                </Button>
                <Button 
                  onClick={handleReset} 
                  variant="outline" 
                  data-testid="button-reset"
                  size="lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Browse Again
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Keyboard shortcuts for desktop
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!currentDog) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleSwipe('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleSwipe('right');
    }
  };

  return (
    <div 
      className="h-full flex flex-col items-center justify-start pt-2 relative overflow-hidden bg-gradient-to-b from-background to-muted/20 md:pb-0 animate-fadeIn" 
      style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 0.5rem)' }}
      onKeyDown={handleKeyDown} 
      tabIndex={0}
    >
      {/* Card Stack Container - Tinder style with viewport-aware height */}
      <div 
        className="relative w-full max-w-lg md:max-w-2xl px-2 sm:px-3 md:px-0 md:h-[700px] lg:h-[750px]"
        style={{ height: 'calc(100dvh - var(--bottom-nav-height) - 10rem)' }}
      >
        {/* Filter Controls */}
        <div className="absolute -top-14 left-0 right-0 flex justify-center gap-2 z-20">
          {/* Animal Type Filter - only show if multiple types enabled */}
          {enabledAnimalTypes && enabledAnimalTypes.length > 1 && (
            <Select
              value={selectedAnimalType}
              onValueChange={(value) => {
                setSelectedAnimalType(value);
                setCurrentIndex(0);
              }}
            >
              <SelectTrigger 
                className="w-auto min-w-[120px] bg-white dark:bg-card shadow-lg border border-border"
                data-testid="select-animal-type-filter"
              >
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Animals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Animals</SelectItem>
                {enabledAnimalTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Urgent Filter Toggle */}
          {urgentDogCount > 0 && (
            <button
              onClick={() => {
                setShowUrgentOnly(!showUrgentOnly);
                setCurrentIndex(0);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-200 ${
                showUrgentOnly 
                  ? 'bg-red-500 text-white border-red-600' 
                  : 'bg-white dark:bg-card border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
              }`}
              data-testid="button-urgent-filter"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-semibold">
                {showUrgentOnly ? 'Showing Urgent Only' : `${urgentDogCount} Need Help`}
              </span>
              {!showUrgentOnly && (
                <Badge variant="secondary" className="ml-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-1.5 py-0">
                  Tap
                </Badge>
              )}
            </button>
          )}
        </div>

        {/* Background cards for depth (3 cards deep like Tinder) */}
        {filteredDogs && filteredDogs.slice(currentIndex + 2, currentIndex + 3).map((dog, idx) => (
          <div 
            key={dog.id}
            className="absolute inset-0 pointer-events-none transition-all duration-300" 
            style={{ 
              transform: `scale(${0.82 - idx * 0.06}) translateY(${20 + idx * 8}px)`,
              zIndex: -2 + idx,
              opacity: 0.3
            }}
          >
            <DogCard dog={dog} />
          </div>
        ))}

        {nextDog && (
          <div 
            className="absolute inset-0 pointer-events-none transition-all duration-300" 
            style={{ 
              transform: "scale(0.90) translateY(14px)", 
              zIndex: 0,
              opacity: 0.6
            }}
          >
            <DogCard dog={nextDog} />
          </div>
        )}

        {/* Current card with drag - using animate prop for smooth directional exits */}
        {currentDog && (
          <motion.div
            key={currentDog.id}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            initial={{ x: 0, rotate: 0, opacity: 1 }}
            style={{
              x: exitDirection ? undefined : x,
              rotate: exitDirection ? undefined : rotate,
              opacity: exitDirection ? undefined : opacity,
              zIndex: 1,
            }}
            animate={exitDirection ? {
              x: exitDirection === "right" ? 500 : -500,
              rotate: exitDirection === "right" ? 25 : -25,
              opacity: 0,
            } : { x: 0, rotate: 0, opacity: 1 }}
            drag={exitDirection ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.8}
            dragMomentum={false}
            dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            onClick={() => {
              // Only navigate if not dragging and no exit animation in progress
              if (!isDragging && !exitDirection) {
                sessionStorage.setItem('dogProfileReferrer', 'discover');
                setLocation(`/dogs/${currentDog.id}`);
              }
            }}
            onAnimationComplete={() => {
              // When exit animation completes, advance to next card
              if (exitDirection) {
                setCurrentIndex((prev) => {
                  const nextIndex = prev + 1;
                  // Refetch every 5 dogs to keep data fresh
                  if (currentUser && nextIndex > 0 && nextIndex % 5 === 0) {
                    queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
                  }
                  return nextIndex;
                });
                exitDirectionRef.current = null;
                setExitDirection(null);
                x.set(0);
              }
            }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 25,
              mass: 1,
            }}
          >
            {/* Swipe Indicators - Tinder-style bold stamps (show on drag OR button click) */}
            <motion.div
              className="absolute top-8 sm:top-12 right-6 sm:right-10 z-10 pointer-events-none select-none"
              style={{ opacity: exitDirection === "right" ? 1 : likeOpacity, scale: exitDirection === "right" ? 1.1 : likeScale }}
              animate={exitDirection === "right" ? { opacity: 1, scale: 1.1 } : undefined}
            >
              <div className="border-[5px] sm:border-[7px] border-emerald-500 text-emerald-500 font-black text-4xl sm:text-6xl px-5 sm:px-6 py-2 sm:py-3 rotate-[22deg] rounded-lg uppercase tracking-[0.15em] shadow-[0_0_40px_rgba(16,185,129,0.6)]" style={{ textShadow: '0 0 20px rgba(16,185,129,0.5)' }}>
                LIKE
              </div>
            </motion.div>

            <motion.div
              className="absolute top-8 sm:top-12 left-6 sm:left-10 z-10 pointer-events-none select-none"
              style={{ opacity: exitDirection === "left" ? 1 : nopeOpacity, scale: exitDirection === "left" ? 1.1 : nopeScale }}
              animate={exitDirection === "left" ? { opacity: 1, scale: 1.1 } : undefined}
            >
              <div className="border-[5px] sm:border-[7px] border-red-500 text-red-500 font-black text-4xl sm:text-6xl px-5 sm:px-6 py-2 sm:py-3 -rotate-[22deg] rounded-lg uppercase tracking-[0.15em] shadow-[0_0_40px_rgba(239,68,68,0.6)]" style={{ textShadow: '0 0 20px rgba(239,68,68,0.5)' }}>
                NOPE
              </div>
            </motion.div>

            <DogCard dog={currentDog} />
          </motion.div>
        )}
      </div>

      {/* Controls - Clean circular action buttons */}
      <div className="mt-2 sm:mt-4 flex items-center justify-center gap-4 sm:gap-6 z-10 px-4">
        {/* Pass Button */}
        <button
          className="flex flex-col items-center gap-1.5 disabled:opacity-50 transition-all duration-200 group"
          onClick={() => handleSwipe("left")}
          disabled={swipeMutation.isPending}
          data-testid="button-pass"
          title="Pass (Left Arrow)"
        >
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center group-hover:bg-rose-100 dark:group-hover:bg-rose-900/50 group-active:scale-95 transition-all">
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500 dark:text-rose-400" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Pass</span>
        </button>

        {/* Like Button - Main CTA (larger) */}
        <button
          className="flex flex-col items-center gap-1.5 disabled:opacity-50 transition-all duration-200 group"
          onClick={() => handleSwipe("right")}
          disabled={swipeMutation.isPending}
          data-testid="button-like"
          title="Like (Right Arrow)"
        >
          <div className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] rounded-full bg-primary flex items-center justify-center group-hover:bg-primary/90 group-active:scale-95 transition-all shadow-sm">
            <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground fill-primary-foreground" strokeWidth={2} />
          </div>
          <span className="text-[10px] sm:text-xs font-semibold text-primary uppercase tracking-wide">Like</span>
        </button>

        {/* Chat Button */}
        <button
          className="flex flex-col items-center gap-1.5 disabled:opacity-50 transition-all duration-200 group"
          onClick={handleMessage}
          data-testid="button-message"
          title="Message"
        >
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center justify-center group-hover:bg-sky-100 dark:group-hover:bg-sky-900/50 group-active:scale-95 transition-all">
            <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-sky-500 dark:text-sky-400" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">Chat</span>
        </button>
      </div>

      {/* Swipe hint */}
      <p className="mt-2 text-xs text-muted-foreground/60 text-center">
        Swipe cards or tap buttons • Arrow keys work too
      </p>

    </div>
  );
}