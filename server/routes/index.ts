import type { Express } from "express";
import { registerAuthRoutes } from "./auth";
import { registerDogsRoutes } from "./dogs";
import { registerShelterRoutes } from "./shelter";

/**
 * Register all modular route handlers.
 *
 * Route modules extracted from the monolithic routes.ts (12,305 LOC):
 * - auth.ts:    Auth routes (login, signup, OAuth, demo login, logout)
 * - dogs.ts:    Consumer dog discovery, compatibility, swipes, map, shelters
 * - shelter.ts: Shelter CRM routes (staff, dogs, medical, tasks, inbox, etc.)
 *
 * Routes still in the main routes.ts (to be extracted incrementally):
 * - Admin routes (/api/admin/*)
 * - AI/Chat routes (/api/chat, /api/analyze, etc.)
 * - User profile routes (/api/profile, /api/onboarding, etc.)
 * - Adoption journey routes (/api/adoption-journeys/*)
 */
export function registerModularRoutes(app: Express) {
  registerAuthRoutes(app);
  registerDogsRoutes(app);
  registerShelterRoutes(app);
}
