import { memo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Compass, PawPrint } from "lucide-react";

export const PageLoading = memo(function PageLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8" data-testid="status-page-loading">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
          <PawPrint className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer" />
      </div>
      <p className="text-muted-foreground text-base font-medium">One moment...</p>
    </div>
  );
});

export const DiscoverSkeleton = memo(function DiscoverSkeleton() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 animate-fadeIn" data-testid="status-discover-loading">
      <div className="w-full max-w-[380px] mx-auto">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-muted to-muted/80 shadow-xl">
          <div className="aspect-[3/4] skeleton-shimmer" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4 bg-white/20" />
              <Skeleton className="h-5 w-1/2 bg-white/15" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20 rounded-full bg-white/20" />
              <Skeleton className="h-7 w-16 rounded-full bg-white/15" />
              <Skeleton className="h-7 w-24 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-6 mt-8">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
      </div>
      <div className="text-center mt-8 space-y-2 animate-fadeInUp" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center justify-center gap-2">
          <Heart className="w-5 h-5 text-primary animate-pulse" />
          <p className="text-muted-foreground font-medium">Finding your perfect match...</p>
        </div>
      </div>
    </div>
  );
});

export const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="rounded-3xl overflow-hidden bg-muted animate-pulse">
      <div className="aspect-[3/4] skeleton-shimmer" />
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
});

export const DogProfileSkeleton = memo(function DogProfileSkeleton() {
  return (
    <div className="min-h-screen animate-fadeIn" data-testid="status-dog-profile-loading">
      <div className="relative h-[500px] md:h-[600px] skeleton-shimmer" />
      <div className="absolute top-4 left-4 right-4 flex justify-between">
        <Skeleton className="h-10 w-10 rounded-full bg-white/20" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10 rounded-full bg-white/20" />
          <Skeleton className="h-10 w-10 rounded-full bg-white/20" />
        </div>
      </div>
      <div className="relative -mt-12 bg-background rounded-t-3xl">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-16 w-16 rounded-2xl" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
});

export const ProfileSkeleton = memo(function ProfileSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto animate-fadeIn">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
});

export const ListSkeleton = memo(function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4 animate-fadeIn">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="flex items-center gap-4 p-4 rounded-xl bg-muted/50"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
});

export const MapSkeleton = memo(function MapSkeleton() {
  return (
    <div className="h-full w-full relative animate-fadeIn" data-testid="status-map-loading">
      <div className="absolute inset-0 skeleton-shimmer bg-muted" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-background/90 shadow-lg flex items-center justify-center mx-auto">
            <Compass className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground font-medium bg-background/90 px-4 py-2 rounded-full shadow">
            Loading map...
          </p>
        </div>
      </div>
    </div>
  );
});
