import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  MapPin, 
  Clock, 
  Dog, 
  Cat, 
  Baby, 
  Home, 
  Zap,
  Scale,
  Heart,
  CheckCircle
} from "lucide-react";
import { TIME_COMMITMENT_LABELS, EMERGENCY_LABELS, SIZE_LABELS } from "@/lib/design-tokens";
import type { FosterProfile } from "@shared/schema";

interface FosterCardProps {
  foster: FosterProfile;
  onClick?: () => void;
}

export function FosterCard({ foster, onClick }: FosterCardProps) {
  const initials = `${foster.firstName?.[0] || ""}${foster.lastName?.[0] || ""}`.toUpperCase() || "F";
  const displayName = [foster.firstName, foster.lastName].filter(Boolean).join(" ") || "Foster Parent";
  
  const availableSlots = (foster.fosterCapacity || 1) - (foster.fosterCurrentCount || 0);
  const hasAvailability = availableSlots > 0;

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover-elevate transition-all"
      onClick={onClick}
      data-testid={`foster-card-${foster.id}`}
    >
      <CardContent className="p-0">
        <div className="relative">
          <div className="h-40 bg-gradient-to-br from-primary/20 via-primary/10 to-background flex items-center justify-center">
            <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
              <AvatarImage src={foster.profileImage || undefined} alt={displayName} />
              <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          
          {foster.distance !== undefined && (
            <Badge 
              variant="secondary" 
              className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm"
            >
              <MapPin className="w-3 h-3 mr-1" />
              {foster.distance} mi
            </Badge>
          )}
          
          {hasAvailability && (
            <Badge 
              className="absolute top-3 left-3 bg-green-500/90 text-white"
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              {availableSlots} {availableSlots === 1 ? "spot" : "spots"} available
            </Badge>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="text-center">
            <h3 className="font-semibold text-lg" data-testid="foster-name">{displayName}</h3>
            {(foster.city || foster.state) && (
              <p className="text-sm text-muted-foreground">
                {[foster.city, foster.state].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {foster.fosterTimeCommitment && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {TIME_COMMITMENT_LABELS[foster.fosterTimeCommitment as keyof typeof TIME_COMMITMENT_LABELS] || foster.fosterTimeCommitment}
              </Badge>
            )}
            {foster.fosterEmergencyAvailability && (
              <Badge variant="outline" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                {EMERGENCY_LABELS[foster.fosterEmergencyAvailability as keyof typeof EMERGENCY_LABELS] || foster.fosterEmergencyAvailability}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {foster.fosterSizePreference && foster.fosterSizePreference.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <Scale className="w-3 h-3 mr-1" />
                {foster.fosterSizePreference.includes("any") 
                  ? "Any size"
                  : foster.fosterSizePreference.map(s => SIZE_LABELS[s as keyof typeof SIZE_LABELS] || s).join(", ")
                }
              </Badge>
            )}
            {foster.fosterMaxWeight && (
              <Badge variant="secondary" className="text-xs">
                Up to {foster.fosterMaxWeight} lbs
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center pt-1">
            {foster.hasYard && (
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                <Home className="w-3 h-3 mr-1" />
                Has Yard
              </Badge>
            )}
            {foster.fosterSpecialNeedsWilling && (
              <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                <Heart className="w-3 h-3 mr-1" />
                Special Needs OK
              </Badge>
            )}
            {foster.hasOtherPets && foster.otherPetsType && (
              <Badge variant="outline" className="text-xs">
                {foster.otherPetsType === "dogs" || foster.otherPetsType === "both" ? (
                  <Dog className="w-3 h-3 mr-1" />
                ) : (
                  <Cat className="w-3 h-3 mr-1" />
                )}
                Has {foster.otherPetsType === "dogs" ? "Dogs" : foster.otherPetsType === "cats" ? "Cats" : "Pets"}
              </Badge>
            )}
            {foster.hasChildren && (
              <Badge variant="outline" className="text-xs">
                <Baby className="w-3 h-3 mr-1" />
                Has Kids
                {foster.childrenAges && foster.childrenAges.length > 0 && (
                  <span className="ml-1">({foster.childrenAges.length})</span>
                )}
              </Badge>
            )}
          </div>

          {foster.fosterPreviousExperience && (
            <p className="text-xs text-muted-foreground text-center line-clamp-2 pt-1">
              {foster.fosterPreviousExperience}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
