import { useQuery } from "@tanstack/react-query";
import { FEATURE_FLAG_KEYS } from "@shared/schema";
import type { ReactNode } from "react";

interface FeatureFlagsResponse {
  enabledFeatures: string[];
}

export function useFeatureFlags() {
  return useQuery<FeatureFlagsResponse>({
    queryKey: ["/api/features"],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useFeatureFlag(key: keyof typeof FEATURE_FLAG_KEYS) {
  const { data, isLoading } = useFeatureFlags();
  const flagKey = FEATURE_FLAG_KEYS[key];
  const isEnabled = data?.enabledFeatures?.includes(flagKey) ?? true;
  return { isEnabled, isLoading };
}

interface FeatureGateProps {
  feature: keyof typeof FEATURE_FLAG_KEYS;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps): ReactNode {
  const { isEnabled, isLoading } = useFeatureFlag(feature);
  
  if (isLoading) {
    return null;
  }
  
  if (!isEnabled) {
    return fallback;
  }
  
  return children;
}
