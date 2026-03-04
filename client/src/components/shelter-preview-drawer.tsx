import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ChevronRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Dog {
  id: string;
  name: string;
  breed: string;
  age: number;
  size: string;
  energyLevel: string;
  photos: string[];
  shelterName: string;
  urgencyLevel?: string;
}

interface ShelterPreviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shelterName: string;
  shelterLocation: string;
  dogs: Dog[];
  onViewAll: () => void;
  onSelectDog: (dogId: string) => void;
}

export function ShelterPreviewDrawer({
  open,
  onOpenChange,
  shelterName,
  shelterLocation,
  dogs,
  onViewAll,
  onSelectDog,
}: ShelterPreviewDrawerProps) {
  const previewDogs = dogs.slice(0, 3);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-start justify-between">
            <div>
              <div className="text-lg font-bold">{shelterName}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {shelterLocation}
              </div>
            </div>
            <Badge variant="secondary" className="ml-2">{dogs.length} dogs</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          <div>
            <h3 className="font-semibold text-sm mb-3">Dogs Available</h3>
            <div className="grid grid-cols-1 gap-3">
              {previewDogs.map((dog) => (
                <Card
                  key={dog.id}
                  className="overflow-hidden hover-elevate cursor-pointer transition-all"
                  data-testid={`card-preview-dog-${dog.id}`}
                >
                  <div className="flex gap-3">
                    <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-md">
                      <img
                        src={dog.photos[0]}
                        alt={dog.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 py-3 pr-3 flex flex-col justify-between">
                      <div>
                        <div className="font-semibold text-sm">{dog.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {dog.breed} • {dog.age} yrs
                        </div>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {dog.size}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs capitalize"
                          >
                            {dog.energyLevel}
                          </Badge>
                          {dog.urgencyLevel && (
                            <Badge
                              variant="destructive"
                              className="text-xs uppercase"
                            >
                              {dog.urgencyLevel}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onSelectDog(dog.id);
                        onOpenChange(false);
                      }}
                      className="px-3 text-primary hover:text-primary/80 transition-colors flex items-center justify-center"
                      data-testid={`button-preview-dog-select-${dog.id}`}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {dogs.length > 3 && (
            <Button
              onClick={onViewAll}
              variant="outline"
              className="w-full"
              data-testid="button-view-all-shelter-dogs"
            >
              View All {dogs.length} Dogs at {shelterName}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
