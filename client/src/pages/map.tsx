import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, X, MessageCircle, Heart, Utensils, Syringe, Scissors, Cpu, GraduationCap, Brain, Package, Home, HelpCircle, Store, ExternalLink, Phone, Clock, Globe } from "lucide-react";
import type { UserProfile, AdvertiserLocationWithBusiness } from "@shared/schema";
import { useLocation } from "wouter";
import Header from "@/components/header";
import { FosterMap } from "@/components/foster-map";
import { DogsNeedFosterMap } from "@/components/dogs-need-foster-map";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { getMarkerImageUrl } from "@/components/ui/optimized-image";

// Fix for default marker icons in Leaflet (run once at module level)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Constants moved outside component to prevent re-creation on each render
const DEFAULT_CENTER: [number, number] = [30.2672, -97.7431]; // Austin
const DEFAULT_ZOOM = 11;
const EXPAND_ZOOM_THRESHOLD = 14;
const CIRCULAR_EXPANSION_RADIUS = 0.005; // ~500 meters
const MAX_EXPANDED_MARKERS = 8;

interface User {
  id: string;
  role: 'adopter' | 'shelter' | 'owner';
}

interface Filters {
  shelters: string[];
  breeds: string[];
  ageCategories: string[];
  sizes: string[];
  energyLevels: string[];
  goodWithKids: boolean;
  goodWithDogs: boolean;
  goodWithCats: boolean;
  resourceTypes: string[];
  showPetStores: boolean;
}

// Resource types with labels and icons
const RESOURCE_TYPES = [
  { id: 'food_pantry', label: 'Pet Food Pantry', icon: Utensils },
  { id: 'vaccinations', label: 'Vaccinations', icon: Syringe },
  { id: 'spay_neuter', label: 'Spay/Neuter', icon: Scissors },
  { id: 'microchipping', label: 'Microchipping', icon: Cpu },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'behavior_support', label: 'Behavior Support', icon: Brain },
  { id: 'supplies', label: 'Pet Supplies', icon: Package },
  { id: 'emergency_shelter', label: 'Emergency Shelter', icon: Home },
  { id: 'other', label: 'Other Services', icon: HelpCircle },
];

// Initial filters constant - moved outside to prevent recreation
const INITIAL_FILTERS: Filters = {
  shelters: [],
  breeds: [],
  ageCategories: [],
  sizes: [],
  energyLevels: [],
  goodWithKids: false,
  goodWithDogs: false,
  goodWithCats: false,
  resourceTypes: [],
  showPetStores: false,
};

// Helper to check if a dog is from a shelter (not owner/rehomer)
const isShelterDog = (shelterName: string | null | undefined): boolean => {
  return !!(shelterName && !shelterName.includes('(Owner)') && !shelterName.includes('(Rehoming)'));
};

// Seeded random for consistent compatibility scores based on dog ID
const seededRandom = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 70 + Math.abs(hash % 30); // 70-99
};

// Wrapper component that handles mode-based routing
export default function Map() {
  // Fetch current user to check authentication
  const { data: currentUser } = useQuery<User | null>({
    queryKey: ["/api/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  // Fetch user profile to check mode
  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!currentUser,
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
  if (currentUser && profile?.mode === 'rehome') {
    return <FosterMap />;
  }

  if (currentUser && profile?.mode === 'foster') {
    return <DogsNeedFosterMap />;
  }

  // Default: Adopt mode or guest users
  return <AdoptModeMap currentUser={currentUser} profile={profile} />;
}

// The original Map component, now only for adopt mode
function AdoptModeMap({ currentUser, profile }: { currentUser: User | null | undefined; profile: UserProfile | undefined }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedDog, setSelectedDog] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM);
  // Only track if we're in expanded mode to avoid re-rendering on every zoom change
  const isExpandedMode = zoomLevel >= EXPAND_ZOOM_THRESHOLD;
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylineLayerRef = useRef<L.LayerGroup | null>(null);
  const poiMarkersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const resourceMarkersRef = useRef<L.Marker[]>([]);
  const storeMarkersRef = useRef<L.Marker[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [selectedResource, setSelectedResource] = useState<any | null>(null);
  const [selectedStore, setSelectedStore] = useState<AdvertiserLocationWithBusiness | null>(null);
  const [shelterSearch, setShelterSearch] = useState("");
  const [breedSearch, setBreedSearch] = useState("");

  // Fetch lightweight shelter data for map markers (includes location + dog count)
  // This is cached and lightweight - used for shelter building markers
  const { data: mapShelters } = useQuery<any[]>({
    queryKey: ["/api/map/shelters"],
  });

  // Fetch only ready dogs for individual dog markers on the map
  const { data: allDogs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/map/dogs"],
  });

  // Fetch resources when resource type filters are selected
  const { data: resources } = useQuery<any[]>({
    queryKey: ["/api/resources/search", filters.resourceTypes],
    queryFn: async () => {
      const params = filters.resourceTypes.length > 0 
        ? `?types=${filters.resourceTypes.join(',')}` 
        : '';
      const res = await fetch(`/api/resources/search${params}`);
      if (!res.ok) throw new Error('Failed to fetch resources');
      return res.json();
    },
    enabled: filters.resourceTypes.length > 0,
  });

  // Fetch advertiser locations for pet stores when filter is enabled
  const { data: advertiserLocations } = useQuery<AdvertiserLocationWithBusiness[]>({
    queryKey: ["/api/map/advertisers"],
    enabled: filters.showPetStores,
  });

  // Fetch conversations for authenticated users to show unread counts
  const { data: conversations } = useQuery<any[]>({
    queryKey: ["/api/conversations"],
    enabled: !!currentUser && (currentUser.role === 'adopter' || currentUser.role === 'owner'),
  });

  // Add consistent compatibility scores using seeded random (prevents hydration mismatch)
  const dogs = useMemo(() => {
    if (!allDogs) return undefined;
    return allDogs.map((dog: any) => ({
      ...dog,
      compatibilityScore: dog.compatibilityScore || seededRandom(dog.id),
    }));
  }, [allDogs]);

  // Extract unique filter options from shelters and individual dogs
  const filterOptions = useMemo(() => {
    const shelterSet = new Set<string>();
    const breedSet = new Set<string>();
    const ageCategorySet = new Set<string>();
    const sizeSet = new Set<string>();
    const energyLevelSet = new Set<string>();

    // Add shelter names from mapShelters
    if (mapShelters) {
      for (const shelter of mapShelters) {
        if (shelter.shelterName) shelterSet.add(shelter.shelterName);
      }
    }

    // Add filter options from individual dogs
    if (dogs) {
      for (const dog of dogs) {
        if (dog.breed) breedSet.add(dog.breed);
        if (dog.ageCategory) ageCategorySet.add(dog.ageCategory);
        if (dog.size) sizeSet.add(dog.size);
        if (dog.energyLevel) energyLevelSet.add(dog.energyLevel);
      }
    }

    return {
      shelters: Array.from(shelterSet).sort(),
      breeds: Array.from(breedSet).sort(),
      ageCategories: Array.from(ageCategorySet).sort(),
      sizes: Array.from(sizeSet).sort(),
      energyLevels: Array.from(energyLevelSet).sort(),
    };
  }, [mapShelters, dogs]);

  // Apply filters to dogs
  const filteredDogs = useMemo(() => {
    if (!dogs) return undefined;

    const hasShelterFilter = filters.shelters.length > 0;
    const hasBreedFilter = filters.breeds.length > 0;
    const hasAgeFilter = filters.ageCategories.length > 0;
    const hasSizeFilter = filters.sizes.length > 0;
    const hasEnergyFilter = filters.energyLevels.length > 0;

    // Convert arrays to Sets for O(1) lookup when filters are active
    const shelterSet = hasShelterFilter ? new Set(filters.shelters) : null;
    const breedSet = hasBreedFilter ? new Set(filters.breeds) : null;
    const ageSet = hasAgeFilter ? new Set(filters.ageCategories) : null;
    const sizeSet = hasSizeFilter ? new Set(filters.sizes) : null;
    const energySet = hasEnergyFilter ? new Set(filters.energyLevels) : null;

    return dogs.filter((dog: any) => {
      if (!dog.isPublic) return false;
      if (shelterSet && !shelterSet.has(dog.shelterName)) return false;
      if (breedSet && !breedSet.has(dog.breed)) return false;
      if (ageSet && !ageSet.has(dog.ageCategory)) return false;
      if (sizeSet && !sizeSet.has(dog.size)) return false;
      if (energySet && !energySet.has(dog.energyLevel)) return false;
      if (filters.goodWithKids && !dog.goodWithKids) return false;
      if (filters.goodWithDogs && !dog.goodWithDogs) return false;
      if (filters.goodWithCats && !dog.goodWithCats) return false;
      return true;
    });
  }, [dogs, filters]);

  // Filter shelters based on shelter name filter
  const filteredShelters = useMemo(() => {
    if (!mapShelters) return [];
    if (filters.shelters.length === 0) return mapShelters;
    const shelterSet = new Set(filters.shelters);
    return mapShelters.filter((s: any) => shelterSet.has(s.shelterName));
  }, [mapShelters, filters.shelters]);

  // Like/swipe mutation
  const swipeMutation = useMutation({
    mutationFn: async (dogId: string) => {
      await apiRequest("POST", "/api/swipes", {
        dogId,
        direction: "right",
      });
    },
    onSuccess: (_, dogId) => {
      const dog = dogs?.find(d => d.id === dogId);
      toast({
        title: "Match!",
        description: `You liked ${dog?.name}! Check your matches.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/swipes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/liked"] });
      setSelectedDog(null);
    },
  });

  // Message/conversation mutation
  const messageMutation = useMutation({
    mutationFn: async (dogId: string) => {
      const response = await apiRequest("GET", `/api/conversations/${dogId}`);
      return response.json();
    },
    onSuccess: (conversation) => {
      setLocation(`/messages/${conversation.id}`);
    },
    onError: (error) => {
      console.error("Error starting conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Use profile location as single source of truth
  useEffect(() => {
    if (profile?.latitude && profile?.longitude) {
      setUserLocation({
        lat: profile.latitude,
        lng: profile.longitude
      });
    } else if (!currentUser) {
      // For guests without profile, use Austin as default
      setUserLocation({ lat: 30.2672, lng: -97.7431 });
    }
  }, [profile, currentUser]);

  // Mutation to update user location from dragging marker
  const updateLocationFromDragMutation = useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) => {
      await apiRequest("PATCH", "/api/profile", {
        latitude: coords.latitude,
        longitude: coords.longitude
      });
      return coords;
    },
    onSuccess: (coords) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
      toast({
        title: "Location Updated",
        description: `New location: ${coords.latitude.toFixed(4)}°N, ${coords.longitude.toFixed(4)}°W`
      });
    },
    onError: () => {
      toast({
        title: "Failed to update location",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  });

  // Mutation to update user location with browser geolocation - improved version
  const updateLocationMutation = useMutation({
    mutationFn: async () => {
      return new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by your browser"));
          return;
        }

        const timeoutId = setTimeout(() => {
          reject(new Error("Location request timed out"));
        }, 15000);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
          },
          (error) => {
            clearTimeout(timeoutId);
            let errorMessage = "Unable to get your location";

            switch (error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = "Location access denied. Please enable location permissions.";
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = "Location unavailable. Check your device settings.";
                break;
              case error.TIMEOUT:
                errorMessage = "Location request timed out. Please try again.";
                break;
            }

            reject(new Error(errorMessage));
          },
          { 
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });
    },
    onSuccess: async (coords) => {
      try {
        // Update profile with new location
        await apiRequest("PATCH", "/api/profile", {
          latitude: coords.latitude,
          longitude: coords.longitude
        });

        // Invalidate both profile and discover queries to sync all pages
        queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });

        toast({
          title: "Location Updated",
          description: `Accuracy: ${Math.round(coords.accuracy)} meters`
        });
      } catch (error) {
        toast({
          title: "Failed to save location",
          description: "Please try again.",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Location Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Initialize map (runs once)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    // Create a layer group for polylines (connector lines)
    polylineLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    setZoomLevel(map.getZoom());

    // Track zoom changes for circular marker expansion
    const handleZoomChange = () => setZoomLevel(map.getZoom());
    map.on('zoomend', handleZoomChange);

    return () => {
      map.off('zoomend', handleZoomChange);
      map.remove();
      mapRef.current = null;
      polylineLayerRef.current = null;
    };
  }, []);


  // Create a map of dogId to unread count (memoized for O(1) lookups)
  const unreadCountByDog = useMemo(() => {
    if (!conversations) return {};
    const map: Record<string, number> = {};
    for (const conv of conversations) {
      if (conv.dogId && conv.unreadCount > 0) {
        map[conv.dogId] = conv.unreadCount;
      }
    }
    return map;
  }, [conversations]);

  // Memoize shelter grouping by location - now using lightweight filteredShelters
  const sheltersByLocation = useMemo(() => {
    if (!filteredShelters || filteredShelters.length === 0) return {};
    
    const result: Record<string, any> = {};
    for (const shelter of filteredShelters) {
      if (!shelter.latitude || !shelter.longitude) continue;
      const locationKey = `${shelter.latitude},${shelter.longitude}`;
      if (!result[locationKey]) {
        result[locationKey] = shelter;
      }
    }
    return result;
  }, [filteredShelters]);

  // Memoize dog grouping by location for markers
  const dogsByLocation = useMemo(() => {
    if (!filteredDogs) return {};
    
    const groups: Record<string, typeof filteredDogs> = {};
    for (const dog of filteredDogs) {
      if (typeof dog.latitude !== 'number' || typeof dog.longitude !== 'number') continue;
      
      const groupKey = isShelterDog(dog.shelterName)
        ? dog.shelterName!
        : `individual-${dog.id}`;
      
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(dog);
    }
    return groups;
  }, [filteredDogs]);

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    // Create custom airplane icon for user location
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

    // Create draggable marker for user location
    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
      draggable: currentUser ? true : false,
      zIndexOffset: 2000, // Ensure user marker appears above everything
    }).addTo(mapRef.current);

    // Handle drag end to update location
    if (currentUser) {
      userMarker.on('dragend', function(e) {
        const position = e.target.getLatLng();
        updateLocationFromDragMutation.mutate({
          latitude: position.lat,
          longitude: position.lng
        });
      });

      // Add tooltip
      userMarker.bindTooltip(
        `<div class="text-center">
          <div class="font-bold">Your Location</div>
          <div class="text-xs">Drag to update</div>
        </div>`,
        { permanent: false, direction: 'top', offset: [0, -20] }
      );
    }

    userMarkerRef.current = userMarker;

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [userLocation, currentUser]);

  // Update resource markers when resource filters are active
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing resource markers whenever filters or resources change
    resourceMarkersRef.current.forEach(marker => marker.remove());
    resourceMarkersRef.current = [];

    // Exit early if no resource types selected or no resources found
    if (filters.resourceTypes.length === 0 || !resources || resources.length === 0) return;

    // Group resources by shelter location
    const shelterResources: Record<string, { shelter: any; resources: any[] }> = {};
    for (const resource of resources) {
      if (!resource.shelter?.latitude || !resource.shelter?.longitude) continue;
      const key = resource.shelter.id;
      if (!shelterResources[key]) {
        shelterResources[key] = { shelter: resource.shelter, resources: [] };
      }
      shelterResources[key].resources.push(resource);
    }

    // Create markers for each shelter with resources
    Object.values(shelterResources).forEach(({ shelter, resources: shelterResourceList }) => {
      const resourceTypeLabels = shelterResourceList.map(r => {
        const type = RESOURCE_TYPES.find(t => t.id === r.resourceType);
        return type?.label || r.resourceType;
      }).join(', ');

      const icon = L.divIcon({
        className: 'custom-resource-marker',
        html: `
          <div class="relative group" style="z-index: 900;">
            <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-xl border-3 border-white cursor-pointer hover:scale-110 transition-all duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
              </svg>
            </div>
            ${shelterResourceList.length > 1 ? `
              <div class="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold shadow-md">
                ${shelterResourceList.length}
              </div>
            ` : ''}
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });

      const marker = L.marker([shelter.latitude, shelter.longitude], { icon })
        .addTo(mapRef.current!);

      marker.bindPopup(`
        <div class="p-2 min-w-48">
          <h3 class="font-bold text-base mb-1">${shelter.name}</h3>
          <p class="text-xs text-gray-600 mb-2">${shelter.address || `${shelter.city}, ${shelter.state}`}</p>
          <div class="border-t pt-2">
            <p class="text-xs font-semibold text-emerald-600 mb-1">Available Resources:</p>
            <p class="text-xs">${resourceTypeLabels}</p>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedResource({ shelter, resources: shelterResourceList });
      });

      resourceMarkersRef.current.push(marker);
    });

    return () => {
      resourceMarkersRef.current.forEach(marker => marker.remove());
      resourceMarkersRef.current = [];
    };
  }, [resources, filters.resourceTypes]);

  // Update store markers when pet stores filter is active
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing store markers
    storeMarkersRef.current.forEach(marker => marker.remove());
    storeMarkersRef.current = [];

    // Exit early if filter not enabled or no locations
    if (!filters.showPetStores || !advertiserLocations || advertiserLocations.length === 0) return;

    // Create markers for each store location
    advertiserLocations.forEach((location) => {
      if (!location.latitude || !location.longitude) return;

      const icon = L.divIcon({
        className: 'custom-store-marker',
        html: `
          <div class="relative group" style="z-index: 850;">
            <div class="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-xl border-3 border-white cursor-pointer hover:scale-110 transition-all duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
                <path d="M2 7h20"/>
                <path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>
              </svg>
            </div>
            ${location.isFeatured ? `
              <div class="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
            ` : ''}
            <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-lg">
              ${location.advertiser?.name || 'Pet Store'} - ${location.name}
            </div>
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });

      const marker = L.marker([location.latitude, location.longitude], { icon })
        .addTo(mapRef.current!);

      marker.on('click', () => {
        setSelectedStore(location);
      });

      storeMarkersRef.current.push(marker);
    });

    return () => {
      storeMarkersRef.current.forEach(marker => marker.remove());
      storeMarkersRef.current = [];
    };
  }, [advertiserLocations, filters.showPetStores]);

  // Update markers when data changes (uses memoized groupings)
  useEffect(() => {
    if (!mapRef.current || !filteredDogs) return;

    // Clear existing markers and polylines
    Object.values(markersRef.current).forEach(marker => marker.remove());
    markersRef.current = {};
    poiMarkersRef.current.forEach(marker => marker.remove());
    poiMarkersRef.current = [];
    polylineLayerRef.current?.clearLayers();

    const showExpandedCard = isExpandedMode;

    // Add shelter markers using memoized grouping
    for (const shelter of Object.values(sheltersByLocation)) {
      const hasMultipleDogs = shelter.dogCount > 1;

      const icon = L.divIcon({
        className: 'custom-shelter-marker',
        html: `
          <div class="relative group" style="z-index: 1000;">
            <div class="w-20 h-20 bg-gradient-to-br from-[#FF6B35] via-[#F7931E] to-[#C85A28] rounded-full flex items-center justify-center border-4 border-white cursor-pointer hover:scale-110 transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 64 64" fill="none">
                <defs>
                  <linearGradient id="buildingGrad-${shelter.id}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:rgba(255,255,255,0.98);stop-opacity:1" />
                    <stop offset="100%" style="stop-color:rgba(255,255,255,0.92);stop-opacity:1" />
                  </linearGradient>
                </defs>
                <g>
                  <path d="M 32 14 L 16 24 L 16 50 L 48 50 L 48 24 Z" fill="url(#buildingGrad-${shelter.id})" stroke="rgba(255,255,255,0.4)" stroke-width="1"/>
                  <path d="M 32 14 L 12 26 L 52 26 Z" fill="white" opacity="0.96"/>
                  <rect x="38" y="16" width="3" height="6" rx="0.5" fill="white" opacity="0.92"/>
                  <rect x="28" y="38" width="8" height="12" rx="1.5" fill="rgba(255,107,53,0.25)"/>
                  <path d="M 28 42 Q 32 39, 36 42" stroke="rgba(255,107,53,0.3)" stroke-width="0.5" fill="none"/>
                  <rect x="20" y="30" width="5" height="5" rx="0.8" fill="rgba(255,107,53,0.22)"/>
                  <rect x="39" y="30" width="5" height="5" rx="0.8" fill="rgba(255,107,53,0.22)"/>
                  <rect x="20" y="39" width="5" height="5" rx="0.8" fill="rgba(255,107,53,0.22)"/>
                  <rect x="39" y="39" width="5" height="5" rx="0.8" fill="rgba(255,107,53,0.22)"/>
                  <line x1="22.5" y1="30" x2="22.5" y2="35" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>
                  <line x1="20" y1="32.5" x2="25" y2="32.5" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>
                  <line x1="41.5" y1="30" x2="41.5" y2="35" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>
                  <line x1="39" y1="32.5" x2="44" y2="32.5" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>
                </g>
                <path d="M 32 18 C 32 18, 30.5 16.5, 29 16.5 C 27.5 16.5, 26.5 17.5, 26.5 19 C 26.5 20.8, 28 22.5, 32 25 C 36 22.5, 37.5 20.8, 37.5 19 C 37.5 17.5, 36.5 16.5, 35 16.5 C 33.5 16.5, 32 18, 32 18 Z" fill="#FF6B35" stroke="white" stroke-width="0.8" opacity="0.95"/>
                <ellipse cx="30" cy="18" rx="1.5" ry="1" fill="rgba(255,255,255,0.4)"/>
              </svg>
            </div>
            ${hasMultipleDogs ? `<div class="absolute -top-2 -right-2 bg-white text-[#FF6B35] text-sm font-bold w-8 h-8 rounded-full shadow-xl border-3 border-[#FF6B35] flex items-center justify-center">${shelter.dogCount}</div>` : `<div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-[#FF6B35] to-[#F7931E] text-white text-xs font-bold px-3 py-1 rounded-full shadow-xl whitespace-nowrap border-2 border-white">${shelter.dogCount} dog${shelter.dogCount === 1 ? '' : 's'}</div>`}
          </div>
        `,
        iconSize: [80, 80],
        iconAnchor: [40, 80],
      });

      const marker = L.marker([shelter.latitude, shelter.longitude], {
        icon,
        zIndexOffset: 1000,
      }).addTo(mapRef.current!);

      marker.on('click', () => setLocation(`/shelters/${shelter.id}`));
      marker.bindPopup(`<div class="p-2"><div class="font-bold text-base mb-1">${shelter.shelterName}</div><div class="text-sm text-gray-600 mb-2">${shelter.dogCount} dog${shelter.dogCount !== 1 ? 's' : ''} available</div><div class="text-xs text-gray-500">${shelter.location}</div></div>`);
      poiMarkersRef.current.push(marker);
    }

    // Add dog markers using memoized grouping
    for (const [, dogsAtLocation] of Object.entries(dogsByLocation)) {
      const baseLat = dogsAtLocation[0].latitude;
      const baseLng = dogsAtLocation[0].longitude;

      dogsAtLocation.forEach((dog, index) => {
        const unreadCount = unreadCountByDog[dog.id] || 0;
        const isDogFromShelter = isShelterDog(dog.shelterName);
        const isUrgent = isDogFromShelter && (dog.urgencyLevel === 'urgent' || dog.urgencyLevel === 'critical');
        const urgencyColor = dog.urgencyLevel === 'critical' ? '#ef4444' : '#f97316';

        // Calculate position (circular expansion only for multiple dogs at same location)
        let markerLat = dog.latitude;
        let markerLng = dog.longitude;
        const hasMultipleDogsAtLocation = dogsAtLocation.length > 1;
        const shouldExpand = showExpandedCard && hasMultipleDogsAtLocation && index < MAX_EXPANDED_MARKERS;
        
        if (shouldExpand) {
          // Spread dogs in a circle around their base location
          const angle = (index / Math.min(dogsAtLocation.length, MAX_EXPANDED_MARKERS)) * Math.PI * 2;
          markerLat = baseLat + Math.sin(angle) * CIRCULAR_EXPANSION_RADIUS;
          markerLng = baseLng + Math.cos(angle) * CIRCULAR_EXPANSION_RADIUS;
        }

        // Build icon HTML (shared structure, different anchors)
        const urgentOverlay = isUrgent ? `<div class="absolute inset-0 w-20 h-20 rounded-full ${dog.urgencyLevel === 'critical' ? 'animate-ping' : 'animate-pulse'}" style="background-color: ${urgencyColor}; opacity: 0.5;"></div>` : '';
        const urgentBadge = isUrgent ? `<div class="absolute -bottom-2 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full text-white text-xs font-bold shadow-lg whitespace-nowrap" style="background-color: ${urgencyColor};">${dog.urgencyLevel === 'critical' ? 'CRITICAL' : 'URGENT'}</div>` : '';
        const unreadBadge = unreadCount > 0 ? `<div class="absolute -top-2 -right-2 bg-gradient-to-br from-primary to-primary/80 text-white text-xs font-bold w-8 h-8 rounded-full shadow-xl flex items-center justify-center border-3 border-white">${unreadCount}</div>` : '';

        const optimizedPhotoUrl = getMarkerImageUrl(dog.photos[0]);
        const iconHtml = `
          <div class="relative group">
            ${urgentOverlay}
            <div class="w-20 h-20 rounded-full overflow-hidden shadow-2xl border-4 ${isUrgent ? '' : 'border-white dark:border-card'} cursor-pointer transition-all duration-300 group-hover:scale-125 group-hover:shadow-3xl group-hover:z-50 relative bg-muted" style="${isUrgent ? `border-color: ${urgencyColor};` : ''}">
              <div class="absolute inset-0 flex items-center justify-center bg-muted">
                <div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              </div>
              <img src="${optimizedPhotoUrl}" alt="${dog.name}" loading="lazy" class="w-full h-full object-cover group-hover:brightness-110 relative z-10" style="image-rendering: auto;" onload="this.previousElementSibling.style.display='none'" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"></div>
              <div class="absolute bottom-1 left-1 right-1 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center truncate px-1 z-20">${dog.name}</div>
            </div>
            ${urgentBadge}
            ${unreadBadge}
          </div>
        `;

        const customIcon = L.divIcon({
          className: shouldExpand ? 'expanded-dog-marker' : 'custom-dog-marker',
          html: iconHtml,
          iconSize: [80, 80],
          iconAnchor: shouldExpand ? [40, 40] : [40, 80],
        });

        const marker = L.marker([markerLat, markerLng], { icon: customIcon }).addTo(mapRef.current!);
        marker.on('click', () => {
          sessionStorage.setItem('dogProfileReferrer', 'map');
          setLocation(`/dogs/${dog.id}`);
        });

        // Draw connector line for expanded markers
        if (shouldExpand && polylineLayerRef.current) {
          L.polyline([[baseLat, baseLng], [markerLat, markerLng]], {
            color: '#999',
            weight: 1,
            opacity: 0.4,
            dashArray: '2, 3',
          }).addTo(polylineLayerRef.current);
        }

        markersRef.current[dog.id] = marker;
      });
    }
  }, [filteredDogs, sheltersByLocation, dogsByLocation, unreadCountByDog, isExpandedMode, setLocation]);

  // Center map on user location whenever it changes (initial load or after update)
  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 11);
    }
  }, [userLocation]);

  // Pan to selected dog marker
  useEffect(() => {
    if (!selectedDog || !markersRef.current[selectedDog]) return;

    const marker = markersRef.current[selectedDog];

    // Pan to marker
    if (mapRef.current) {
      mapRef.current.panTo(marker.getLatLng());
    }
  }, [selectedDog]);

  const handleCurrentLocation = useCallback(() => {
    if (!currentUser) {
      toast({
        title: "Sign in required",
        description: "Please sign in to update your location.",
        variant: "destructive"
      });
      return;
    }
    updateLocationMutation.mutate();
  }, [currentUser, toast, updateLocationMutation]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with Filter Button */}
      <div className="relative">
        <Header 
          showFilterButton={true}
          onFilterClick={() => setShowFilters(true)}
        />
      </div>
      {/* Map Info Bar */}
      <div className="p-2 bg-card/50 border-b">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            {!isLoading && filteredDogs && filteredDogs.length > 0 && (
              <p className="text-sm text-muted-foreground">{filteredDogs.length} dogs nearby</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCurrentLocation}
            data-testid="button-current-location"
            className="h-10 md:h-8 min-w-[44px]"
            disabled={updateLocationMutation.isPending}
            title="Find my location"
          >
            <Navigation className={`w-4 h-4 md:w-3.5 md:h-3.5 mr-1.5 ${updateLocationMutation.isPending ? 'animate-pulse' : ''}`} />
            <span className="text-xs hidden sm:inline">{updateLocationMutation.isPending ? 'Locating...' : 'My Location'}</span>
          </Button>
        </div>
      </div>
      {/* Filter Sheet - Now accessible via left side */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-hidden flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>Filters</SheetTitle>
              {(filters.shelters.length > 0 || filters.breeds.length > 0 || filters.ageCategories.length > 0 || filters.sizes.length > 0 || filters.energyLevels.length > 0 || filters.goodWithKids || filters.goodWithDogs || filters.goodWithCats || filters.resourceTypes.length > 0 || filters.showPetStores) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                  data-testid="button-clear-filters"
                  className="text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
            {(filters.shelters.length > 0 || filters.breeds.length > 0 || filters.ageCategories.length > 0 || filters.sizes.length > 0 || filters.energyLevels.length > 0 || filters.goodWithKids || filters.goodWithDogs || filters.goodWithCats || filters.resourceTypes.length > 0 || filters.showPetStores) && (
              <p className="text-xs text-muted-foreground mt-2">
                {filteredDogs?.length || 0} dogs match
                {filters.resourceTypes.length > 0 && resources && resources.length > 0 && ` | ${resources.length} resources`}
                {filters.showPetStores && advertiserLocations && advertiserLocations.length > 0 && ` | ${advertiserLocations.length} stores`}
              </p>
            )}
          </SheetHeader>

          <Tabs defaultValue="pet" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 grid w-auto grid-cols-2 bg-muted">
              <TabsTrigger value="pet" className="text-xs">Pet</TabsTrigger>
              <TabsTrigger value="resources" className="text-xs">Resources</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              {/* Pet Filters Tab */}
              <TabsContent value="pet" className="space-y-5 px-6 pt-4 pb-6 m-0">
                {/* Shelters with Search */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Shelter</Label>
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search shelters..."
                      value={shelterSearch}
                      onChange={(e) => setShelterSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      data-testid="input-shelter-search"
                    />
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {filterOptions.shelters
                      .filter(s => s.toLowerCase().includes(shelterSearch.toLowerCase()))
                      .map(shelter => (
                        <div key={shelter} className="flex items-center space-x-2 mt-[1px] mb-[1px]">
                          <Checkbox
                            id={`shelter-${shelter}`}
                            checked={filters.shelters.includes(shelter)}
                            onCheckedChange={(checked) => {
                              setFilters(prev => ({
                                ...prev,
                                shelters: checked
                                  ? [...prev.shelters, shelter]
                                  : prev.shelters.filter(s => s !== shelter)
                              }));
                            }}
                            className="scale-75"
                          />
                          <Label htmlFor={`shelter-${shelter}`} className="text-xs font-normal cursor-pointer">
                            {shelter}
                          </Label>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Breeds with Search */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Breed</Label>
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search breeds..."
                      value={breedSearch}
                      onChange={(e) => setBreedSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                      data-testid="input-breed-search"
                    />
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {filterOptions.breeds
                      .filter(b => b.toLowerCase().includes(breedSearch.toLowerCase()))
                      .map(breed => (
                        <div key={breed} className="flex items-center space-x-2">
                          <Checkbox
                            id={`breed-${breed}`}
                            checked={filters.breeds.includes(breed)}
                            onCheckedChange={(checked) => {
                              setFilters(prev => ({
                                ...prev,
                                breeds: checked
                                  ? [...prev.breeds, breed]
                                  : prev.breeds.filter(b => b !== breed)
                              }));
                            }}
                            className="scale-75"
                          />
                          <Label htmlFor={`breed-${breed}`} className="text-xs font-normal cursor-pointer">
                            {breed}
                          </Label>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Age - Toggle Buttons */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Age</Label>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.ageCategories.map(age => (
                      <Button
                        key={age}
                        variant={filters.ageCategories.includes(age) ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            ageCategories: filters.ageCategories.includes(age)
                              ? prev.ageCategories.filter(a => a !== age)
                              : [...prev.ageCategories, age]
                          }));
                        }}
                        data-testid={`button-age-${age}`}
                      >
                        {age.charAt(0).toUpperCase() + age.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Size - Toggle Buttons */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Size</Label>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.sizes.map(size => (
                      <Button
                        key={size}
                        variant={filters.sizes.includes(size) ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7 px-2 capitalize"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            sizes: filters.sizes.includes(size)
                              ? prev.sizes.filter(s => s !== size)
                              : [...prev.sizes, size]
                          }));
                        }}
                        data-testid={`button-size-${size}`}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Energy Level - Toggle Buttons */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Energy</Label>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.energyLevels.map(level => (
                      <Button
                        key={level}
                        variant={filters.energyLevels.includes(level) ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7 px-2 capitalize"
                        onClick={() => {
                          setFilters(prev => ({
                            ...prev,
                            energyLevels: filters.energyLevels.includes(level)
                              ? prev.energyLevels.filter(e => e !== level)
                              : [...prev.energyLevels, level]
                          }));
                        }}
                        data-testid={`button-energy-${level}`}
                      >
                        {level.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Preferences */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Compatibility</Label>
                  <div className="space-y-1">
                    {[
                      { id: 'goodWithKids', label: 'Good with Kids' },
                      { id: 'goodWithDogs', label: 'Good with Dogs' },
                      { id: 'goodWithCats', label: 'Good with Cats' },
                    ].map(pref => (
                      <div key={pref.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={pref.id}
                          checked={filters[pref.id as keyof typeof filters] as boolean}
                          onCheckedChange={(checked) => {
                            setFilters(prev => ({ ...prev, [pref.id]: checked as boolean }));
                          }}
                          className="scale-75"
                        />
                        <Label htmlFor={pref.id} className="text-xs font-normal cursor-pointer">
                          {pref.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* Resources Tab */}
              <TabsContent value="resources" className="space-y-5 px-6 pt-4 pb-6 m-0">
                {/* Pet Stores */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <Checkbox
                      id="show-pet-stores"
                      checked={filters.showPetStores}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          showPetStores: !!checked
                        }));
                      }}
                      data-testid="checkbox-show-pet-stores"
                      className="scale-75"
                    />
                    <Label htmlFor="show-pet-stores" className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                      <Store className="w-4 h-4 text-purple-500" />
                      Pet Stores
                    </Label>
                  </div>
                  {filters.showPetStores && advertiserLocations && advertiserLocations.length > 0 && (
                    <p className="text-xs text-muted-foreground ml-6">
                      {advertiserLocations.length} store{advertiserLocations.length !== 1 ? 's' : ''} found
                    </p>
                  )}
                </div>

                {/* Community Resources */}
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Community Services</Label>
                  <div className="space-y-1">
                    {RESOURCE_TYPES.map(resource => {
                      const Icon = resource.icon;
                      return (
                        <div key={resource.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`resource-${resource.id}`}
                            checked={filters.resourceTypes.includes(resource.id)}
                            onCheckedChange={(checked) => {
                              setFilters(prev => ({
                                ...prev,
                                resourceTypes: checked
                                  ? [...prev.resourceTypes, resource.id]
                                  : prev.resourceTypes.filter(r => r !== resource.id)
                              }));
                            }}
                            data-testid={`checkbox-resource-${resource.id}`}
                            className="scale-75"
                          />
                          <Label htmlFor={`resource-${resource.id}`} className="text-xs font-normal cursor-pointer flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            {resource.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                  {filters.resourceTypes.length > 0 && resources && resources.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {resources.length} resource{resources.length !== 1 ? 's' : ''} found
                    </p>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={mapContainerRef}
          className="absolute inset-0 z-0"
          style={{ height: '100%', width: '100%' }}
        />

        {/* Selected Dog Bottom Sheet - Mobile Optimized (fixed on mobile, card on desktop) */}
        {selectedDog && filteredDogs && (
          <div className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-0 md:left-auto md:right-auto md:translate-x-0 z-[1000] md:max-w-2xl md:mx-auto md:mb-4">
            <Card className="bg-card shadow-2xl border-x-0 border-b-0 md:border-2 md:rounded-lg rounded-t-2xl rounded-b-none m-0 p-0 max-h-[90vh] md:max-h-none overflow-y-auto md:overflow-y-visible">
              <CardContent className="p-0 m-0">
                {(() => {
                  const dog = filteredDogs.find(d => d.id === selectedDog);
                  if (!dog) return null;
                  return (
                    <>
                      {/* Drag Handle - Tap to dismiss */}
                      <div
                        className="flex items-center justify-center py-3 cursor-pointer hover-elevate active-elevate-2 rounded-t-xl"
                        onClick={() => setSelectedDog(null)}
                        data-testid="button-dismiss-card"
                      >
                        <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
                      </div>

                      {/* Header with close button */}
                      <div className="flex items-center justify-between px-4 pb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/90">
                            {dog.compatibilityScore}% Match
                          </Badge>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setSelectedDog(null)}
                          className="h-8 w-8"
                          data-testid="button-close-card"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Profile Content */}
                      <div className="px-0 pt-0 pb-0">
                        {/* Photo Gallery - Full Width */}
                        <div className="relative mb-4">
                          <div className="aspect-video w-full overflow-hidden bg-muted">
                            <img
                              src={dog.photos[0]}
                              alt={dog.name}
                              className="w-full h-full object-cover cursor-pointer"
                              onClick={() => setLocation(`/dogs/${selectedDog}`)}
                            />
                          </div>
                          {dog.photos.length > 1 && (
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm">
                              {dog.photos.slice(0, 5).map((_: string, idx: number) => (
                                <div
                                  key={idx}
                                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                                    idx === 0 ? 'bg-white w-4' : 'bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Info Section */}
                        <div className="px-4">
                          <div className="mb-4">
                            <h3 className="font-bold text-2xl mb-1">{dog.name}, {dog.age}</h3>
                            <p className="text-sm text-muted-foreground mb-1">{dog.breed} • {dog.weight} lbs</p>
                            <p className="text-xs text-muted-foreground mb-3">{dog.shelterName}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {dog.temperament.slice(0, 3).map((trait: string, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-xs capitalize">
                                  {trait}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Quick Info */}
                        <div className="flex gap-2 mb-4 text-sm">
                          {dog.goodWithKids && (
                            <div className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full">
                              <span className="text-sm">👶</span>
                              <span className="text-xs font-medium">Kids</span>
                            </div>
                          )}
                          {dog.goodWithDogs && (
                            <div className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full">
                              <span className="text-sm">🐕</span>
                              <span className="text-xs font-medium">Dogs</span>
                            </div>
                          )}
                          {dog.goodWithCats && (
                            <div className="flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full">
                              <span className="text-sm">🐱</span>
                              <span className="text-xs font-medium">Cats</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons - Mobile touch targets 44x44px minimum */}
                        <div className="flex gap-3 mb-2 md:mb-0">
                          {currentUser && (
                            <Button
                              variant="outline"
                              className="flex-1 h-11 md:h-auto"
                              onClick={() => messageMutation.mutate(selectedDog)}
                              disabled={messageMutation.isPending}
                              data-testid="button-message"
                            >
                              <MessageCircle className="w-4 h-4 mr-2" />
                              {messageMutation.isPending ? "Opening..." : "Message"}
                            </Button>
                          )}
                          <Button
                            className="flex-1 h-11 md:h-auto"
                            onClick={() => swipeMutation.mutate(selectedDog)}
                            disabled={swipeMutation.isPending}
                            data-testid="button-like"
                          >
                            <Heart className="w-4 h-4 mr-2" />
                            {swipeMutation.isPending ? "Liking..." : "Like"}
                          </Button>
                        </div>

                        {/* Safe bottom padding on mobile to avoid nav bar overlap */}
                        <div className="h-4 md:h-0"></div>

                        {/* View Full Profile Link */}
                        <Button
                          variant="ghost"
                          className="w-full mt-2 mb-0 text-xs"
                          onClick={() => setLocation(`/dogs/${selectedDog}`)}
                        >
                          View Full Profile →
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Selected Store Detail Sheet */}
        {selectedStore && (
          <div className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-0 md:left-auto md:right-auto md:translate-x-0 z-[1000] md:max-w-md md:mx-auto md:mb-4">
            <Card className="bg-card shadow-2xl border-x-0 border-b-0 md:border-2 md:rounded-lg rounded-t-2xl rounded-b-none m-0 p-0 max-h-[80vh] overflow-y-auto">
              <CardContent className="p-0">
                <div className="flex justify-center py-2 md:hidden">
                  <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
                </div>

                <div className="flex items-center justify-between px-4 py-2">
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    <Store className="w-3 h-3 mr-1" />
                    Pet Store
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedStore(null)}
                    className="h-8 w-8"
                    data-testid="button-close-store-card"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {selectedStore.heroImageUrl && (
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={selectedStore.heroImageUrl}
                      alt={selectedStore.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="px-4 py-4">
                  <div className="flex items-start gap-3 mb-4">
                    {selectedStore.advertiser?.logoUrl ? (
                      <img 
                        src={selectedStore.advertiser.logoUrl} 
                        alt={selectedStore.advertiser.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Store className="w-6 h-6 text-purple-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{selectedStore.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedStore.advertiser?.name}</p>
                      {selectedStore.isFeatured && (
                        <Badge variant="outline" className="mt-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                          Featured Partner
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p>
                        {selectedStore.address}<br />
                        {selectedStore.city}, {selectedStore.state} {selectedStore.zipCode}
                      </p>
                    </div>

                    {selectedStore.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${selectedStore.phone}`} className="text-primary hover:underline">
                          {selectedStore.phone}
                        </a>
                      </div>
                    )}

                    {selectedStore.hours && (
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <p>{selectedStore.hours}</p>
                      </div>
                    )}

                    {selectedStore.services && selectedStore.services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {selectedStore.services.map((service, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs capitalize">
                            {service}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-4">
                    {selectedStore.advertiser?.website && (
                      <Button
                        variant="outline"
                        className="flex-1 h-11"
                        onClick={() => window.open(selectedStore.advertiser!.website!, '_blank')}
                        data-testid="button-store-website"
                      >
                        <Globe className="w-4 h-4 mr-2" />
                        Visit Website
                      </Button>
                    )}
                    {selectedStore.phone && (
                      <Button
                        className="flex-1 h-11"
                        onClick={() => window.open(`tel:${selectedStore.phone}`, '_self')}
                        data-testid="button-store-call"
                      >
                        <Phone className="w-4 h-4 mr-2" />
                        Call Store
                      </Button>
                    )}
                  </div>

                  <div className="h-4 md:h-0"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-[1000]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!filteredDogs || filteredDogs.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-[1000]">
            <div className="text-center p-6">
              <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-bold text-lg mb-2">No Pets Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No pets match your current filters.
              </p>
              <Button onClick={() => setFilters(INITIAL_FILTERS)}>
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}