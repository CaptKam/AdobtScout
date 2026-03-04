import { memo } from "react";
import { SwipeCardBase } from "@/components/ui/swipe-card-base";
import type { DogWithCompatibility } from "@shared/schema";

interface DogCardProps {
  dog: DogWithCompatibility;
  style?: React.CSSProperties;
  onSwipe?: (direction: "left" | "right") => void;
  onClick?: () => void;
}

export const DogCard = memo(function DogCard({ dog, style, onClick }: DogCardProps) {
  const isShelterDog = dog.shelterName && !dog.shelterName.includes('(Owner)') && !dog.shelterName.includes('(Rehoming)');

  return (
    <SwipeCardBase
      id={dog.id}
      imageUrl={dog.photos[0]}
      imageAlt={dog.name}
      title={`${dog.name}, ${dog.age}`}
      subtitle={`${dog.breed} • ${dog.weight} lbs`}
      distance={dog.distance}
      energyLevel={dog.energyLevel}
      traits={dog.temperament}
      urgencyLevel={isShelterDog ? dog.urgencyLevel as 'normal' | 'urgent' | 'critical' : undefined}
      urgencyDeadline={isShelterDog ? dog.urgencyDeadline : undefined}
      compatibilityScore={dog.compatibilityScore}
      goodWithKids={dog.goodWithKids}
      goodWithDogs={dog.goodWithDogs}
      goodWithCats={dog.goodWithCats}
      style={style}
      onClick={onClick}
    />
  );
});