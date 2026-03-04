import { create } from 'zustand';
import type { Dog, IntakeRecord } from '@shared/schema';

export interface DogWithIntake extends Dog {
  intake: IntakeRecord | null;
}

export type TransitionSource = 'drag' | 'panel' | 'automation' | 'task' | 'quick_action' | 'bulk';

export interface TransitionResult {
  success: boolean;
  error?: string;
  fromStage: string;
  toStage: string;
  source: TransitionSource;
}

interface TransitionRules {
  blockedTransitions: Record<string, string[]>;
  requiredConditions: Record<string, (dog: DogWithIntake) => { allowed: boolean; reason?: string }>;
}

const TRANSITION_RULES: TransitionRules = {
  // Stages that cannot transition directly to other stages
  blockedTransitions: {
    intake: ['adopted'], // Cannot go directly from intake to adopted
    stray_hold: ['adopted', 'featured'], // Must complete hold period first
  },
  // Conditions that must be met to leave certain stages
  requiredConditions: {
    medical_hold: (dog) => {
      // Check if medical hold has been cleared:
      // - holdType is null (cleared)
      // - holdType is different from 'medical' (e.g., changed to something else)
      // - holdExpiresAt has passed (hold period ended)
      const holdCleared = !dog.holdType || dog.holdType !== 'medical';
      const holdExpired = dog.holdExpiresAt && new Date(dog.holdExpiresAt) < new Date();
      
      if (holdCleared || holdExpired) {
        return { allowed: true };
      }
      
      return { 
        allowed: false, 
        reason: 'Medical clearance required. Clear the medical hold before moving this pet.' 
      };
    },
    pre_adoption_hold: (dog) => {
      const hasPhotos = dog.photos && dog.photos.length > 0;
      return { 
        allowed: true, // Allow but warn
        reason: hasPhotos ? undefined : 'Photos and other items pending' 
      };
    },
    featured: (dog) => {
      const hasPhotos = dog.photos && dog.photos.length > 0;
      return {
        allowed: hasPhotos,
        reason: hasPhotos ? undefined : 'Featured pets require at least one photo'
      };
    },
  },
};

interface PipelineState {
  dogs: DogWithIntake[];
  previousState: DogWithIntake[] | null;
  lastTransition: TransitionResult | null;
  
  // Core actions
  setDogs: (dogs: DogWithIntake[]) => void;
  rollback: () => void;
  
  // Centralized transition function - SINGLE SOURCE OF TRUTH
  transitionDogStage: (params: {
    dogId: string;
    toStage: string;
    source: TransitionSource;
    reason?: string;
  }) => TransitionResult;
  
  // Validation function
  canTransition: (dog: DogWithIntake, toStage: string) => { allowed: boolean; reason?: string };
  
  // Helper to get current stage
  getDogStage: (dogId: string) => string | null;
  
  // Legacy support - wraps transitionDogStage
  moveDog: (dogId: string, toStage: string) => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  dogs: [],
  previousState: null,
  lastTransition: null,
  
  setDogs: (dogs) => set({ dogs }),
  
  getDogStage: (dogId) => {
    const dog = get().dogs.find(d => d.id === dogId);
    if (!dog) return null;
    const status = dog.intake?.pipelineStatus || 'intake';
    if (status === 'intake' && dog.intake?.holdType === 'stray_hold') {
      return 'stray_hold';
    }
    return status;
  },
  
  canTransition: (dog, toStage) => {
    const currentStage = dog.intake?.pipelineStatus || 'intake';
    
    // Check blocked transitions
    const blocked = TRANSITION_RULES.blockedTransitions[currentStage];
    if (blocked && blocked.includes(toStage)) {
      return {
        allowed: false,
        reason: `Cannot move directly from ${currentStage} to ${toStage}`,
      };
    }
    
    // Check required conditions for entering certain stages
    const conditionCheck = TRANSITION_RULES.requiredConditions[toStage];
    if (conditionCheck) {
      return conditionCheck(dog);
    }
    
    // Check conditions for leaving current stage
    const exitCondition = TRANSITION_RULES.requiredConditions[currentStage];
    if (exitCondition) {
      const result = exitCondition(dog);
      if (!result.allowed) {
        return result;
      }
    }
    
    return { allowed: true };
  },
  
  transitionDogStage: ({ dogId, toStage, source, reason }) => {
    const current = get().dogs;
    const dog = current.find(d => d.id === dogId);
    
    if (!dog) {
      return {
        success: false,
        error: 'Dog not found',
        fromStage: 'unknown',
        toStage,
        source,
      };
    }
    
    const fromStage = dog.intake?.pipelineStatus || 'intake';
    
    // Skip if no change
    if (fromStage === toStage) {
      return {
        success: true,
        fromStage,
        toStage,
        source,
      };
    }
    
    // Validate transition
    const validation = get().canTransition(dog, toStage);
    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason,
        fromStage,
        toStage,
        source,
      };
    }
    
    // Store previous state for rollback
    set({ previousState: current });
    
    // Update the dog's stage
    set({
      dogs: current.map((d) => {
        if (d.id !== dogId) return d;
        return {
          ...d,
          intake: d.intake 
            ? { ...d.intake, pipelineStatus: toStage, pipelineStatusChangedAt: new Date() }
            : {
                id: `temp-${Date.now()}`,
                dogId,
                shelterId: d.shelterId || '',
                intakeDate: new Date(),
                intakeType: 'owner_surrender',
                pipelineStatus: toStage,
                pipelineStatusChangedAt: new Date(),
                initialCondition: 'good',
              } as IntakeRecord,
        };
      }),
      lastTransition: {
        success: true,
        fromStage,
        toStage,
        source,
      },
    });
    
    // Log transition for debugging (in production, this would go to analytics)
    console.log(`[Pipeline] ${dog.name}: ${fromStage} → ${toStage} (source: ${source}${reason ? `, reason: ${reason}` : ''})`);
    
    return {
      success: true,
      fromStage,
      toStage,
      source,
    };
  },
  
  // Legacy support - wraps the new centralized function
  moveDog: (dogId, toStage) => {
    get().transitionDogStage({
      dogId,
      toStage,
      source: 'drag', // Default to drag for backward compatibility
    });
  },
  
  rollback: () => {
    const prev = get().previousState;
    if (prev) {
      set({ dogs: prev, previousState: null, lastTransition: null });
    }
  },
}));

// Selector hooks for common patterns
export const useDogFromStore = (dogId: string | null) => 
  usePipelineStore((state) => dogId ? state.dogs.find(d => d.id === dogId) : null);

export const useTransitionDog = () => 
  usePipelineStore((state) => state.transitionDogStage);

export const useCanTransition = () =>
  usePipelineStore((state) => state.canTransition);

// Memoized selector for dogs grouped by stage - avoids recalculation on every render
const stageCache = new Map<string, Record<string, DogWithIntake[]>>();
let lastDogsRef: DogWithIntake[] | null = null;

export const useDogsByStage = () => 
  usePipelineStore((state) => {
    // Return cached result if dogs array hasn't changed
    if (state.dogs === lastDogsRef && stageCache.has('result')) {
      return stageCache.get('result')!;
    }
    
    const result: Record<string, DogWithIntake[]> = {};
    for (const dog of state.dogs) {
      let stage = dog.intake?.pipelineStatus || 'intake';
      // Handle stray_hold special case
      if (stage === 'intake' && dog.intake?.holdType === 'stray_hold') {
        stage = 'stray_hold';
      }
      if (!result[stage]) result[stage] = [];
      result[stage].push(dog);
    }
    
    // Cache the result
    lastDogsRef = state.dogs;
    stageCache.set('result', result);
    
    return result;
  });
