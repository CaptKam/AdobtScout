import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShelterCheckbox } from "@/components/ui/shelter-checkbox";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormSection } from "@/components/form-templates";
import { DogFormDialog } from "@/components/dog-form-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Dog, IntakeRecord } from "@shared/schema";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Dog as DogIcon,
  Eye,
  Edit,
  Trash2,
  Syringe,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  Grid3x3,
  List,
  TableIcon,
  X,
  RefreshCw,
  EyeOff,
  Zap,
  SlidersHorizontal,
  PawPrint,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface DogWithIntake extends Dog {
  intake: IntakeRecord | null;
}

const PIPELINE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  intake: { label: "Intake", color: "bg-blue-500", icon: Clock },
  stray_hold: { label: "Stray Hold", color: "bg-yellow-500", icon: Clock },
  medical_hold: { label: "Medical Hold", color: "bg-red-500", icon: Syringe },
  behavior_eval: { label: "Behavior Eval", color: "bg-purple-500", icon: ClipboardList },
  pre_adoption_hold: { label: "Pre-Adoption Hold", color: "bg-pink-500", icon: Clock },
  ready: { label: "Ready", color: "bg-green-500", icon: CheckCircle },
  featured: { label: "Featured", color: "bg-orange-500", icon: CheckCircle },
  adopted: { label: "Adopted", color: "bg-emerald-600", icon: CheckCircle },
  transferred: { label: "Transferred", color: "bg-gray-500", icon: CheckCircle },
  returned_to_owner: { label: "Returned", color: "bg-slate-500", icon: CheckCircle },
  other: { label: "Other", color: "bg-gray-400", icon: Clock },
};

const SIZE_LABELS: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  xlarge: "Extra Large",
};

type ViewType = "grid" | "list" | "table";

export default function ShelterDogs() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sizeFilter, setSizeFilter] = useState<string>("all");
  const [animalTypeFilter, setAnimalTypeFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");
  const [breedFilter, setBreedFilter] = useState<string>("all");
  const [ageRange, setAgeRange] = useState<[number, number]>([0, 20]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dogToDelete, setDogToDelete] = useState<DogWithIntake | null>(null);
  const [selectedDogs, setSelectedDogs] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>("");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [dogFormDialogOpen, setDogFormDialogOpen] = useState(false);
  const [editDogId, setEditDogId] = useState<string | null>(null);
  const [editDogData, setEditDogData] = useState<DogWithIntake | null>(null);

  // Default to grid view on mobile, table on desktop
  const [viewType, setViewType] = useState<ViewType>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return "grid";
    }
    return "table";
  });

  const { data: dogs = [], isLoading } = useQuery<DogWithIntake[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  // Get unique breeds for filter
  const uniqueBreeds = useMemo(() => {
    const breeds = new Set(dogs.map(d => d.breed));
    return Array.from(breeds).sort();
  }, [dogs]);

  const deleteDogMutation = useMutation({
    mutationFn: async (dogId: string) => {
      return apiRequest("DELETE", `/api/shelter/dogs/${dogId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      toast({
        title: "Pet Removed",
        description: "The pet has been removed from your shelter.",
      });
      setDeleteDialogOpen(false);
      setDogToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove pet",
        variant: "destructive",
      });
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const dogIds = Array.from(selectedDogs);
      const updates: Record<string, any> = {};

      if (bulkAction === "urgencyLevel") updates.urgencyLevel = bulkValue;
      if (bulkAction === "approvalStatus") updates.approvalStatus = bulkValue;
      if (bulkAction === "isPublic") updates.isPublic = bulkValue === "true";
      if (bulkAction === "listingType") updates.listingType = bulkValue;

      return apiRequest("PATCH", "/api/shelter/bulk/dogs/status", { dogIds, updates });
    },
    onSuccess: () => {
      toast({ 
        title: "Pets Updated", 
        description: `Successfully updated ${selectedDogs.size} pets` 
      });
      setSelectedDogs(new Set());
      setBulkAction("");
      setBulkValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update pets", 
        variant: "destructive" 
      });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const dogIds = Array.from(selectedDogs);
      return apiRequest("DELETE", "/api/shelter/bulk/dogs", { dogIds });
    },
    onSuccess: () => {
      toast({ 
        title: "Pets Deleted", 
        description: `Successfully deleted ${selectedDogs.size} pets` 
      });
      setSelectedDogs(new Set());
      setBulkAction("");
      setShowBulkDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/intake"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete pets", 
        variant: "destructive" 
      });
      setShowBulkDeleteConfirm(false);
    },
  });

  const filteredDogs = dogs.filter((dog) => {
    const matchesSearch =
      dog.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dog.breed.toLowerCase().includes(searchQuery.toLowerCase());

    const pipelineStatus = dog.intake?.pipelineStatus || "ready";
    const matchesStatus = statusFilter === "all" || pipelineStatus === statusFilter;
    const matchesSize = sizeFilter === "all" || dog.size === sizeFilter;
    const matchesAnimalType = animalTypeFilter === "all" || dog.animalType === animalTypeFilter;
    const matchesUrgency = urgencyFilter === "all" || dog.urgencyLevel === urgencyFilter;
    const matchesVisibility = visibilityFilter === "all" || 
      (visibilityFilter === "public" && dog.isPublic) ||
      (visibilityFilter === "private" && !dog.isPublic);
    const matchesBreed = breedFilter === "all" || dog.breed === breedFilter;
    const matchesAge = dog.age >= ageRange[0] && dog.age <= ageRange[1];

    return matchesSearch && matchesStatus && matchesSize && matchesAnimalType && matchesUrgency && 
           matchesVisibility && matchesBreed && matchesAge;
  });

  // Check if any advanced filters are active
  const hasActiveFilters = urgencyFilter !== "all" || visibilityFilter !== "all" || 
    breedFilter !== "all" || ageRange[0] > 0 || ageRange[1] < 20;

  const activeFilterCount = [
    urgencyFilter !== "all",
    visibilityFilter !== "all",
    breedFilter !== "all",
    ageRange[0] > 0 || ageRange[1] < 20,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setStatusFilter("all");
    setSizeFilter("all");
    setAnimalTypeFilter("all");
    setUrgencyFilter("all");
    setVisibilityFilter("all");
    setBreedFilter("all");
    setAgeRange([0, 20]);
    setSearchQuery("");
  };

  const toggleSelectAll = () => {
    if (selectedDogs.size === filteredDogs.length) {
      setSelectedDogs(new Set());
    } else {
      setSelectedDogs(new Set(filteredDogs.map(d => d.id)));
    }
  };

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSet = new Set(selectedDogs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedDogs(newSet);
  };

  const getPipelineStatus = (dog: DogWithIntake) => {
    return dog.intake?.pipelineStatus || "ready";
  };

  const getStatusBadge = (status: string) => {
    const config = PIPELINE_STATUS_CONFIG[status] || PIPELINE_STATUS_CONFIG.ready;
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const dogCounts = {
    all: dogs.length,
    intake: dogs.filter((d) => getPipelineStatus(d) === "intake").length,
    medical_hold: dogs.filter((d) => getPipelineStatus(d) === "medical_hold").length,
    behavior_eval: dogs.filter((d) => getPipelineStatus(d) === "behavior_eval").length,
    ready: dogs.filter((d) => getPipelineStatus(d) === "ready").length,
    adopted: dogs.filter((d) => getPipelineStatus(d) === "adopted").length,
  };

  const handleDeleteClick = (dog: DogWithIntake) => {
    setDogToDelete(dog);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (dogToDelete) {
      deleteDogMutation.mutate(dogToDelete.id);
    }
  };

  return (
    
      <div className="p-4 md:p-6 space-y-6" data-testid="page-shelter-dogs">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <FormSection
              title="Pet Directory"
              description="Search, filter, and manage all your shelter's pets. For daily workflow, use Pipeline."
              icon={PawPrint}
              variant="ai"
            />
            <div className="mt-2">
              <Link href="/shelter/pipeline" className="text-sm text-primary underline hover:text-primary/80" data-testid="link-go-to-pipeline">
                Go to Pipeline for workflow management
              </Link>
            </div>
          </div>
          <Button 
            data-testid="button-add-pet"
            onClick={() => {
              setEditDogId(null);
              setDogFormDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Pet
          </Button>
        </div>

        {/* Quick Stats and Status Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-muted-foreground">Quick stats:</span>
            <Badge variant="secondary" className="font-normal">{dogCounts.all} total</Badge>
            <Badge variant="secondary" className="font-normal text-green-600">{dogCounts.ready} ready</Badge>
            <Badge variant="secondary" className="font-normal text-blue-600">{dogCounts.intake} intake</Badge>
            <Badge variant="secondary" className="font-normal text-yellow-600">{dogCounts.medical_hold} medical</Badge>
            <Badge variant="secondary" className="font-normal text-emerald-600">{dogCounts.adopted} adopted</Badge>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses ({dogCounts.all})</SelectItem>
              <SelectItem value="intake">Intake ({dogCounts.intake})</SelectItem>
              <SelectItem value="medical_hold">Medical Hold ({dogCounts.medical_hold})</SelectItem>
              <SelectItem value="behavior_eval">Behavior Eval ({dogCounts.behavior_eval})</SelectItem>
              <SelectItem value="ready">Ready ({dogCounts.ready})</SelectItem>
              <SelectItem value="adopted">Adopted ({dogCounts.adopted})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Edit Toolbar */}
        {selectedDogs.size > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <ShelterCheckbox
                    checked={selectedDogs.size === filteredDogs.length && filteredDogs.length > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all-toolbar"
                  />
                  <Badge variant="secondary" data-testid="badge-selected-count">
                    {selectedDogs.size} selected
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <Select value={bulkAction} onValueChange={(v) => { setBulkAction(v); setBulkValue(""); }}>
                    <SelectTrigger className="w-[160px]" data-testid="select-bulk-action">
                      <SelectValue placeholder="Bulk action..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgencyLevel">Set Urgency</SelectItem>
                      <SelectItem value="listingType">Set Listing Type</SelectItem>
                      <SelectItem value="isPublic">Set Visibility</SelectItem>
                      <SelectItem value="approvalStatus">Set Approval Status</SelectItem>
                      <SelectItem value="delete" className="text-destructive">Delete Pets</SelectItem>
                    </SelectContent>
                  </Select>

                  {bulkAction === "urgencyLevel" && (
                    <Select value={bulkValue} onValueChange={setBulkValue}>
                      <SelectTrigger className="w-[140px]" data-testid="select-bulk-urgency">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {bulkAction === "listingType" && (
                    <Select value={bulkValue} onValueChange={setBulkValue}>
                      <SelectTrigger className="w-[140px]" data-testid="select-bulk-listing">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adoptable">Adoptable</SelectItem>
                        <SelectItem value="foster">Foster</SelectItem>
                        <SelectItem value="medical_hold">Medical Hold</SelectItem>
                        <SelectItem value="behavioral_hold">Behavioral Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {bulkAction === "isPublic" && (
                    <Select value={bulkValue} onValueChange={setBulkValue}>
                      <SelectTrigger className="w-[140px]" data-testid="select-bulk-visibility">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Public</SelectItem>
                        <SelectItem value="false">Private</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {bulkAction === "approvalStatus" && (
                    <Select value={bulkValue} onValueChange={setBulkValue}>
                      <SelectTrigger className="w-[140px]" data-testid="select-bulk-approval">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {bulkAction && bulkAction !== "delete" && bulkValue && (
                    <Button 
                      onClick={() => bulkUpdateMutation.mutate()}
                      disabled={bulkUpdateMutation.isPending}
                      data-testid="button-apply-bulk"
                    >
                      {bulkUpdateMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Apply to {selectedDogs.size}
                    </Button>
                  )}

                  {bulkAction === "delete" && (
                    <Button 
                      variant="destructive"
                      onClick={() => setShowBulkDeleteConfirm(true)}
                      data-testid="button-bulk-delete"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete {selectedDogs.size} Pets
                    </Button>
                  )}
                </div>

                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setSelectedDogs(new Set()); setBulkAction(""); setBulkValue(""); }}
                  data-testid="button-clear-selection"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or breed..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-size-filter">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sizes</SelectItem>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
              <SelectItem value="xlarge">Extra Large</SelectItem>
            </SelectContent>
          </Select>

          {/* Animal Type Filter Dropdown */}
          <Select value={animalTypeFilter} onValueChange={setAnimalTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-animal-type-filter">
              <SelectValue placeholder="Animal Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="dog">Dogs</SelectItem>
              <SelectItem value="cat">Cats</SelectItem>
              <SelectItem value="rabbit">Rabbits</SelectItem>
              <SelectItem value="bird">Birds</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          {/* Advanced Filters Sheet */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative" data-testid="button-advanced-filters">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Advanced Filters</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-6">
                {/* Urgency Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Urgency Level</label>
                  <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                    <SelectTrigger data-testid="select-urgency-filter">
                      <SelectValue placeholder="All Urgency Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Urgency Levels</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Visibility Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Visibility</label>
                  <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                    <SelectTrigger data-testid="select-visibility-filter">
                      <SelectValue placeholder="All Visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Visibility</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Breed Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Breed</label>
                  <Select value={breedFilter} onValueChange={setBreedFilter}>
                    <SelectTrigger data-testid="select-breed-filter">
                      <SelectValue placeholder="All Breeds" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Breeds</SelectItem>
                      {uniqueBreeds.map((breed) => (
                        <SelectItem key={breed} value={breed}>{breed}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Age Range Filter */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Age Range</label>
                    <span className="text-sm text-muted-foreground">
                      {ageRange[0]} - {ageRange[1]} years
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={20}
                    step={1}
                    value={ageRange}
                    onValueChange={(v) => setAgeRange(v as [number, number])}
                    data-testid="slider-age-range"
                  />
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={clearAllFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear All Filters
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewType === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewType("grid")}
              data-testid="button-view-grid"
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewType === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewType("list")}
              data-testid="button-view-list"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewType === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewType("table")}
              data-testid="button-view-table"
            >
              <TableIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardContent className="p-4 space-y-3">
                  <div className="h-5 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredDogs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DogIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Pets Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery || statusFilter !== "all" || sizeFilter !== "all" || animalTypeFilter !== "all"
                  ? "No pets match your current filters."
                  : "Start by adding your first pet."}
              </p>
              {!searchQuery && statusFilter === "all" && sizeFilter === "all" && animalTypeFilter === "all" && (
                <Button
                  onClick={() => {
                    setEditDogId(null);
                    setDogFormDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pet
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewType === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredDogs.map((dog) => (
              <Card
                key={dog.id}
                className={`overflow-hidden hover-elevate cursor-pointer ${selectedDogs.has(dog.id) ? 'ring-2 ring-primary' : ''}`}
                data-testid={`card-dog-${dog.id}`}
                onClick={() => setLocation(`/shelter/dogs/${dog.id}`)}
              >
                <div className="relative h-48 bg-muted">
                  {dog.photos && dog.photos.length > 0 ? (
                    <img
                      src={dog.photos[0]}
                      alt={dog.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <DogIcon className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  {/* Selection checkbox */}
                  <div 
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ShelterCheckbox
                      checked={selectedDogs.has(dog.id)}
                      onCheckedChange={() => toggleSelect(dog.id)}
                      className="bg-background/80"
                      data-testid={`checkbox-dog-${dog.id}`}
                    />
                  </div>
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(getPipelineStatus(dog))}
                  </div>
                  {dog.urgencyLevel && dog.urgencyLevel !== "normal" && (
                    <div className="absolute top-10 left-2">
                      <Badge
                        variant="destructive"
                        className="flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {dog.urgencyLevel === "critical" ? "Critical" : "Urgent"}
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg truncate">{dog.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {dog.breed} • {dog.age} {dog.age === 1 ? "year" : "years"} •{" "}
                        {SIZE_LABELS[dog.size] || dog.size}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-dog-menu-${dog.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setLocation(`/shelter/dogs/${dog.id}`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditDogId(dog.id);
                            setEditDogData(dog);
                            setDogFormDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <Link href={`/shelter/medical?dogId=${dog.id}`}>
                          <DropdownMenuItem>
                            <Syringe className="w-4 h-4 mr-2" />
                            Medical Records
                          </DropdownMenuItem>
                        </Link>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            handleDeleteClick(dog);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {dog.intake && (
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Intake:{" "}
                        {format(new Date(dog.intake.intakeDate), "MMM d, yyyy")}
                      </div>
                      {dog.intake.intakeType && (
                        <div className="mt-1 capitalize">
                          Type: {dog.intake.intakeType.replace(/_/g, " ")}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : viewType === "list" ? (
          <div className="space-y-3">
            {filteredDogs.map((dog) => (
              <Card
                key={dog.id}
                className="overflow-hidden hover-elevate cursor-pointer"
                data-testid={`card-dog-${dog.id}`}
                onClick={() => setLocation(`/shelter/dogs/${dog.id}`)}
              >
                <div className="flex gap-4 p-4">
                  <div className="flex items-center">
                    <ShelterCheckbox
                      checked={selectedDogs.has(dog.id)}
                      onCheckedChange={() => toggleSelect(dog.id)}
                      data-testid={`checkbox-dog-${dog.id}`}
                    />
                  </div>
                  <div className="w-24 h-24 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
                    {dog.photos && dog.photos.length > 0 ? (
                      <img
                        src={dog.photos[0]}
                        alt={dog.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <DogIcon className="w-10 h-10 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{dog.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {dog.breed} • {dog.age} {dog.age === 1 ? "year" : "years"} •{" "}
                          {SIZE_LABELS[dog.size] || dog.size}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(getPipelineStatus(dog))}
                        {dog.urgencyLevel && dog.urgencyLevel !== "normal" && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {dog.urgencyLevel === "critical" ? "Critical" : "Urgent"}
                          </Badge>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-dog-menu-${dog.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => setLocation(`/shelter/dogs/${dog.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditDogId(dog.id);
                                setEditDogData(dog);
                                setDogFormDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <Link href={`/shelter/medical?dogId=${dog.id}`}>
                              <DropdownMenuItem>
                                <Syringe className="w-4 h-4 mr-2" />
                                Medical Records
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onSelect={(e) => {
                                e.preventDefault();
                                handleDeleteClick(dog);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {dog.intake && (
                      <div className="text-xs text-muted-foreground flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Intake: {format(new Date(dog.intake.intakeDate), "MMM d, yyyy")}
                        </div>
                        {dog.intake.intakeType && (
                          <div className="capitalize">
                            Type: {dog.intake.intakeType.replace(/_/g, " ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <ScrollArea className="w-full">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <ShelterCheckbox
                        checked={selectedDogs.size === filteredDogs.length && filteredDogs.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all-table"
                      />
                    </TableHead>
                    <TableHead className="w-[80px]">Photo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Breed</TableHead>
                    <TableHead className="text-center">Age</TableHead>
                    <TableHead className="text-center">Size</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Intake Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredDogs.map((dog) => (
                  <TableRow
                    key={dog.id}
                    className="cursor-pointer"
                    onClick={() => setLocation(`/shelter/dogs/${dog.id}`)}
                    data-testid={`row-dog-${dog.id}`}
                  >
                    <TableCell>
                      <ShelterCheckbox
                        checked={selectedDogs.has(dog.id)}
                        onCheckedChange={() => toggleSelect(dog.id)}
                        data-testid={`checkbox-dog-${dog.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                        {dog.photos && dog.photos.length > 0 ? (
                          <img
                            src={dog.photos[0]}
                            alt={dog.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <DogIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {dog.name}
                      {dog.urgencyLevel && dog.urgencyLevel !== "normal" && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {dog.urgencyLevel === "critical" ? "Critical" : "Urgent"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{dog.breed}</TableCell>
                    <TableCell className="text-center">
                      {dog.age} {dog.age === 1 ? "yr" : "yrs"}
                    </TableCell>
                    <TableCell className="text-center capitalize">
                      {SIZE_LABELS[dog.size] || dog.size}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(getPipelineStatus(dog))}
                    </TableCell>
                    <TableCell className="text-center">
                      {dog.intake ? format(new Date(dog.intake.intakeDate), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-dog-menu-${dog.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => setLocation(`/shelter/dogs/${dog.id}`)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditDogId(dog.id);
                              setEditDogData(dog);
                              setDogFormDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <Link href={`/shelter/medical?dogId=${dog.id}`}>
                            <DropdownMenuItem>
                              <Syringe className="w-4 h-4 mr-2" />
                              Medical Records
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={(e) => {
                              e.preventDefault();
                              handleDeleteClick(dog);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Card>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Pet</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {dogToDelete?.name} from your
                shelter? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel data-testid="button-cancel-delete">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedDogs.size} Pets?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the selected pets and their associated intake records.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => bulkDeleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-confirm-bulk-delete"
              >
                {bulkDeleteMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Pets
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dog Form Dialog */}
        <DogFormDialog
          open={dogFormDialogOpen}
          onOpenChange={(open) => {
            setDogFormDialogOpen(open);
            if (!open) {
              setEditDogId(null);
              setEditDogData(null);
            }
          }}
          editDogId={editDogId}
          initialDogData={editDogData}
        />
      </div>
    
  );
}