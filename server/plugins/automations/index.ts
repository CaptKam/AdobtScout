import { storage } from '../../storage';
import { registerRuleEngine, unregisterRuleEngine } from './rule-engine';

let isEnabled = false;

export async function initAutomationsPlugin(): Promise<void> {
  const featureFlag = await storage.getFeatureFlag('automations_engine');
  
  if (featureFlag && featureFlag.isEnabled) {
    enablePlugin();
  } else {
    console.log('[Automations Plugin] Feature flag disabled - plugin not enabled');
  }
}

export function enablePlugin(): void {
  if (isEnabled) {
    console.log('[Automations Plugin] Already enabled');
    return;
  }
  
  registerRuleEngine();
  isEnabled = true;
  console.log('[Automations Plugin] Enabled');
}

export function disablePlugin(): void {
  if (!isEnabled) {
    console.log('[Automations Plugin] Already disabled');
    return;
  }
  
  unregisterRuleEngine();
  isEnabled = false;
  console.log('[Automations Plugin] Disabled');
}

export function isPluginEnabled(): boolean {
  return isEnabled;
}
