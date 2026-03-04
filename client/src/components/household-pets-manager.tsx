import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusCircle, Edit, Trash2, Dog, Cat, PawPrint } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HouseholdPet } from "@shared/schema";

const popularDogBreeds = [
  "Labrador Retriever", "German Shepherd", "Golden Retriever", "French Bulldog",
  "Bulldog", "Beagle", "Poodle", "Rottweiler", "Yorkshire Terrier", "Boxer",
  "Dachshund", "Siberian Husky", "Great Dane", "Doberman Pinscher", "Australian Shepherd",
  "Miniature Schnauzer", "Cavalier King Charles Spaniel", "Shih Tzu", "Boston Terrier",
  "Pomeranian", "Havanese", "Shetland Sheepdog", "Brittany", "Pembroke Welsh Corgi",
  "Australian Cattle Dog", "Mastiff", "Cocker Spaniel", "Chihuahua", "Border Collie",
  "Mixed Breed", "Unknown"
];

const popularCatBreeds = [
  "Domestic Shorthair", "Domestic Longhair", "Siamese", "Persian", "Maine Coon",
  "Ragdoll", "Bengal", "Abyssinian", "British Shorthair", "Scottish Fold",
  "Sphynx", "American Shorthair", "Mixed Breed", "Unknown"
];

interface HouseholdPetsManagerProps {
  /** If true, only renders the dialog (no list/buttons) - for external control */
  dialogOnly?: boolean;
  /** External control for dialog open state */
  open?: boolean;
  /** Callback when dialog should close */
  onOpenChange?: (open: boolean) => void;
  /** Pet ID to edit (for external control) */
  editPetId?: string | null;
}

export function HouseholdPetsManager({ 
  dialogOnly = false, 
  open: externalOpen, 
  onOpenChange,
  editPetId 
}: HouseholdPetsManagerProps = {}) {
  const { toast } = useToast();
  const [internalShowDialog, setInternalShowDialog] = useState(false);
  const [editingPet, setEditingPet] = useState<HouseholdPet | null>(null);
  const [breedOpen, setBreedOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    species: "dog",
    breed: "",
    age: "",
    size: "",
    energyLevel: "",
    temperament: [] as string[],
    goodWithDogs: false,
    goodWithCats: false,
    goodWithKids: false,
    specialNeeds: "",
  });
  
  // Use external control if provided, otherwise use internal state
  const showDialog = externalOpen !== undefined ? externalOpen : internalShowDialog;
  const setShowDialog = onOpenChange || setInternalShowDialog;

  const { data: pets, isLoading } = useQuery<HouseholdPet[]>({
    queryKey: ["/api/household-pets"],
  });

  const createPetMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/household-pets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household-pets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
      toast({ title: "Pet added successfully!" });
      setShowDialog(false);
      resetForm();
    },
  });

  const updatePetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/household-pets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household-pets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
      toast({ title: "Pet updated successfully!" });
      setShowDialog(false);
      resetForm();
    },
  });

  const deletePetMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/household-pets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household-pets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
      toast({ title: "Pet removed successfully!" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      species: "dog",
      breed: "",
      age: "",
      size: "",
      energyLevel: "",
      temperament: [],
      goodWithDogs: false,
      goodWithCats: false,
      goodWithKids: false,
      specialNeeds: "",
    });
    setEditingPet(null);
    setBreedOpen(false);
  };

  const handleOpenDialog = (pet?: HouseholdPet) => {
    if (pet) {
      setEditingPet(pet);
      setFormData({
        name: pet.name,
        species: pet.species,
        breed: pet.breed || "",
        age: pet.age?.toString() || "",
        size: pet.size || "",
        energyLevel: pet.energyLevel || "",
        temperament: pet.temperament || [],
        goodWithDogs: pet.goodWithDogs || false,
        goodWithCats: pet.goodWithCats || false,
        goodWithKids: pet.goodWithKids || false,
        specialNeeds: pet.specialNeeds || "",
      });
    } else {
      resetForm();
    }
    setShowDialog(true);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      age: formData.age ? parseInt(formData.age) : null,
    };

    if (editingPet) {
      updatePetMutation.mutate({ id: editingPet.id, data });
    } else {
      createPetMutation.mutate(data);
    }
  };

  const handleTemperamentToggle = (trait: string) => {
    setFormData({
      ...formData,
      temperament: formData.temperament.includes(trait)
        ? formData.temperament.filter(t => t !== trait)
        : [...formData.temperament, trait],
    });
  };

  const getSpeciesIcon = (species: string) => {
    if (species === "dog") return Dog;
    if (species === "cat") return Cat;
    return PawPrint;
  };

  // Handle external editPetId prop
  useEffect(() => {
    if (externalOpen && editPetId && pets) {
      const petToEdit = pets.find(p => p.id === editPetId);
      if (petToEdit) {
        setEditingPet(petToEdit);
        setFormData({
          name: petToEdit.name,
          species: petToEdit.species,
          breed: petToEdit.breed || "",
          age: petToEdit.age?.toString() || "",
          size: petToEdit.size || "",
          energyLevel: petToEdit.energyLevel || "",
          temperament: petToEdit.temperament || [],
          goodWithDogs: petToEdit.goodWithDogs || false,
          goodWithCats: petToEdit.goodWithCats || false,
          goodWithKids: petToEdit.goodWithKids || false,
          specialNeeds: petToEdit.specialNeeds || "",
        });
      }
    } else if (externalOpen && !editPetId) {
      resetForm();
    }
  }, [externalOpen, editPetId, pets]);

  // Dialog-only mode: just render the dialog
  if (dialogOnly) {
    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPet ? "Edit Pet" : "Add Pet"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Buddy"
                />
              </div>
              <div className="space-y-2">
                <Label>Species *</Label>
                <Select value={formData.species} onValueChange={(v) => setFormData({ ...formData, species: v, breed: "" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dog">Dog</SelectItem>
                    <SelectItem value="cat">Cat</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(formData.species === "dog" || formData.species === "cat") && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Breed</Label>
                    <Popover open={breedOpen} onOpenChange={setBreedOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={breedOpen}
                          className="w-full justify-between h-11"
                        >
                          {formData.breed || "Select breed..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search breed..." />
                          <CommandEmpty>No breed found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-auto">
                            {(formData.species === "dog" ? popularDogBreeds : popularCatBreeds).map((breed) => (
                              <CommandItem
                                key={breed}
                                value={breed}
                                onSelect={(currentValue) => {
                                  setFormData({ ...formData, breed: currentValue === formData.breed.toLowerCase() ? "" : breed });
                                  setBreedOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.breed === breed ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {breed}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Age (years)</Label>
                    <Input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Size</Label>
                    <Select value={formData.size} onValueChange={(v) => setFormData({ ...formData, size: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (under 25 lbs)</SelectItem>
                        <SelectItem value="medium">Medium (25-60 lbs)</SelectItem>
                        <SelectItem value="large">Large (over 60 lbs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Energy Level</Label>
                    <Select value={formData.energyLevel} onValueChange={(v) => setFormData({ ...formData, energyLevel: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select energy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="very_high">Very High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Temperament</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {["friendly", "playful", "calm", "protective", "shy", "loyal"].map((trait) => (
                      <div key={trait} className="flex items-center space-x-2">
                        <Checkbox
                          checked={formData.temperament.includes(trait)}
                          onCheckedChange={() => handleTemperamentToggle(trait)}
                        />
                        <label className="text-sm capitalize">{trait}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Compatibility</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.goodWithDogs}
                        onCheckedChange={(checked) => setFormData({ ...formData, goodWithDogs: !!checked })}
                      />
                      <label className="text-sm">Good with other dogs</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.goodWithCats}
                        onCheckedChange={(checked) => setFormData({ ...formData, goodWithCats: !!checked })}
                      />
                      <label className="text-sm">Good with cats</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.goodWithKids}
                        onCheckedChange={(checked) => setFormData({ ...formData, goodWithKids: !!checked })}
                      />
                      <label className="text-sm">Good with kids</label>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Special Needs / Notes</Label>
              <Textarea
                value={formData.specialNeeds}
                onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                placeholder="Any medical conditions, dietary requirements, etc."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingPet ? "Update Pet" : "Add Pet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          onClick={() => handleOpenDialog()}
          size="lg"
          className="w-full sm:w-auto gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
        >
          <PlusCircle className="w-5 h-5" />
          Add a Pet
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <PawPrint className="w-8 h-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading your pets...</p>
        </div>
      ) : !pets || pets.length === 0 ? (
        <div className="text-center py-12 px-4 border-2 border-dashed border-muted rounded-2xl bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <PawPrint className="w-10 h-10 text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No pets yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Add your furry family members to help us find dogs that will get along perfectly with them!
          </p>
          <Button
            onClick={() => handleOpenDialog()}
            size="lg"
            className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
          >
            <PlusCircle className="w-5 h-5" />
            Add Your First Pet
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pets.map((pet) => {
            const Icon = getSpeciesIcon(pet.species);
            const speciesColor = pet.species === 'dog' ? 'blue' : pet.species === 'cat' ? 'purple' : 'gray';
            return (
              <Card key={pet.id} className="group hover:shadow-lg transition-all border-2 hover:border-primary/30">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${
                      pet.species === 'dog'
                        ? 'from-blue-500/20 to-blue-600/20'
                        : pet.species === 'cat'
                        ? 'from-purple-500/20 to-purple-600/20'
                        : 'from-gray-500/20 to-gray-600/20'
                    } flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-8 h-8 ${
                        pet.species === 'dog'
                          ? 'text-blue-600'
                          : pet.species === 'cat'
                          ? 'text-purple-600'
                          : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xl mb-2">{pet.name}</h4>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary" className="capitalize font-medium">{pet.species}</Badge>
                        {pet.breed && <Badge variant="outline" className="font-medium">{pet.breed}</Badge>}
                        {pet.age && <Badge variant="outline">{pet.age} yrs</Badge>}
                        {pet.size && <Badge variant="outline" className="capitalize">{pet.size}</Badge>}
                        {pet.energyLevel && (
                          <Badge variant="outline" className="capitalize">
                            {pet.energyLevel} energy
                          </Badge>
                        )}
                      </div>
                      {pet.temperament && pet.temperament.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {pet.temperament.map((trait) => (
                            <span key={trait} className="text-xs px-2.5 py-1 bg-muted/80 rounded-full capitalize font-medium">
                              {trait}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm">
                        {pet.goodWithDogs && (
                          <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                            <Check className="w-4 h-4" /> Dogs
                          </span>
                        )}
                        {pet.goodWithCats && (
                          <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                            <Check className="w-4 h-4" /> Cats
                          </span>
                        )}
                        {pet.goodWithKids && (
                          <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-medium">
                            <Check className="w-4 h-4" /> Kids
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(pet)}
                        className="hover:bg-primary/10"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePetMutation.mutate(pet.id)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPet ? "Edit Pet" : "Add Pet"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Buddy"
                />
              </div>
              <div className="space-y-2">
                <Label>Species *</Label>
                <Select value={formData.species} onValueChange={(v) => setFormData({ ...formData, species: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dog">Dog</SelectItem>
                    <SelectItem value="cat">Cat</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.species === "dog" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Breed</Label>
                    <Popover open={breedOpen} onOpenChange={setBreedOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={breedOpen}
                          className="w-full justify-between h-11"
                        >
                          {formData.breed || "Select breed..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search breed..." />
                          <CommandEmpty>No breed found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-auto">
                            {(formData.species === "dog" ? popularDogBreeds : popularCatBreeds).map((breed) => (
                              <CommandItem
                                key={breed}
                                value={breed}
                                onSelect={(currentValue) => {
                                  setFormData({ ...formData, breed: currentValue === formData.breed.toLowerCase() ? "" : breed });
                                  setBreedOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.breed === breed ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {breed}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Age (years)</Label>
                    <Input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Size</Label>
                    <Select value={formData.size} onValueChange={(v) => setFormData({ ...formData, size: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small (under 25 lbs)</SelectItem>
                        <SelectItem value="medium">Medium (25-60 lbs)</SelectItem>
                        <SelectItem value="large">Large (over 60 lbs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Energy Level</Label>
                    <Select value={formData.energyLevel} onValueChange={(v) => setFormData({ ...formData, energyLevel: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select energy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="very_high">Very High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Temperament</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {["friendly", "playful", "calm", "protective", "shy", "loyal"].map((trait) => (
                      <div key={trait} className="flex items-center space-x-2">
                        <Checkbox
                          checked={formData.temperament.includes(trait)}
                          onCheckedChange={() => handleTemperamentToggle(trait)}
                        />
                        <label className="text-sm capitalize">{trait}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Compatibility</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.goodWithDogs}
                        onCheckedChange={(checked) => setFormData({ ...formData, goodWithDogs: !!checked })}
                      />
                      <label className="text-sm">Good with other dogs</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.goodWithCats}
                        onCheckedChange={(checked) => setFormData({ ...formData, goodWithCats: !!checked })}
                      />
                      <label className="text-sm">Good with cats</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.goodWithKids}
                        onCheckedChange={(checked) => setFormData({ ...formData, goodWithKids: !!checked })}
                      />
                      <label className="text-sm">Good with kids</label>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Special Needs / Notes</Label>
              <Textarea
                value={formData.specialNeeds}
                onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                placeholder="Any medical conditions, dietary requirements, etc."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingPet ? "Update Pet" : "Add Pet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}