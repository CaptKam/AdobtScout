import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

function Skeleton({
  className,
  shimmer = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted",
        shimmer ? "skeleton-shimmer" : "animate-pulse",
        className
      )}
      {...props}
    />
  )
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 animate-smooth-enter", className)}>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="space-y-2 px-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12"
  };
  return <Skeleton className={cn("rounded-full", sizeClasses[size])} />;
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 ? "w-3/4" : "w-full",
            `stagger-${Math.min(i + 1, 5)}`
          )}
          style={{ animationFillMode: 'both' }}
        />
      ))}
    </div>
  );
}

function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-10 w-24 rounded-lg", className)} />;
}

function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card border rounded-lg p-4 animate-fade-in-scale", className)}>
      <div className="flex items-center gap-2 mb-1">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-7 w-12" />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function SkeletonPipelineColumn({ className }: { className?: string }) {
  return (
    <div className={cn("w-72 flex-shrink-0 bg-muted/30 rounded-lg animate-fade-in-scale", className)}>
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="w-3 h-3 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <Skeleton className="h-3 w-32 mt-1" />
      </div>
      <div className="p-2 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`bg-card border rounded-lg p-3 stagger-${i}`} style={{ animationFillMode: 'both' }}>
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonTaskList({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 p-3 bg-muted/30 rounded-lg animate-smooth-enter stagger-${i + 1}`}
          style={{ animationFillMode: 'both' }}
        >
          <Skeleton className="w-4 h-4 rounded" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-1" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SkeletonBlockerCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-3 bg-muted/30 rounded-lg border animate-fade-in-scale", className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  );
}

export { 
  Skeleton, 
  SkeletonCard, 
  SkeletonAvatar, 
  SkeletonText, 
  SkeletonButton,
  SkeletonStatCard,
  SkeletonPipelineColumn,
  SkeletonTaskList,
  SkeletonBlockerCard
}
