import { lazyWithPreload } from "./lazy-preload";

// Shelter pages with preload capability for instant navigation
export const ShelterCommunications = lazyWithPreload(() => import("@/pages/shelter-communications"));
export const ShelterCheckout = lazyWithPreload(() => import("@/pages/shelter-checkout"));
export const ShelterTaskAutomation = lazyWithPreload(() => import("@/pages/shelter-task-automation"));
export const ShelterMedical = lazyWithPreload(() => import("@/pages/shelter-medical"));
export const ShelterFoster = lazyWithPreload(() => import("@/pages/shelter-foster"));
export const ShelterApplications = lazyWithPreload(() => import("@/pages/shelter-applications"));
export const ShelterIntake = lazyWithPreload(() => import("@/pages/shelter-intake"));
export const ShelterDogs = lazyWithPreload(() => import("@/pages/shelter-dogs"));
export const ShelterTasks = lazyWithPreload(() => import("@/pages/shelter-tasks"));
export const ShelterCalendar = lazyWithPreload(() => import("@/pages/shelter-calendar"));
export const ShelterStaffPage = lazyWithPreload(() => import("@/pages/shelter-staff"));
export const ShelterAnalytics = lazyWithPreload(() => import("@/pages/shelter-analytics"));
export const ShelterSettings = lazyWithPreload(() => import("@/pages/shelter-settings"));
export const ShelterApplicationBuilder = lazyWithPreload(() => import("@/pages/shelter-application-builder"));
export const ShelterDonations = lazyWithPreload(() => import("@/pages/shelter-donations"));
export const ShelterResources = lazyWithPreload(() => import("@/pages/shelter/resources"));

// Core Shelter CRM Mega-Modules with preload
export const ShelterOperations = lazyWithPreload(() => import("@/pages/shelter/operations"));
export const ShelterPipeline = lazyWithPreload(() => import("@/pages/shelter/pipeline"));
export const ShelterApplicationsCRM = lazyWithPreload(() => import("@/pages/shelter/applications-crm"));
export const ShelterAutomation = lazyWithPreload(() => import("@/pages/shelter/automation"));
export const ShelterDogDetail = lazyWithPreload(() => import("@/pages/shelter/dog-detail"));
export const ShelterInbox = lazyWithPreload(() => import("@/pages/shelter/inbox"));
export const ShelterBulkOperations = lazyWithPreload(() => import("@/pages/shelter/bulk-operations"));
export const ShelterPlugins = lazyWithPreload(() => import("@/pages/shelter/plugins"));

// Preload function for all shelter modules - called by ShelterLayout on mount
export function preloadShelterModules() {
  // Core work pages (highest priority - preload immediately)
  ShelterOperations.preload();
  ShelterPipeline.preload();
  ShelterIntake.preload();
  ShelterApplications.preload();
  ShelterMedical.preload();
  ShelterFoster.preload();
  ShelterInbox.preload();
  
  // Secondary pages (preload after a short delay)
  setTimeout(() => {
    ShelterCalendar.preload();
    ShelterTasks.preload();
    ShelterStaffPage.preload();
    ShelterAnalytics.preload();
    ShelterSettings.preload();
    ShelterAutomation.preload();
    ShelterApplicationBuilder.preload();
    ShelterApplicationsCRM.preload();
    ShelterDogDetail.preload();
    ShelterDogs.preload();
  }, 100);
  
  // Tertiary pages (preload after a longer delay)
  setTimeout(() => {
    ShelterCommunications.preload();
    ShelterCheckout.preload();
    ShelterTaskAutomation.preload();
    ShelterDonations.preload();
    ShelterResources.preload();
    ShelterBulkOperations.preload();
    ShelterPlugins.preload();
  }, 200);
}
