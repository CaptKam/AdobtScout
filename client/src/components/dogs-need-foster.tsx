import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, 
  X,
  AlertTriangle,
  RotateCcw,
  MessageCircle,
  Home
} from "lucide-react";
import { DogCard } from "@/components/dog-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";

interface DogNeedingFoster {
  id: string;
  name: string;
  breed: string;
  age: number;
  ageCategory: string;
  size: string;
  weight: number;
  energyLevel: string;
  temperament: string[];
  goodWithKids: boolean;
  goodWithDogs: boolean;
  goodWithCats: boolean;
  bio: string;
  specialNeeds?: string;
  photos: string[];
  fosterDuration?: string;
  fosterReason?: string;
  urgencyLevel: string;
  distance: number;
  ownerName: string;
  ownerCity?: string;
  ownerState?: string;
  city?: string;
  state?: string;
  shelterName?: string;
}



export function DogsNeedFoster() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const exitDirectionRef = useRef<"left" | "right" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerMessage, setOfferMessage] = useState("");
  const [selectedDog, setSelectedDog] = useState<DogNeedingFoster | null>(null);
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);

  // Motion values for drag
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(x, [-300, -150, 0, 150, 300], [0, 1, 1, 1, 0]);

  const { data: dogs, isLoading, error, refetch } = useQuery<DogNeedingFoster[]>({
    queryKey: ["/api/dogs/need-foster"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Filter dogs based on urgency filter
  const filteredDogs = useMemo(() => {
    if (!dogs) return [];
    if (!showUrgentOnly) return dogs;
    return dogs.filter(dog => dog.urgencyLevel === 'urgent' || dog.urgencyLevel === 'critical');
  }, [dogs, showUrgentOnly]);

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

  // Calculate like/nope indicator opacity and scale
  const likeOpacity = useTransform(x, [0, 30, 100, 200], [0, 0.3, 0.8, 1]);
  const likeScale = useTransform(x, [0, 30, 100, 200], [0.8, 0.9, 1, 1.1]);
  const nopeOpacity = useTransform(x, [-200, -100, -30, 0], [1, 0.8, 0.3, 0]);
  const nopeScale = useTransform(x, [-200, -100, -30, 0], [1.1, 1, 0.9, 0.8]);

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const swipeThreshold = 150;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    setIsDragging(false);

    if (Math.abs(offset) > swipeThreshold || Math.abs(velocity) > 800) {
      const direction = offset > 0 ? "right" : "left";
      handleSwipe(direction);
    }
  };

  const handleSwipe = (direction: "left" | "right") => {
    if (!currentDog || exitDirection) return;

    const swipedDog = currentDog;

    exitDirectionRef.current = direction;
    setExitDirection(direction);
    x.stop();
    setIsCardVisible(false);

    if (direction === "right") {
      // Show offer dialog for right swipe (interested in fostering)
      setSelectedDog(swipedDog);
      setShowOfferDialog(true);
      toast({
        title: "Interested in Fostering!",
        description: `You're interested in fostering ${swipedDog.name}. Let's connect you with the owner.`,
        duration: 2000,
      });
    } else {
      toast({
        title: "Passed",
        description: `Moved on from ${swipedDog.name}`,
        duration: 1500,
      });
    }
  };

  const handleOfferSubmit = async () => {
    if (!selectedDog) return;
    
    try {
      await apiRequest("POST", "/api/foster-offers", {
        dogId: selectedDog.id,
        message: offerMessage,
      });
      
      toast({
        title: "Foster Offer Sent!",
        description: `Your offer to foster ${selectedDog.name} has been sent to the owner.`,
      });
      
      setShowOfferDialog(false);
      setOfferMessage("");
      setSelectedDog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/foster-offers"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send foster offer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setCurrentIndex(0);
    x.set(0);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/20">
        <div className="text-center space-y-6 max-w-md">
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
              <Home className="w-12 h-12 text-primary/60 animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold animate-fadeInUp">
              Finding dogs who need foster...
            </h2>
            <p className="text-muted-foreground text-lg animate-fadeInUp pt-2" style={{ animationDelay: "0.1s" }}>
              Scout is searching for dogs who need temporary homes
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
            <h2 className="text-3xl font-bold mb-2">Unable to Load Pets</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              We're having trouble loading pets who need foster care right now.
            </p>
          </div>
          <Button 
            onClick={() => refetch()} 
            data-testid="button-retry"
            className="btn-premium text-lg px-8 py-6"
            size="lg"
          >
            <RotateCcw className="w-5 h-5 mr-3" />
            Retry
          </Button>
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
              <Home className="w-12 h-12 text-primary/50 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">
              {showUrgentOnly ? "No urgent foster needs" : "No pets need foster right now"}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {showUrgentOnly 
                ? "Great news! There are no urgent foster requests at the moment."
                : "Check back soon - pet owners may need temporary foster help at any time."}
            </p>
          </div>
          <div className="flex gap-4 justify-center flex-col sm:flex-row pt-4">
            {showUrgentOnly && (
              <Button 
                onClick={() => setShowUrgentOnly(false)} 
                data-testid="button-show-all-foster"
                className="btn-premium text-lg px-8 py-6"
                size="lg"
              >
                Show All
              </Button>
            )}
            <Button 
              onClick={() => setLocation("/map")} 
              variant="outline" 
              data-testid="button-view-foster-map"
              className="btn-premium text-lg px-8 py-6"
              size="lg"
            >
              View Map
            </Button>
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
            <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
              <Home className="w-12 h-12 text-primary/50 animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">You've seen them all!</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Check back later for more dogs who need foster care.
            </p>
          </div>
          <Button 
            onClick={handleReset} 
            variant="outline" 
            data-testid="button-reset-foster"
            className="btn-premium text-lg px-8 py-6"
            size="lg"
          >
            <RotateCcw className="w-5 h-5 mr-3" />
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-background to-muted/20">
      {/* Card Stack Container */}
      <div className="relative w-full max-w-lg md:max-w-2xl h-[600px] sm:h-[680px] md:h-[700px] lg:h-[750px] px-2 sm:px-3 md:px-0 mb-20 md:mb-0">
        {/* Urgent Filter Toggle */}
        {urgentDogCount > 0 && (
          <div className="absolute -top-20 left-0 right-0 flex justify-center z-20">
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
              data-testid="button-urgent-foster-filter"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-semibold">
                {showUrgentOnly ? 'Showing Urgent Only' : `${urgentDogCount} Need Help Now`}
              </span>
            </button>
          </div>
        )}

        {/* Background cards for depth */}
        {filteredDogs.slice(currentIndex + 2, currentIndex + 3).map((dog, idx) => (
          <div 
            key={dog.id}
            className="absolute inset-0 pointer-events-none transition-all duration-300" 
            style={{ 
              transform: `scale(${0.82 - idx * 0.06}) translateY(${20 + idx * 8}px)`,
              zIndex: -2 + idx,
              opacity: 0.3
            }}
          >
            <DogCard dog={dog as any} />
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
            <DogCard dog={nextDog as any} />
          </div>
        )}

        {/* Current card with drag */}
        <AnimatePresence 
          mode="wait"
          initial={false}
          onExitComplete={() => {
            setCurrentIndex(prev => prev + 1);
            exitDirectionRef.current = null;
            setExitDirection(null);
            x.set(0);
            setIsCardVisible(true);
          }}
        >
          {currentDog && isCardVisible && (
            <motion.div
              key={currentDog.id}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
              initial={{ x: 0, rotate: 0, opacity: 1 }}
              style={{
                x,
                rotate,
                opacity,
                zIndex: 1,
              }}
              drag={exitDirection ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.8}
              dragMomentum={false}
              dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              onClick={() => {
                if (!isDragging && !exitDirection) {
                  sessionStorage.setItem('dogProfileReferrer', 'foster');
                  setLocation(`/dogs/${currentDog.id}`);
                }
              }}
              exit={{
                x: exitDirectionRef.current === "right" ? 500 : -500,
                rotate: exitDirectionRef.current === "right" ? 25 : -25,
                opacity: 0,
              }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 25,
                mass: 1,
              }}
            >
              {/* Swipe Indicators */}
              <motion.div
                className="absolute top-8 sm:top-12 right-6 sm:right-10 z-10 pointer-events-none select-none"
                style={{ opacity: likeOpacity, scale: likeScale }}
              >
                <div className="border-[5px] sm:border-[7px] border-emerald-500 text-emerald-500 font-black text-4xl sm:text-6xl px-5 sm:px-6 py-2 sm:py-3 rotate-[22deg] rounded-lg uppercase tracking-[0.15em] shadow-[0_0_40px_rgba(16,185,129,0.6)]" style={{ textShadow: '0 0 20px rgba(16,185,129,0.5)' }}>
                  LIKE
                </div>
              </motion.div>

              <motion.div
                className="absolute top-8 sm:top-12 left-6 sm:left-10 z-10 pointer-events-none select-none"
                style={{ opacity: nopeOpacity, scale: nopeScale }}
              >
                <div className="border-[5px] sm:border-[7px] border-red-500 text-red-500 font-black text-4xl sm:text-6xl px-5 sm:px-6 py-2 sm:py-3 -rotate-[22deg] rounded-lg uppercase tracking-[0.15em] shadow-[0_0_40px_rgba(239,68,68,0.6)]" style={{ textShadow: '0 0 20px rgba(239,68,68,0.5)' }}>
                  NOPE
                </div>
              </motion.div>

              <DogCard dog={currentDog as any} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls - Same as adopt mode with nav clearance */}
      <div className="mt-4 sm:mt-6 mb-20 md:mb-6 flex items-center justify-center gap-4 sm:gap-6 z-10 px-4">
        {currentDog && (
          <>
            <button
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-white dark:bg-card border-2 border-red-400/50 shadow-lg flex items-center justify-center btn-press action-glow icon-bounce disabled:opacity-50"
              onClick={() => handleSwipe("left")}
              disabled={!!exitDirection}
              data-testid="button-pass-foster"
              title="Pass (Left Arrow)"
            >
              <X className="w-7 h-7 sm:w-8 sm:h-8 text-red-500" strokeWidth={3} />
            </button>

            <button
              className="h-18 w-18 sm:h-20 sm:w-20 rounded-full action-btn-like flex items-center justify-center btn-press action-glow icon-bounce disabled:opacity-50"
              style={{ width: '4.5rem', height: '4.5rem' }}
              onClick={() => handleSwipe("right")}
              disabled={!!exitDirection}
              data-testid="button-foster-interest"
              title="Like (Right Arrow)"
            >
              <Heart className="w-9 h-9 sm:w-10 sm:h-10 text-white fill-white" strokeWidth={2} />
            </button>

            <button
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-white dark:bg-card border-2 border-primary/50 shadow-lg flex items-center justify-center btn-press action-glow icon-bounce disabled:opacity-50"
              onClick={() => {
                setSelectedDog(currentDog);
                setShowOfferDialog(true);
              }}
              data-testid="button-message-foster"
              title="Message"
            >
              <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-primary" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {/* Foster Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={(open) => {
        setShowOfferDialog(open);
        if (!open) {
          setOfferMessage("");
          setSelectedDog(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              Offer to Foster {selectedDog?.name}
            </DialogTitle>
            <DialogDescription>
              Send a message to the owner explaining why you'd like to foster their dog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Hi! I'd love to help by fostering your dog. I have experience with..."
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-foster-message"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleOfferSubmit}
              disabled={!offerMessage.trim()}
              data-testid="button-send-foster-offer"
            >
              Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
