import type { Dog, IntakeRecord } from '@shared/schema';

export interface DogWithIntake extends Dog {
  intake: IntakeRecord | null;
}

export interface DogBlockers {
  intakeIncomplete: boolean;
  medicalIncomplete: boolean;
  behaviorIncomplete: boolean;
  photosMissing: boolean;
  strayHoldActive: boolean;
  legalHoldActive: boolean;
  
  hasAnyBlocker: boolean;
  criticalBlockers: string[];
  warningBlockers: string[];
}

export function deriveBlockers(dog: DogWithIntake): DogBlockers {
  const intake = dog.intake;
  const pipelineStatus = intake?.pipelineStatus || 'intake';
  
  // Prefer intake record for hold state (source of truth), fallback to dog record (synced)
  const holdType = intake?.holdType || dog.holdType;
  const holdExpiresAt = intake?.holdExpiresAt || dog.holdExpiresAt;
  const holdActive = holdType && (!holdExpiresAt || new Date(holdExpiresAt) > new Date());
  
  const intakeIncomplete = pipelineStatus === 'intake' && !intake?.intakeDate;
  
  const medicalIncomplete = pipelineStatus === 'medical_hold' || 
    (holdType === 'medical_hold' && holdActive);
  
  const behaviorIncomplete = pipelineStatus === 'behavior_eval';
  
  const photosMissing = !dog.photos || dog.photos.length === 0;
  
  const strayHoldActive = holdType === 'stray_hold' && holdActive;
  
  const legalHoldActive = holdType === 'legal_hold' && holdActive;

  const criticalBlockers: string[] = [];
  const warningBlockers: string[] = [];

  if (medicalIncomplete) {
    criticalBlockers.push('Medical clearance required');
  }
  if (strayHoldActive) {
    criticalBlockers.push('Stray hold active');
  }
  if (legalHoldActive) {
    criticalBlockers.push('Legal hold active');
  }
  if (intakeIncomplete) {
    warningBlockers.push('Intake incomplete');
  }
  if (behaviorIncomplete) {
    warningBlockers.push('Behavior evaluation needed');
  }
  if (photosMissing) {
    warningBlockers.push('No photos uploaded');
  }

  return {
    intakeIncomplete,
    medicalIncomplete,
    behaviorIncomplete,
    photosMissing,
    strayHoldActive,
    legalHoldActive,
    hasAnyBlocker: criticalBlockers.length > 0 || warningBlockers.length > 0,
    criticalBlockers,
    warningBlockers,
  };
}

export function getBlockerSummary(blockers: DogBlockers): string {
  if (blockers.criticalBlockers.length > 0) {
    return blockers.criticalBlockers[0];
  }
  if (blockers.warningBlockers.length > 0) {
    return blockers.warningBlockers[0];
  }
  return '';
}

export function getBlockerPriority(blockers: DogBlockers): 'critical' | 'warning' | 'none' {
  if (blockers.criticalBlockers.length > 0) return 'critical';
  if (blockers.warningBlockers.length > 0) return 'warning';
  return 'none';
}

export interface BlockerStats {
  totalBlocked: number;
  medicalHolds: number;
  strayHolds: number;
  behaviorNeeded: number;
  photosMissing: number;
  intakeIncomplete: number;
}

export function aggregateBlockerStats(dogs: DogWithIntake[]): BlockerStats {
  const stats: BlockerStats = {
    totalBlocked: 0,
    medicalHolds: 0,
    strayHolds: 0,
    behaviorNeeded: 0,
    photosMissing: 0,
    intakeIncomplete: 0,
  };

  for (const dog of dogs) {
    const blockers = deriveBlockers(dog);
    if (blockers.hasAnyBlocker) {
      stats.totalBlocked++;
    }
    if (blockers.medicalIncomplete) stats.medicalHolds++;
    if (blockers.strayHoldActive) stats.strayHolds++;
    if (blockers.behaviorIncomplete) stats.behaviorNeeded++;
    if (blockers.photosMissing) stats.photosMissing++;
    if (blockers.intakeIncomplete) stats.intakeIncomplete++;
  }

  return stats;
}

export interface TodaysBlocker {
  dogId: string;
  dogName: string;
  blockerType: 'medical' | 'stray_hold' | 'legal_hold' | 'behavior' | 'intake' | 'photos';
  description: string;
  priority: 'critical' | 'warning';
  daysBlocked?: number;
  pipelineUrl: string;
}

export function getTodaysBlockers(dogs: DogWithIntake[], limit: number = 3): TodaysBlocker[] {
  const blockersList: TodaysBlocker[] = [];

  for (const dog of dogs) {
    const blockers = deriveBlockers(dog);
    const intake = dog.intake;
    
    if (blockers.medicalIncomplete) {
      const statusChangedAt = intake?.pipelineStatusChangedAt 
        ? new Date(intake.pipelineStatusChangedAt) 
        : new Date();
      const daysBlocked = Math.floor((Date.now() - statusChangedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      blockersList.push({
        dogId: dog.id,
        dogName: dog.name,
        blockerType: 'medical',
        description: `Medical clearance ${daysBlocked > 0 ? `overdue by ${daysBlocked} day${daysBlocked > 1 ? 's' : ''}` : 'required'}`,
        priority: 'critical',
        daysBlocked,
        pipelineUrl: `/shelter/pipeline?focus=${dog.id}`,
      });
    }
    
    if (blockers.strayHoldActive) {
      blockersList.push({
        dogId: dog.id,
        dogName: dog.name,
        blockerType: 'stray_hold',
        description: 'Stray hold period active',
        priority: 'critical',
        pipelineUrl: `/shelter/pipeline?focus=${dog.id}`,
      });
    }
    
    if (blockers.legalHoldActive) {
      blockersList.push({
        dogId: dog.id,
        dogName: dog.name,
        blockerType: 'legal_hold',
        description: 'Legal hold - cannot proceed',
        priority: 'critical',
        pipelineUrl: `/shelter/pipeline?focus=${dog.id}`,
      });
    }

    if (blockers.intakeIncomplete) {
      const intakeDate = intake?.intakeDate ? new Date(intake.intakeDate) : new Date();
      const daysInIntake = Math.floor((Date.now() - intakeDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysInIntake >= 2) {
        blockersList.push({
          dogId: dog.id,
          dogName: dog.name,
          blockerType: 'intake',
          description: `Stuck in intake for ${daysInIntake} days`,
          priority: daysInIntake > 3 ? 'critical' : 'warning',
          daysBlocked: daysInIntake,
          pipelineUrl: `/shelter/pipeline?focus=${dog.id}`,
        });
      }
    }
    
    if (blockers.behaviorIncomplete) {
      const statusChangedAt = intake?.pipelineStatusChangedAt 
        ? new Date(intake.pipelineStatusChangedAt) 
        : new Date();
      const daysBlocked = Math.floor((Date.now() - statusChangedAt.getTime()) / (1000 * 60 * 60 * 24));
      
      blockersList.push({
        dogId: dog.id,
        dogName: dog.name,
        blockerType: 'behavior',
        description: daysBlocked > 0 ? `Behavior eval pending ${daysBlocked} day${daysBlocked > 1 ? 's' : ''}` : 'Behavior evaluation needed',
        priority: daysBlocked > 3 ? 'critical' : 'warning',
        daysBlocked,
        pipelineUrl: `/shelter/pipeline?focus=${dog.id}`,
      });
    }
    
    if (blockers.photosMissing && intake?.pipelineStatus === 'pre_adoption_hold') {
      blockersList.push({
        dogId: dog.id,
        dogName: dog.name,
        blockerType: 'photos',
        description: 'Pre-adoption items pending',
        priority: 'warning',
        pipelineUrl: `/shelter/pipeline?focus=${dog.id}`,
      });
    }
  }

  return blockersList
    .sort((a, b) => {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (a.priority !== 'critical' && b.priority === 'critical') return 1;
      return (b.daysBlocked || 0) - (a.daysBlocked || 0);
    })
    .slice(0, limit);
}
