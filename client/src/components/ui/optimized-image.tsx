import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  loading?: "lazy" | "eager";
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  className,
  containerClassName,
  loading = "lazy",
  onLoad,
  onError,
  priority = false,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted",
          containerClassName
        )}
      >
        <div className="text-muted-foreground text-4xl">🐕</div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : loading}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
      />
    </div>
  );
}

export function getOptimizedImageUrl(url: string, width?: number, quality: number = 75): string {
  if (!url) return url;
  
  if (url.includes("unsplash.com")) {
    const separator = url.includes("?") ? "&" : "?";
    const params = [];
    
    if (width) {
      params.push(`w=${width}`);
    }
    params.push(`q=${quality}`);
    params.push("auto=format");
    params.push("fit=crop");
    
    return `${url}${separator}${params.join("&")}`;
  }
  
  return url;
}

export function getMarkerImageUrl(url: string): string {
  return getOptimizedImageUrl(url, 150, 60);
}

export function getCardImageUrl(url: string): string {
  return getOptimizedImageUrl(url, 600, 75);
}

export function getResponsiveImageUrls(url: string): { small: string; medium: string; large: string } {
  return {
    small: getOptimizedImageUrl(url, 200),
    medium: getOptimizedImageUrl(url, 400),
    large: getOptimizedImageUrl(url, 800),
  };
}
