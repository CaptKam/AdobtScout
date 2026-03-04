import { memo, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MapPin, Zap, Baby, Dog, Cat, AlertTriangle, Clock, Heart } from 'lucide-react';
import { ENERGY_LEVELS } from '@/lib/design-tokens';
import { differenceInDays } from 'date-fns';
import type { ReactNode } from 'react';
import { getCardImageUrl } from '@/components/ui/optimized-image';

interface SwipeCardBaseProps {
  id: string | number;
  imageUrl: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  distance?: number;
  location?: string;
  energyLevel?: string;
  traits?: string[];
  urgencyLevel?: 'normal' | 'urgent' | 'critical';
  urgencyDeadline?: string | Date | null;
  compatibilityScore?: number;
  goodWithKids?: boolean;
  goodWithDogs?: boolean;
  goodWithCats?: boolean;
  topLeftBadge?: ReactNode;
  topRightBadge?: ReactNode;
  additionalBadges?: ReactNode[];
  style?: React.CSSProperties;
  onClick?: () => void;
  className?: string;
}

export const SwipeCardBase = memo(function SwipeCardBase({
  id,
  imageUrl,
  imageAlt,
  title,
  subtitle,
  distance,
  location,
  energyLevel,
  traits = [],
  urgencyLevel,
  urgencyDeadline,
  compatibilityScore,
  goodWithKids,
  goodWithDogs,
  goodWithCats,
  topLeftBadge,
  topRightBadge,
  additionalBadges,
  style,
  onClick,
  className,
}: SwipeCardBaseProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const energy = energyLevel ? ENERGY_LEVELS[energyLevel as keyof typeof ENERGY_LEVELS] : null;
  
  const daysUntilDeadline = urgencyDeadline 
    ? differenceInDays(new Date(urgencyDeadline), new Date())
    : null;

  const optimizedImageUrl = getCardImageUrl(imageUrl);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  return (
    <Card
      className={cn(
        'overflow-hidden w-full h-full relative select-none rounded-3xl border-0 swipe-card-shadow',
        className
      )}
      style={style}
      onClick={onClick}
      data-testid={`swipe-card-${id}`}
    >
      <div className="relative h-full">
        {!imageLoaded && (
          <div className="absolute inset-0 skeleton-shimmer flex items-center justify-center z-10">
            <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          </div>
        )}
        <img
          src={optimizedImageUrl}
          alt={imageAlt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          onLoad={handleImageLoad}
          className={cn(
            "w-full h-full object-cover pointer-events-none transition-opacity duration-300",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          draggable={false}
        />
        
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent via-40% to-black/90 pointer-events-none" />

        {topLeftBadge ? (
          <div className="absolute top-6 left-6 sm:top-7 sm:left-7 pointer-events-none">
            {topLeftBadge}
          </div>
        ) : urgencyLevel && urgencyLevel !== 'normal' && (
          <div className={cn(
            'absolute top-6 left-6 sm:top-7 sm:left-7 pointer-events-none',
            'text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-full shadow-2xl border border-white/30',
            urgencyLevel === 'critical' ? 'bg-red-500/95 animate-pulse' : 'bg-orange-500/95'
          )}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-md" />
              <span className="font-bold text-base sm:text-lg drop-shadow-md">
                {urgencyLevel === 'critical' ? 'CRITICAL' : 'URGENT'}
              </span>
              {daysUntilDeadline !== null && daysUntilDeadline >= 0 && (
                <span className="flex items-center gap-1 text-sm font-medium opacity-90">
                  <Clock className="w-3.5 h-3.5" />
                  {daysUntilDeadline === 0 ? 'Today' : `${daysUntilDeadline}d`}
                </span>
              )}
            </div>
          </div>
        )}

        {topRightBadge ? (
          <div className="absolute top-6 right-6 sm:top-7 sm:right-7 pointer-events-none">
            {topRightBadge}
          </div>
        ) : compatibilityScore !== undefined && (
          <div className="absolute top-6 right-6 sm:top-7 sm:right-7 glass text-foreground px-4 py-2.5 sm:px-5 sm:py-3 rounded-full shadow-2xl border border-white/30 dark:border-white/10 pointer-events-none">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 sm:w-6 sm:h-6 fill-primary text-primary animate-pulse drop-shadow-md" />
              <span className="font-bold text-base sm:text-lg drop-shadow-md">{compatibilityScore}%</span>
            </div>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-8 sm:px-10 py-6 sm:py-7 pb-7 sm:pb-8 pointer-events-none">
          <div className="mb-4 sm:mb-5">
            <h2 className="font-bold text-white text-3xl sm:text-4xl md:text-5xl mb-2 drop-shadow-2xl leading-tight">
              {title}
            </h2>
            <div className="flex items-center gap-2.5 text-white/95 text-sm sm:text-base drop-shadow-lg">
              <span className="font-semibold">{subtitle}</span>
            </div>
          </div>

          {(distance !== undefined || location) && (
            <div className="flex items-center gap-2 text-white/95 text-sm sm:text-base mb-4 sm:mb-5 drop-shadow-lg">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="font-medium">
                {distance !== undefined 
                  ? `${distance.toFixed(1)} miles away`
                  : location || 'Location not available'}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 sm:gap-3 mb-4 sm:mb-5">
            {energy && (
              <Badge className="bg-white/25 backdrop-blur-md border-white/40 text-white hover:bg-white/35 shadow-lg text-sm sm:text-base px-3.5 sm:px-4 py-2 sm:py-2.5">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5" />
                {energy.label}
              </Badge>
            )}
            {traits.slice(0, 2).map((trait, idx) => (
              <Badge 
                key={idx} 
                className="bg-white/25 backdrop-blur-md border-white/40 text-white hover:bg-white/35 shadow-lg capitalize text-sm sm:text-base px-3.5 sm:px-4 py-2 sm:py-2.5"
              >
                {trait}
              </Badge>
            ))}
            {additionalBadges}
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-2.5 text-base text-white/95">
            {goodWithKids && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 rounded-full border border-white/30 shadow-lg">
                <Baby className="w-4 h-4" />
                <span className="text-xs font-medium">Kids</span>
              </div>
            )}
            {goodWithDogs && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 rounded-full border border-white/30 shadow-lg">
                <Dog className="w-4 h-4" />
                <span className="text-xs font-medium">Dogs</span>
              </div>
            )}
            {goodWithCats && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-2.5 sm:px-3.5 py-1.5 rounded-full border border-white/30 shadow-lg">
                <Cat className="w-4 h-4" />
                <span className="text-xs font-medium">Cats</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
});
