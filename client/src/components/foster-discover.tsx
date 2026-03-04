import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FosterCard } from "./foster-card";
import { FosterRequestDialog } from "./foster-request-dialog";
import { 
  Users, 
  MapPin, 
  Search, 
  Heart,
  Filter,
  SlidersHorizontal
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FosterProfile } from "@shared/schema";

export function FosterDiscover() {
  const [selectedFoster, setSelectedFoster] = useState<FosterProfile | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [filters, setFilters] = useState({
    radius: "50",
    size: [] as string[],
    specialNeeds: false,
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

  const { data: fosters, isLoading, error, refetch } = useQuery<FosterProfile[]>({
    queryKey: ["/api/fosters/discover", filters],
    queryFn: async () => {
      const response = await fetch(`/api/fosters/discover?${buildQueryString()}`);
      if (!response.ok) throw new Error("Failed to fetch fosters");
      return response.json();
    },
  });

  const handleFosterClick = (foster: FosterProfile) => {
    setSelectedFoster(foster);
    setShowRequestDialog(true);
  };

  const toggleSizeFilter = (size: string) => {
    setFilters(prev => ({
      ...prev,
      size: prev.size.includes(size)
        ? prev.size.filter(s => s !== size)
        : [...prev.size, size],
    }));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/20">
        <div className="text-center space-y-6 max-w-md">
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center">
              <Users className="w-12 h-12 text-primary/60 animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold animate-fadeInUp">
              Finding foster volunteers...
            </h2>
            <p className="text-muted-foreground text-lg animate-fadeInUp pt-2" style={{ animationDelay: "0.1s" }}>
              Scout is searching for people who can help
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
              <Search className="w-12 h-12 text-destructive/50" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-2">Unable to Load Fosters</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              We couldn't load foster volunteers right now. This is usually temporary.
            </p>
          </div>
          <Button 
            onClick={() => refetch()} 
            data-testid="button-retry"
            className="btn-premium text-lg px-8 py-6"
            size="lg"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Find Foster Help
              </h1>
              <p className="text-sm text-muted-foreground">
                {fosters?.length || 0} foster volunteers near you
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Select
                value={filters.radius}
                onValueChange={v => setFilters({ ...filters, radius: v })}
              >
                <SelectTrigger className="w-[120px]" data-testid="select-radius">
                  <MapPin className="w-4 h-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 miles</SelectItem>
                  <SelectItem value="25">25 miles</SelectItem>
                  <SelectItem value="50">50 miles</SelectItem>
                  <SelectItem value="100">100 miles</SelectItem>
                </SelectContent>
              </Select>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" data-testid="button-filters">
                    <SlidersHorizontal className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filter Fosters</SheetTitle>
                    <SheetDescription>
                      Find fosters that match your dog's needs
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="space-y-6 py-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Dog Size</Label>
                      <p className="text-xs text-muted-foreground">
                        Filter by fosters who accept these sizes
                      </p>
                      <div className="space-y-2">
                        {["small", "medium", "large"].map(size => (
                          <div key={size} className="flex items-center gap-2">
                            <Checkbox
                              id={`size-${size}`}
                              checked={filters.size.includes(size)}
                              onCheckedChange={() => toggleSizeFilter(size)}
                            />
                            <Label htmlFor={`size-${size}`} className="text-sm font-normal capitalize">
                              {size}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Special Requirements</Label>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="specialNeeds"
                          checked={filters.specialNeeds}
                          onCheckedChange={c => setFilters({ ...filters, specialNeeds: !!c })}
                        />
                        <Label htmlFor="specialNeeds" className="text-sm font-normal">
                          Only show fosters willing to care for special needs dogs
                        </Label>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {filters.size.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {filters.size.map(size => (
                <Badge 
                  key={size} 
                  variant="secondary" 
                  className="cursor-pointer"
                  onClick={() => toggleSizeFilter(size)}
                >
                  {size}
                  <span className="ml-1">×</span>
                </Badge>
              ))}
              {filters.specialNeeds && (
                <Badge 
                  variant="secondary" 
                  className="cursor-pointer"
                  onClick={() => setFilters({ ...filters, specialNeeds: false })}
                >
                  Special needs
                  <span className="ml-1">×</span>
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!fosters || fosters.length === 0 ? (
          <div className="h-full flex items-center justify-center px-4 bg-gradient-to-b from-background via-background to-muted/20">
            <div className="text-center space-y-6 max-w-md animate-fadeInUp">
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center group hover-elevate">
                  <Users className="w-12 h-12 text-primary/50 group-hover:scale-110 transition-transform" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold mb-2">No Foster Volunteers Found</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  We couldn't find any foster volunteers in your area. 
                  Try expanding your search radius.
                </p>
              </div>
              <Button 
                onClick={() => setFilters({ radius: "100", size: [], specialNeeds: false })}
                className="btn-premium text-lg px-8 py-6"
                size="lg"
              >
                Expand Search
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fosters.map(foster => (
              <FosterCard 
                key={foster.id} 
                foster={foster} 
                onClick={() => handleFosterClick(foster)}
              />
            ))}
          </div>
        )}
      </div>

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
