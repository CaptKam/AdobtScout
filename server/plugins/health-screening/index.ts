import { registerAIAnalyzer, unregisterAIAnalyzer } from './ai-analyzer';
import { registerAutoMedicalRecord, unregisterAutoMedicalRecord } from './auto-medical-record';
import { storage } from '../../storage';

let isEnabled = false;

export async function initHealthScreeningPlugin(): Promise<void> {
  const featureFlag = await storage.getFeatureFlag('ai_health_screening');
  
  if (featureFlag && featureFlag.isEnabled) {
    enablePlugin();
  } else {
    console.log('[Health Screening Plugin] Feature flag disabled - plugin not enabled');
  }
}

export function enablePlugin(): void {
  if (isEnabled) {
    console.log('[Health Screening Plugin] Already enabled');
    return;
  }
  
  registerAIAnalyzer();
  registerAutoMedicalRecord();
  isEnabled = true;
  console.log('[Health Screening Plugin] Enabled');
}

export function disablePlugin(): void {
  if (!isEnabled) {
    console.log('[Health Screening Plugin] Already disabled');
    return;
  }
  
  unregisterAIAnalyzer();
  unregisterAutoMedicalRecord();
  isEnabled = false;
  console.log('[Health Screening Plugin] Disabled');
}

export function isPluginEnabled(): boolean {
  return isEnabled;
}

export { emitAnalyzeRequest } from '../../events/event-bus';
export { getCreatedMedicalRecordsSync } from './auto-medical-record';
