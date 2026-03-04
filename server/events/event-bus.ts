import { EventEmitter } from 'events';

export interface HealthScreeningRequestPayload {
  dogId: string | null;
  userId: string;
  screeningType: 'symptom_check' | 'image_analysis' | 'full_assessment' | 'intake_health_snapshot';
  symptoms?: string;
  images?: string[];
  dogContext?: string;
  petIdentification?: {
    breed?: string;
    breedConfidence?: string;
    size?: string;
    ageCategory?: string;
    coatColor?: string;
    estimatedWeight?: string;
  };
  intakeRecordId?: string;
  capturedBodyParts?: string[];
  photoEntries?: Array<{ area: string; image: string; description?: string }>;
}

export interface HealthScreeningAnalyzePayload {
  requestPayload: HealthScreeningRequestPayload;
  resolve: (result: HealthScreeningResult) => void;
  reject: (error: Error) => void;
}

export interface HealthScreeningResult {
  severity: 'low' | 'moderate' | 'high' | 'critical';
  recommendation: 'home_care' | 'monitor' | 'vet_visit' | 'emergency';
  conditions?: string[];
  analysis: string;
  careInstructions?: string;
  concernsByArea?: Array<{
    bodyArea: string;
    concern: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    actionNeeded: string;
  }>;
}

export interface HealthScreeningCompletedPayload {
  screeningId: string;
  dogId: string | null;
  userId: string;
  screeningType: string;
  result: HealthScreeningResult;
  intakeRecordId?: string;
}

export interface MedicalRecordAutoCreatePayload {
  dogId: string;
  userId: string;
  screeningId: string;
  result: HealthScreeningResult;
  intakeRecordId?: string;
}

// Automation Events - triggers for task rules
export interface DogIntakeCreatedPayload {
  dogId: string;
  shelterId: string;
  intakeRecordId: string;
  pipelineStatus: string;
}

export interface DogStatusChangedPayload {
  dogId: string;
  shelterId: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
}

export interface ApplicationReceivedPayload {
  applicationId: string;
  dogId: string;
  shelterId: string;
  adopterId: string;
  applicationType: string;
}

export interface MedicalDuePayload {
  dogId: string;
  shelterId: string;
  medicalRecordId: string;
  recordType: string;
  dueDate: Date;
}

export interface EventMap {
  'health_screening.analyze': HealthScreeningAnalyzePayload;
  'health_screening.completed': HealthScreeningCompletedPayload;
  'health_screening.auto_medical_records': MedicalRecordAutoCreatePayload;
  // Automation trigger events
  'dog.intake_created': DogIntakeCreatedPayload;
  'dog.status_changed': DogStatusChangedPayload;
  'application.received': ApplicationReceivedPayload;
  'medical.due': MedicalDuePayload;
}

type EventName = keyof EventMap;

class TypedEventBus extends EventEmitter {
  emit<K extends EventName>(event: K, payload: EventMap[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends EventName>(event: K, listener: (payload: EventMap[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends EventName>(event: K, listener: (payload: EventMap[K]) => void): this {
    return super.once(event, listener);
  }

  off<K extends EventName>(event: K, listener: (payload: EventMap[K]) => void): this {
    return super.off(event, listener);
  }

  removeAllListeners(event?: EventName): this {
    return super.removeAllListeners(event);
  }

  listenerCount(event: EventName): number {
    return super.listenerCount(event);
  }
}

export const eventBus = new TypedEventBus();

export async function emitAnalyzeRequest(payload: HealthScreeningRequestPayload): Promise<HealthScreeningResult> {
  return new Promise((resolve, reject) => {
    const hasListeners = eventBus.listenerCount('health_screening.analyze') > 0;
    if (!hasListeners) {
      reject(new Error('No health screening analyzer plugin registered'));
      return;
    }
    
    eventBus.emit('health_screening.analyze', {
      requestPayload: payload,
      resolve,
      reject,
    });
  });
}
