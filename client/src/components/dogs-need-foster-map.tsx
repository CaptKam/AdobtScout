import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MapPin, 
  Navigation, 
  Heart, 
  SlidersHorizontal,
  Clock,
  AlertTriangle,
  Zap,
  X
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/header";
import type { UserProfile } from "@shared/schema";
import { getMarkerImageUrl } from "@/components/ui/optimized-image";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

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
  latitude: number;
  longitude: number;
  distance: number;
  ownerName: string;
  ownerCity?: string;
  ownerState?: string;
  city?: string;
  state?: string;
}

interface FosterFilters {
  radius: string;
  size: string[];
  urgency: string[];
}

export function DogsNeedFosterMap() {
  const { toast } = useToast();
  const [selectedDog, setSelectedDog] = useState<DogNeedingFoster | null>(null);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerMessage, setOfferMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [filters, setFilters] = useState<FosterFilters>({
    radius: "50",
    size: [],
    urgency: [],
  });

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const buildQueryString = () => {
    const params = new URLSearchParams();
    params.append("radius", filters.radius);
    if (filters.size.length > 0) {
      params.append("size", filters.size.join(","));
    }
    if (filters.urgency.length > 0) {
      params.append("urgency", filters.urgency.join(","));
    }
    return params.toString();
  };

  const { data: dogs, isLoading } = useQuery<DogNeedingFoster[]>({
    queryKey: ["/api/dogs/need-foster", filters],
    queryFn: async () => {
      const response = await fetch(`/api/dogs/need-foster?${buildQueryString()}`);
      if (!response.ok) throw new Error("Failed to fetch dogs");
      return response.json();
    },
  });

  useEffect(() => {
    if (profile?.latitude && profile?.longitude) {
      setUserLocation({
        lat: profile.latitude,
        lng: profile.longitude
      });
    } else {
      setUserLocation({ lat: 30.2672, lng: -97.7431 });
    }
  }, [profile]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter = userLocation || { lat: 30.2672, lng: -97.7431 };
    
    mapRef.current = L.map(mapContainerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: 11,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap, CartoDB',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [userLocation]);

  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 11);
    }
  }, [userLocation]);

  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    // Same user marker design as adopt mode map
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="relative group">
          <div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white cursor-move hover:scale-110 transition-all duration-200 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          </div>
          <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg whitespace-nowrap">
            You
          </div>
        </div>
      `,
      iconSize: [56, 56],
      iconAnchor: [28, 28],
    });

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 2000 })
      .addTo(mapRef.current)
      .bindTooltip('<div class="text-center"><div class="font-bold">Your Location</div></div>', { permanent: false, direction: 'top', offset: [0, -20] });
  }, [userLocation]);

  useEffect(() => {
    if (!mapRef.current || !dogs) return;

    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    dogs.forEach(dog => {
      if (!dog.latitude || !dog.longitude) return;

      // For dogs needing foster from rehomers, show urgency based on urgencyLevel field
      const isUrgent = dog.urgencyLevel === 'urgent' || dog.urgencyLevel === 'critical';
      const urgencyColor = dog.urgencyLevel === 'critical' ? '#ef4444' : '#f97316';

      // Same photo marker design as adopt mode map (with optimized images for cellular)
      const optimizedPhotoUrl = getMarkerImageUrl(dog.photos?.[0] || '/placeholder-dog.jpg');
      const dogIcon = L.divIcon({
        className: 'custom-dog-marker',
        html: `
          <div class="relative group">
            ${isUrgent ? `
              <div class="absolute inset-0 w-20 h-20 rounded-full ${dog.urgencyLevel === 'critical' ? 'animate-ping' : 'animate-pulse'}" style="background-color: ${urgencyColor}; opacity: 0.5;"></div>
            ` : ''}
            <div class="w-20 h-20 rounded-full overflow-hidden shadow-2xl border-4 ${isUrgent ? '' : 'border-white dark:border-card'} cursor-pointer transition-all duration-300 group-hover:scale-125 group-hover:shadow-3xl group-hover:z-50 relative bg-muted" style="${isUrgent ? `border-color: ${urgencyColor};` : ''}">
              <div class="absolute inset-0 flex items-center justify-center bg-muted">
                <div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              </div>
              <img src="${optimizedPhotoUrl}" alt="${dog.name}" loading="lazy" class="w-full h-full object-cover group-hover:brightness-110 relative z-10" style="image-rendering: auto;" onload="this.previousElementSibling.style.display='none'" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"></div>
              <div class="absolute bottom-1 left-1 right-1 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center truncate px-1 z-20">${dog.name}</div>
            </div>
            ${isUrgent ? `
              <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-white text-xs font-bold shadow-lg whitespace-nowrap" style="background-color: ${urgencyColor};">
                ${dog.urgencyLevel === 'critical' ? 'CRITICAL' : 'URGENT'}
              </div>
            ` : ''}
            <div class="absolute -top-2 -right-2 bg-gradient-to-br from-primary to-primary/80 text-white text-xs font-bold w-8 h-8 rounded-full shadow-xl flex items-center justify-center border-2 border-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [80, 80],
        iconAnchor: [40, 80],
      });

      const marker = L.marker([dog.latitude, dog.longitude], { icon: dogIcon })
        .addTo(mapRef.current!)
        .on('click', () => {
          setSelectedDog(dog);
        });

      markersRef.current[dog.id] = marker;
    });
  }, [dogs]);

  const handleOfferClick = () => {
    setOfferMessage("");
    setShowOfferDialog(true);
  };

  const handleSubmitOffer = async () => {
    if (!selectedDog) return;

    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/foster-offers", {
        dogId: selectedDog.id,
        message: offerMessage,
      });

      toast({
        title: "Offer Sent!",
        description: `Your offer to foster ${selectedDog.name} has been sent to the owner.`,
      });

      setShowOfferDialog(false);
      setSelectedDog(null);
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/need-foster"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send offer",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSizeFilter = (size: string) => {
    setFilters(prev => ({
      ...prev,
      size: prev.size.includes(size)
        ? prev.size.filter(s => s !== size)
        : [...prev.size, size],
    }));
  };

  const toggleUrgencyFilter = (urgency: string) => {
    setFilters(prev => ({
      ...prev,
      urgency: prev.urgency.includes(urgency)
        ? prev.urgency.filter(u => u !== urgency)
        : [...prev.urgency, urgency],
    }));
  };

  const durationLabels: Record<string, string> = {
    short_term: "2-4 weeks",
    medium_term: "1-2 months",
    long_term: "2+ months",
  };

  const handleCurrentLocation = useCallback(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 11);
    }
  }, [userLocation]);

  if (isLoading && !userLocation) {
    return (
      <div className="h-full flex items-center justify-center">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with Filter Button - matches adopt mode */}
      <div className="relative">
        <Header 
          showFilterButton={true}
          onFilterClick={() => setShowFilters(true)}
        />
      </div>

      {/* Map Info Bar - matches adopt mode */}
      <div className="p-2 bg-card/50 border-b">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-muted-foreground" />
            {!isLoading && dogs && dogs.length > 0 && (
              <p className="text-sm text-muted-foreground">{dogs.length} dogs need foster near you</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCurrentLocation}
            data-testid="button-center-map"
            className="h-10 md:h-8 min-w-[44px]"
            title="Center on my location"
          >
            <Navigation className="w-4 h-4 md:w-3.5 md:h-3.5 mr-1.5" />
            <span className="text-xs hidden sm:inline">My Location</span>
          </Button>
        </div>
      </div>

      {/* Filter Sheet - matches adopt mode */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 mt-6">
            {/* Radius */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Search Radius</Label>
              <Select
                value={filters.radius}
                onValueChange={(value) => setFilters(prev => ({ ...prev, radius: value }))}
              >
                <SelectTrigger data-testid="select-map-radius">
                  <SelectValue placeholder="Radius" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 miles</SelectItem>
                  <SelectItem value="25">25 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
                  <SelectItem value="100">100 miles</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dog Size */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Dog Size</Label>
              <div className="space-y-2">
                {["small", "medium", "large", "xl"].map(size => (
                  <div key={size} className="flex items-center space-x-2">
                    <Checkbox
                      id={`size-${size}`}
                      checked={filters.size.includes(size)}
                      onCheckedChange={() => toggleSizeFilter(size)}
                    />
                    <Label
                      htmlFor={`size-${size}`}
                      className="text-sm font-normal cursor-pointer capitalize"
                    >
                      {size === 'xl' ? 'Extra Large' : size}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Urgency Level */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Urgency Level</Label>
              <div className="space-y-2">
                {["critical", "urgent", "normal"].map(urgency => (
                  <div key={urgency} className="flex items-center space-x-2">
                    <Checkbox
                      id={`urgency-${urgency}`}
                      checked={filters.urgency.includes(urgency)}
                      onCheckedChange={() => toggleUrgencyFilter(urgency)}
                    />
                    <Label
                      htmlFor={`urgency-${urgency}`}
                      className="text-sm font-normal cursor-pointer capitalize flex items-center gap-2"
                    >
                      <div className={`w-3 h-3 rounded-full ${
                        urgency === 'critical' ? 'bg-red-500' :
                        urgency === 'urgent' ? 'bg-orange-500' : 'bg-green-500'
                      }`} />
                      {urgency}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Map Area - matches adopt mode */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={mapContainerRef}
          className="absolute inset-0 z-0"
          style={{ height: '100%', width: '100%' }}
          data-testid="foster-dog-map"
        />

        {/* Urgency Legend - positioned consistently */}
        <div className="absolute bottom-4 left-4 z-[100]">
          <Card className="shadow-lg">
            <CardContent className="p-3 space-y-1">
              <p className="text-xs font-medium">Urgency</p>
              <div className="flex gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>Critical</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  <span>Urgent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>Normal</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Selected Dog Bottom Sheet - matches adopt mode card positioning */}
      {selectedDog && (
        <div className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-0 md:left-auto md:right-auto md:translate-x-0 z-[1000] md:max-w-2xl md:mx-auto md:mb-4">
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <img
                  src={selectedDog.photos?.[0] || "/placeholder-dog.jpg"}
                  alt={selectedDog.name}
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedDog.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedDog.breed}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 -mt-1 -mr-2"
                      onClick={() => setSelectedDog(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge 
                      className={
                        selectedDog.urgencyLevel === "critical" 
                          ? "bg-red-500 text-white" 
                          : selectedDog.urgencyLevel === "urgent"
                          ? "bg-orange-500 text-white"
                          : "bg-green-500/20 text-green-700"
                      }
                    >
                      {selectedDog.urgencyLevel === "critical" && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {selectedDog.urgencyLevel}
                    </Badge>
                    <Badge variant="secondary">
                      <MapPin className="w-3 h-3 mr-1" />
                      {selectedDog.distance} mi
                    </Badge>
                    {selectedDog.fosterDuration && (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        {durationLabels[selectedDog.fosterDuration] || selectedDog.fosterDuration}
                      </Badge>
                    )}
                  </div>
                  <Button 
                    className="w-full mt-3" 
                    size="sm"
                    onClick={handleOfferClick}
                    data-testid="button-offer-foster"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Offer to Foster
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Offer to Foster {selectedDog?.name}</DialogTitle>
            <DialogDescription>
              Send a message to the owner letting them know you'd like to help foster their dog.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDog && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <img
                  src={selectedDog.photos?.[0] || "/placeholder-dog.jpg"}
                  alt={selectedDog.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <h4 className="font-semibold">{selectedDog.name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedDog.breed}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedDog.fosterDuration && durationLabels[selectedDog.fosterDuration]}
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="map-message">Your Message (optional)</Label>
                <Textarea
                  id="map-message"
                  placeholder="Tell them about yourself and why you'd be a good foster..."
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  className="mt-1.5"
                  data-testid="input-map-offer-message"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowOfferDialog(false)}
              data-testid="button-cancel-map-offer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitOffer}
              disabled={isSubmitting}
              data-testid="button-submit-map-offer"
            >
              {isSubmitting ? "Sending..." : "Send Offer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
