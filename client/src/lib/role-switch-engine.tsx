import { createContext, useContext, useCallback, useMemo, useState, useEffect, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { UserProfile } from '@shared/schema';

export type UserMode = 'adopt' | 'foster' | 'rehome';

interface ModeConfig {
  label: string;
  description: string;
  icon: 'Heart' | 'Home' | 'HeartHandshake';
  color: string;
  bgColor: string;
  discoverTitle: string;
  discoverSubtitle: string;
}

const MODE_TOKEN_CLASSES = {
  adopt: {
    text: 'text-[hsl(var(--mode-adopt))]',
    bg: 'bg-[hsl(var(--mode-adopt))]',
    bgMuted: 'bg-[hsl(var(--mode-adopt-muted))]',
    textForeground: 'text-[hsl(var(--mode-adopt-foreground))]',
    border: 'border-[hsl(var(--mode-adopt-border))]',
    ring: 'ring-[hsl(var(--mode-adopt))]',
    fill: 'fill-[hsl(var(--mode-adopt))]',
    stroke: 'stroke-[hsl(var(--mode-adopt))]',
    hoverBg: 'hover:bg-[hsl(var(--mode-adopt))]',
    bgOpacity: 'bg-[hsl(var(--mode-adopt)/0.1)]',
  },
  foster: {
    text: 'text-[hsl(var(--mode-foster))]',
    bg: 'bg-[hsl(var(--mode-foster))]',
    bgMuted: 'bg-[hsl(var(--mode-foster-muted))]',
    textForeground: 'text-[hsl(var(--mode-foster-foreground))]',
    border: 'border-[hsl(var(--mode-foster-border))]',
    ring: 'ring-[hsl(var(--mode-foster))]',
    fill: 'fill-[hsl(var(--mode-foster))]',
    stroke: 'stroke-[hsl(var(--mode-foster))]',
    hoverBg: 'hover:bg-[hsl(var(--mode-foster))]',
    bgOpacity: 'bg-[hsl(var(--mode-foster)/0.1)]',
  },
  rehome: {
    text: 'text-[hsl(var(--mode-rehome))]',
    bg: 'bg-[hsl(var(--mode-rehome))]',
    bgMuted: 'bg-[hsl(var(--mode-rehome-muted))]',
    textForeground: 'text-[hsl(var(--mode-rehome-foreground))]',
    border: 'border-[hsl(var(--mode-rehome-border))]',
    ring: 'ring-[hsl(var(--mode-rehome))]',
    fill: 'fill-[hsl(var(--mode-rehome))]',
    stroke: 'stroke-[hsl(var(--mode-rehome))]',
    hoverBg: 'hover:bg-[hsl(var(--mode-rehome))]',
    bgOpacity: 'bg-[hsl(var(--mode-rehome)/0.1)]',
  },
} as const;

// Helper function to get mode classes for any mode
export function getModeClasses(mode: UserMode) {
  return MODE_TOKEN_CLASSES[mode];
}

export const MODE_CONFIGS: Record<UserMode, ModeConfig> = {
  adopt: {
    label: 'Adopt',
    description: 'Find your perfect companion',
    icon: 'Heart',
    color: MODE_TOKEN_CLASSES.adopt.text,
    bgColor: MODE_TOKEN_CLASSES.adopt.bgMuted,
    discoverTitle: 'Find Your Match',
    discoverSubtitle: 'Swipe to discover dogs looking for forever homes',
  },
  foster: {
    label: 'Foster',
    description: 'Provide temporary care',
    icon: 'Home',
    color: MODE_TOKEN_CLASSES.foster.text,
    bgColor: MODE_TOKEN_CLASSES.foster.bgMuted,
    discoverTitle: 'Dogs Need Foster Care',
    discoverSubtitle: 'Help dogs in need of temporary loving homes',
  },
  rehome: {
    label: 'Rehome',
    description: 'Find help for your dog',
    icon: 'HeartHandshake',
    color: MODE_TOKEN_CLASSES.rehome.text,
    bgColor: MODE_TOKEN_CLASSES.rehome.bgMuted,
    discoverTitle: 'Find Foster Volunteers',
    discoverSubtitle: 'Connect with caring people who can help your dog',
  },
};

export { MODE_TOKEN_CLASSES };

interface RehomeData {
  phoneNumber: string;
  reasonForRehoming: string;
  city: string;
  state: string;
}

interface FosterData {
  fosterTimeCommitment?: string;
  fosterSpecialNeedsWilling?: boolean;
  fosterEmergencyAvailability?: string;
  fosterPreviousExperience?: string;
}

interface SwitchModeOptions {
  rehomeData?: RehomeData;
  fosterData?: FosterData;
  skipValidation?: boolean;
}

interface RoleSwitchContextValue {
  currentMode: UserMode;
  pendingMode: UserMode | null;
  isTransitioning: boolean;
  isSyncing: boolean;
  profile: UserProfile | null | undefined;
  isProfileLoading: boolean;
  modeConfig: ModeConfig;
  switchMode: (newMode: UserMode, options?: SwitchModeOptions) => Promise<boolean>;
  canSwitchToRehome: () => { valid: boolean; missing: string[] };
  getModeConfig: (mode: UserMode) => ModeConfig;
  isAuthenticated: boolean;
}

const RoleSwitchContext = createContext<RoleSwitchContextValue | null>(null);

interface RoleSwitchProviderProps {
  children: ReactNode;
}

export function RoleSwitchProvider({ children }: RoleSwitchProviderProps) {
  const queryClient = useQueryClient();
  const [pendingMode, setPendingMode] = useState<UserMode | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { data: user } = useQuery<any>({
    queryKey: ['/api/me'],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch profile for any authenticated non-shelter user to get their mode
  // Previously restricted to 'adopter' or 'owner' roles which broke mode display
  const { data: profile, isLoading: isProfileLoading } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
    enabled: !!user && user.role !== 'shelter',
    staleTime: 5 * 60 * 1000,
    select: (data) => {
      if (data && !data.mode) {
        return { ...data, mode: 'adopt' as const };
      }
      return data;
    },
  });

  const isAuthenticated = !!user;

  const currentMode: UserMode = useMemo(() => {
    if (pendingMode) return pendingMode;
    return (profile?.mode as UserMode) || 'adopt';
  }, [profile?.mode, pendingMode]);

  const modeConfig = useMemo(() => MODE_CONFIGS[currentMode], [currentMode]);

  const switchModeMutation = useMutation({
    mutationFn: async ({ mode, data }: { mode: UserMode; data?: any }) => {
      const payload: any = { mode };
      if (data) {
        Object.assign(payload, data);
      }
      await apiRequest('PATCH', '/api/profile', payload);
      return mode;
    },
    onMutate: async ({ mode }) => {
      setIsTransitioning(true);
      setPendingMode(mode);

      await queryClient.cancelQueries({ queryKey: ['/api/profile'] });
      const previousProfile = queryClient.getQueryData<UserProfile>(['/api/profile']);

      if (previousProfile) {
        queryClient.setQueryData<UserProfile>(['/api/profile'], {
          ...previousProfile,
          mode,
        });
      }

      return { previousProfile };
    },
    onSuccess: (mode) => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dogs/discover'] });
      queryClient.invalidateQueries({ queryKey: ['/api/foster-volunteers'] });

      setTimeout(() => {
        setPendingMode(null);
        setIsTransitioning(false);
      }, 300);
    },
    onError: (error, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['/api/profile'], context.previousProfile);
      }
      setPendingMode(null);
      setIsTransitioning(false);
    },
  });

  const canSwitchToRehome = useCallback((): { valid: boolean; missing: string[] } => {
    const missing: string[] = [];
    
    if (!profile?.phoneNumber) missing.push('Phone number');
    if (!profile?.city) missing.push('City');
    if (!profile?.state) missing.push('State');
    
    return { valid: missing.length === 0, missing };
  }, [profile]);

  const switchMode = useCallback(async (
    newMode: UserMode,
    options?: SwitchModeOptions
  ): Promise<boolean> => {
    if (newMode === currentMode && !pendingMode) {
      return true;
    }

    if (newMode === 'rehome' && !options?.skipValidation) {
      const { valid, missing } = canSwitchToRehome();
      if (!valid && !options?.rehomeData) {
        return false;
      }
    }

    try {
      let data: any = {};
      
      if (options?.rehomeData) {
        data = {
          phoneNumber: options.rehomeData.phoneNumber,
          reasonForRehoming: options.rehomeData.reasonForRehoming,
          city: options.rehomeData.city,
          state: options.rehomeData.state,
        };
      }
      
      if (options?.fosterData) {
        Object.assign(data, options.fosterData);
      }

      await switchModeMutation.mutateAsync({ mode: newMode, data: Object.keys(data).length > 0 ? data : undefined });
      return true;
    } catch (error) {
      console.error('[RoleSwitchEngine] Failed to switch mode:', error);
      return false;
    }
  }, [currentMode, pendingMode, canSwitchToRehome, switchModeMutation]);

  const getModeConfig = useCallback((mode: UserMode): ModeConfig => {
    return MODE_CONFIGS[mode];
  }, []);

  const value: RoleSwitchContextValue = useMemo(() => ({
    currentMode,
    pendingMode,
    isTransitioning,
    isSyncing: switchModeMutation.isPending,
    profile,
    isProfileLoading,
    modeConfig,
    switchMode,
    canSwitchToRehome,
    getModeConfig,
    isAuthenticated,
  }), [
    currentMode,
    pendingMode,
    isTransitioning,
    switchModeMutation.isPending,
    profile,
    isProfileLoading,
    modeConfig,
    switchMode,
    canSwitchToRehome,
    getModeConfig,
    isAuthenticated,
  ]);

  return (
    <RoleSwitchContext.Provider value={value}>
      {children}
    </RoleSwitchContext.Provider>
  );
}

export function useRoleSwitch(): RoleSwitchContextValue {
  const context = useContext(RoleSwitchContext);
  if (!context) {
    throw new Error('useRoleSwitch must be used within a RoleSwitchProvider');
  }
  return context;
}

export function useCurrentMode(): UserMode {
  const { currentMode } = useRoleSwitch();
  return currentMode;
}

export function useModeConfig(): ModeConfig {
  const { modeConfig } = useRoleSwitch();
  return modeConfig;
}

export function useModeSwitcher() {
  const { switchMode, pendingMode, isTransitioning, isSyncing, canSwitchToRehome } = useRoleSwitch();
  return {
    switchMode,
    pendingMode,
    isTransitioning,
    isSyncing,
    canSwitchToRehome,
    isLoading: isTransitioning || isSyncing,
  };
}
