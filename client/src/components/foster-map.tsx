import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MapPin, 
  Navigation, 
  Users, 
  Heart, 
  SlidersHorizontal,
  Home,
  PawPrint,
  Scale,
  Clock,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FosterRequestDialog } from "./foster-request-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import Header from "@/components/header";
import type { FosterProfile, UserProfile } from "@shared/schema";
import { getMarkerImageUrl } from "@/components/ui/optimized-image";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface FosterFilters {
  radius: string;
  size: string[];
  specialNeeds: boolean;
}

export function FosterMap() {
  const { toast } = useToast();
  const [selectedFoster, setSelectedFoster] = useState<FosterProfile | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [filters, setFilters] = useState<FosterFilters>({
    radius: "200",
    size: [],
    specialNeeds: false,
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
    if (filters.specialNeeds) {
      params.append("specialNeeds", "true");
    }
    return params.toString();
  };

  const { data: fosters, isLoading } = useQuery<FosterProfile[]>({
    queryKey: ["/api/fosters/discover", filters],
    queryFn: async () => {
      const response = await fetch(`/api/fosters/discover?${buildQueryString()}`);
      if (!response.ok) throw new Error("Failed to fetch fosters");
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
    if (!mapRef.current || !fosters) return;

    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};

    fosters.forEach(foster => {
      if (!foster.latitude || !foster.longitude) return;

      const initials = `${foster.firstName?.[0] || ""}${foster.lastName?.[0] || ""}`.toUpperCase() || "F";
      const displayName = [foster.firstName, foster.lastName].filter(Boolean).join(" ") || "Foster";
      const hasAvailability = ((foster.fosterCapacity || 1) - (foster.fosterCurrentCount || 0)) > 0;

      // Avatar-style marker design for foster volunteers (with optimized images for cellular)
      const optimizedProfileImage = foster.profileImage ? getMarkerImageUrl(foster.profileImage) : null;
      const fosterIcon = L.divIcon({
        className: 'custom-foster-marker',
        html: `
          <div class="relative group">
            <div class="w-16 h-16 rounded-full overflow-hidden shadow-2xl border-4 border-primary cursor-pointer transition-all duration-300 group-hover:scale-125 group-hover:shadow-3xl group-hover:z-50 relative bg-gradient-to-br from-primary/20 to-primary/5">
              ${optimizedProfileImage 
                ? `
                  <div class="absolute inset-0 flex items-center justify-center bg-muted">
                    <div class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  </div>
                  <img src="${optimizedProfileImage}" alt="${displayName}" loading="lazy" class="w-full h-full object-cover group-hover:brightness-110 relative z-10" style="image-rendering: auto;" onload="this.previousElementSibling.style.display='none'" />`
                : `<div class="w-full h-full flex items-center justify-center text-2xl font-bold text-primary">${initials}</div>`
              }
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"></div>
              <div class="absolute bottom-1 left-1 right-1 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center truncate px-1 z-20">${displayName}</div>
            </div>
            ${hasAvailability ? `
              <div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-white text-xs font-bold shadow-lg whitespace-nowrap bg-green-500">
                Available
              </div>
            ` : ''}
            <div class="absolute -top-2 -right-2 bg-gradient-to-br from-rose-500 to-pink-600 text-white text-xs font-bold w-8 h-8 rounded-full shadow-xl flex items-center justify-center border-2 border-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [64, 64],
        iconAnchor: [32, 64],
      });

      const marker = L.marker([foster.latitude, foster.longitude], { icon: fosterIcon })
        .addTo(mapRef.current!);

      marker.on('click', () => {
        setSelectedFoster(foster);
      });

      markersRef.current[foster.id.toString()] = marker;
    });
  }, [fosters]);

  const toggleSizeFilter = (size: string) => {
    setFilters(prev => ({
      ...prev,
      size: prev.size.includes(size)
        ? prev.size.filter(s => s !== size)
        : [...prev.size, size],
    }));
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Not supported",
        description: "Geolocation is not supported by your browser",
        variant: "destructive"
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(newLocation);
        if (mapRef.current) {
          mapRef.current.setView([newLocation.lat, newLocation.lng], 11);
        }
      },
      () => {
        toast({
          title: "Location error",
          description: "Unable to get your location",
          variant: "destructive"
        });
      }
    );
  };

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
            <Users className="w-4 h-4 text-muted-foreground" />
            {!isLoading && fosters && fosters.length > 0 && (
              <p className="text-sm text-muted-foreground">{fosters.length} foster volunteers nearby</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCurrentLocation}
            data-testid="button-foster-map-location"
            className="h-10 md:h-8 min-w-[44px]"
            title="Find my location"
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
                onValueChange={v => setFilters({ ...filters, radius: v })}
              >
                <SelectTrigger data-testid="select-map-radius">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
                  <SelectItem value="100">100 miles</SelectItem>
                  <SelectItem value="200">200 miles</SelectItem>
                  <SelectItem value="500">Statewide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Size Preference */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Dog Size Preference</Label>
              <div className="space-y-2">
                {["small", "medium", "large", "xl"].map(size => (
                  <div key={size} className="flex items-center space-x-2">
                    <Checkbox
                      id={`size-${size}`}
                      checked={filters.size.includes(size)}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          size: checked
                            ? [...prev.size, size]
                            : prev.size.filter(s => s !== size)
                        }));
                      }}
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

            {/* Special Needs */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Special Abilities</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="special-needs"
                  checked={filters.specialNeeds}
                  onCheckedChange={(checked) => {
                    setFilters(prev => ({ ...prev, specialNeeds: checked as boolean }));
                  }}
                />
                <Label
                  htmlFor="special-needs"
                  className="text-sm font-normal cursor-pointer"
                >
                  Can handle special needs dogs
                </Label>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Map Area - matches adopt mode */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading foster volunteers...</p>
            </div>
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="absolute inset-0 z-0"
          style={{ height: '100%', width: '100%' }}
          data-testid="foster-map-container"
        />
      </div>

      {/* Selected Foster Bottom Sheet - matches adopt mode card positioning */}
      {selectedFoster && (
        <div className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-0 md:left-auto md:right-auto md:translate-x-0 z-[1000] md:max-w-2xl md:mx-auto md:mb-4">
          <Card className="shadow-lg">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg">Foster Volunteer</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedFoster.city}, {selectedFoster.state}
                    {selectedFoster.distance && ` (${selectedFoster.distance.toFixed(1)} mi)`}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSelectedFoster(null)}
                  data-testid="button-close-foster-card"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {selectedFoster.homeType && (
                  <Badge variant="secondary" className="text-xs">
                    <Home className="w-3 h-3 mr-1" />
                    {selectedFoster.homeType}
                  </Badge>
                )}
                {selectedFoster.fosterSizePreference && (
                  <Badge variant="secondary" className="text-xs">
                    <Scale className="w-3 h-3 mr-1" />
                    {selectedFoster.fosterSizePreference.join(", ")}
                  </Badge>
                )}
                {selectedFoster.fosterTimeCommitment && (
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {selectedFoster.fosterTimeCommitment}
                  </Badge>
                )}
              </div>

              {selectedFoster.fosterSpecialNeedsWilling && (
                <Badge variant="outline" className="text-xs mb-3">
                  <Heart className="w-3 h-3 mr-1 text-rose-500" />
                  Accepts special needs dogs
                </Badge>
              )}

              <Button 
                className="w-full"
                onClick={() => setShowRequestDialog(true)}
                data-testid="button-request-foster"
              >
                Request Foster Help
              </Button>
            </CardContent>
          </Card>
        </div>
      )}


      {selectedFoster && (
        <FosterRequestDialog
          open={showRequestDialog}
          onOpenChange={setShowRequestDialog}
          foster={selectedFoster}
        />
      )}
    </div>
  );
}
