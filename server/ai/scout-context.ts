// Scout Context Orchestrator - Assembles rich context for AI calls
// This module fetches and structures all relevant user data for personalized AI responses

import { db, schema } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
import type { UserProfile, Dog, ScoutInsight, ChatMessage } from "@shared/schema";

// Simple in-memory cache with TTL for frequently accessed data
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const contextCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 60000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = contextCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  if (entry) {
    contextCache.delete(key); // Clean up expired entry
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  contextCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// Invalidate cache for a specific user (call on writes)
export function invalidateUserContextCache(userId: string): void {
  const keysToDelete: string[] = [];
  contextCache.forEach((_, key) => {
    if (key.startsWith(`user:${userId}:`)) {
      keysToDelete.push(key);
    }
  });
  for (const key of keysToDelete) {
    contextCache.delete(key);
  }
}

// Types for the context orchestrator
export interface ScoutContext {
  // User profile data
  profile: UserProfileContext | null;
  
  // Household pets (critical for compatibility matching)
  householdPets: HouseholdPetContext[];
  
  // Adoption journey status
  journeyStatus: JourneyContext | null;
  
  // Behavioral signals
  likedDogs: DogSummary[];
  passedDogs: DogSummary[];
  
  // AI-learned insights
  insights: InsightSummary[];
  
  // Swipe patterns for preference inference
  swipePatterns: SwipePatterns;
  
  // Recent activity summary
  activitySummary: string;
}

export interface UserProfileContext {
  homeType: string;
  hasYard: boolean;
  hasOtherPets: boolean;
  otherPetsType?: string;
  activityLevel: string;
  workSchedule: string;
  experienceLevel: string;
  preferredSize?: string[];
  preferredAge?: string[];
  preferredEnergy?: string[];
  city?: string;
  state?: string;
  mode: string;
  // Family information (critical for matching)
  hasChildren: boolean;
  childrenAges?: string[];
  familySize?: number;
}

export interface HouseholdPetContext {
  name: string;
  species: string;
  breed?: string;
  age?: number;
  size?: string;
  energyLevel?: string;
  temperament?: string[];
  goodWithDogs: boolean;
  goodWithCats: boolean;
  goodWithKids: boolean;
}

export interface JourneyContext {
  dogName: string;
  dogBreed: string;
  currentStep: string;
  status: string;
  nextAction?: string;
  daysInJourney: number;
}

export interface DogSummary {
  name: string;
  breed: string;
  size: string;
  energyLevel: string;
  temperament: string[];
  goodWithKids: boolean;
  goodWithDogs: boolean;
  likedAt?: Date;
}

export interface InsightSummary {
  type: string;
  category: string;
  value: string;
  confidence: number;
}

export interface SwipePatterns {
  totalLikes: number;
  totalPasses: number;
  preferredSizes: Record<string, number>;
  preferredEnergy: Record<string, number>;
  preferredTemperaments: Record<string, number>;
  avoidedTraits: string[];
}

// Main context assembly function with caching for stable data
export async function assembleScoutContext(userId: string): Promise<ScoutContext> {
  // Check cache for stable data (profile, household, journey rarely change)
  const profileCacheKey = `user:${userId}:profile`;
  const householdCacheKey = `user:${userId}:household`;
  const journeyCacheKey = `user:${userId}:journey`;

  // Try to get cached data
  let userProfile = getCached<UserProfile | null>(profileCacheKey);
  let householdPetsData = getCached<any[]>(householdCacheKey);
  let journeys = getCached<any[]>(journeyCacheKey);

  // Fetch only what's not cached
  const fetchPromises: Promise<any>[] = [];
  const fetchMapping: string[] = [];

  if (userProfile === null && !contextCache.has(profileCacheKey)) {
    fetchPromises.push(fetchUserProfile(userId));
    fetchMapping.push('profile');
  }
  if (householdPetsData === null && !contextCache.has(householdCacheKey)) {
    fetchPromises.push(fetchHouseholdPets(userId));
    fetchMapping.push('household');
  }
  if (journeys === null && !contextCache.has(journeyCacheKey)) {
    fetchPromises.push(fetchActiveJourneys(userId));
    fetchMapping.push('journey');
  }

  // Always fetch dynamic data (swipes change frequently, don't cache long)
  fetchPromises.push(fetchLikedDogs(userId));
  fetchMapping.push('liked');
  fetchPromises.push(fetchPassedDogs(userId));
  fetchMapping.push('passed');
  fetchPromises.push(fetchUserInsights(userId));
  fetchMapping.push('insights');
  fetchPromises.push(fetchSwipePatternsFromDB(userId));
  fetchMapping.push('patterns');

  const results = await Promise.all(fetchPromises);

  // Map results back and cache stable data
  for (let i = 0; i < fetchMapping.length; i++) {
    const key = fetchMapping[i];
    const data = results[i];
    
    switch (key) {
      case 'profile':
        userProfile = data;
        setCache(profileCacheKey, data);
        break;
      case 'household':
        householdPetsData = data;
        setCache(householdCacheKey, data);
        break;
      case 'journey':
        journeys = data;
        setCache(journeyCacheKey, data);
        break;
    }
  }

  // Get dynamic data from results
  const likedIndex = fetchMapping.indexOf('liked');
  const passedIndex = fetchMapping.indexOf('passed');
  const insightsIndex = fetchMapping.indexOf('insights');
  const patternsIndex = fetchMapping.indexOf('patterns');

  const likedDogsData = results[likedIndex] as Dog[];
  const passedDogsData = results[passedIndex] as Dog[];
  const insights = results[insightsIndex] as any[];
  const swipePatterns = results[patternsIndex] as SwipePatterns;
  
  // Build journey context if active
  const journeyStatus = journeys && journeys.length > 0 ? buildJourneyContext(journeys[0]) : null;
  
  // Generate activity summary
  const activitySummary = generateActivitySummary(
    swipePatterns.totalLikes,
    swipePatterns.totalPasses,
    insights.length,
    journeyStatus
  );

  return {
    profile: userProfile ? mapProfileToContext(userProfile) : null,
    householdPets: (householdPetsData || []).map(mapHouseholdPetToContext),
    journeyStatus,
    likedDogs: likedDogsData.slice(0, 5).map(mapDogToSummary), // Last 5 liked
    passedDogs: passedDogsData.slice(0, 3).map(mapDogToSummary), // Last 3 passed
    insights: insights.map(mapInsightToSummary),
    swipePatterns,
    activitySummary,
  };
}

// Format context for injection into AI prompt
export function formatContextForPrompt(context: ScoutContext): string {
  const sections: string[] = [];

  // Profile section
  if (context.profile) {
    const p = context.profile;
    const sizes = p.preferredSize?.join(", ") || "any";
    const ages = p.preferredAge?.join(", ") || "any";
    const energies = p.preferredEnergy?.join(", ") || "any";
    
    // Build family info string
    let familyInfo = "";
    if (p.hasChildren && p.childrenAges && p.childrenAges.length > 0) {
      const ageLabels: Record<string, string> = {
        infant: "infant (0-1)",
        toddler: "toddler (1-3)",
        child: "child (4-12)",
        teen: "teenager (13-17)"
      };
      const agesFormatted = p.childrenAges.map(age => ageLabels[age] || age).join(", ");
      familyInfo = ` Has children: ${agesFormatted}.`;
    } else if (p.hasChildren) {
      familyInfo = " Has children.";
    } else if (p.hasChildren === false) {
      familyInfo = " No children.";
    }
    if (p.familySize) {
      familyInfo += ` Household size: ${p.familySize} people.`;
    }
    
    sections.push(`USER PROFILE: Lives in ${p.homeType}${p.hasYard ? " with yard" : " without yard"}${p.hasOtherPets ? `, has ${p.otherPetsType || 'other pets'}` : ""}.${familyInfo} ${p.activityLevel} activity level, ${p.workSchedule} work schedule, ${p.experienceLevel} dog experience. Prefers: sizes (${sizes}), ages (${ages}), energy (${energies}). Location: ${p.city || 'Unknown'}, ${p.state || 'Unknown'}.`);
  }

  // Household pets section (critical for compatibility)
  if (context.householdPets && context.householdPets.length > 0) {
    const petsInfo = context.householdPets.map(pet => {
      const traits: string[] = [];
      if (pet.goodWithDogs) traits.push("good with dogs");
      if (pet.goodWithCats) traits.push("good with cats");
      if (pet.goodWithKids) traits.push("good with kids");
      const compatibility = traits.length > 0 ? ` (${traits.join(", ")})` : "";
      return `${pet.name} (${pet.species}${pet.breed ? `, ${pet.breed}` : ""}${pet.size ? `, ${pet.size}` : ""}${pet.energyLevel ? `, ${pet.energyLevel} energy` : ""}${compatibility})`;
    }).join("; ");
    sections.push(`EXISTING HOUSEHOLD PETS: ${petsInfo}. IMPORTANT: New dog must be compatible with existing pets.`);
  }

  // Journey status
  if (context.journeyStatus) {
    const j = context.journeyStatus;
    sections.push(`ACTIVE ADOPTION JOURNEY: Applying for ${j.dogName} (${j.dogBreed}). Current step: ${j.currentStep}. Status: ${j.status}. ${j.nextAction ? `Next action: ${j.nextAction}.` : ""} Days in journey: ${j.daysInJourney}.`);
  }

  // Liked dogs (showing what they're attracted to)
  if (context.likedDogs.length > 0) {
    const likedSummary = context.likedDogs.map(d => 
      `${d.name} (${d.breed}, ${d.size}, ${d.energyLevel} energy)`
    ).join("; ");
    sections.push(`RECENTLY LIKED: ${likedSummary}`);
  }

  // AI insights (learned preferences)
  if (context.insights.length > 0) {
    const highConfidence = context.insights.filter(i => i.confidence >= 0.7);
    if (highConfidence.length > 0) {
      const insightSummary = highConfidence.map(i => 
        `${i.category}: ${i.value} (${Math.round(i.confidence * 100)}% confident)`
      ).join("; ");
      sections.push(`LEARNED PREFERENCES: ${insightSummary}`);
    }
  }

  // Swipe patterns (implicit preferences)
  if (context.swipePatterns.totalLikes > 5) {
    const patterns: string[] = [];
    
    // Find dominant size preference
    const topSize = Object.entries(context.swipePatterns.preferredSizes)
      .sort((a, b) => b[1] - a[1])[0];
    if (topSize && topSize[1] >= 3) {
      patterns.push(`prefers ${topSize[0]} dogs (${topSize[1]} likes)`);
    }
    
    // Find dominant energy preference
    const topEnergy = Object.entries(context.swipePatterns.preferredEnergy)
      .sort((a, b) => b[1] - a[1])[0];
    if (topEnergy && topEnergy[1] >= 3) {
      patterns.push(`gravitates toward ${topEnergy[0]} energy (${topEnergy[1]} likes)`);
    }

    // Top temperaments
    const topTemps = Object.entries(context.swipePatterns.preferredTemperaments)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .filter(t => t[1] >= 2);
    if (topTemps.length > 0) {
      patterns.push(`loves ${topTemps.map(t => t[0]).join(" and ")} dogs`);
    }

    if (patterns.length > 0) {
      sections.push(`SWIPE PATTERNS: ${patterns.join("; ")}`);
    }
  }

  // Activity summary
  sections.push(`ACTIVITY: ${context.activitySummary}`);

  return sections.join("\n");
}

// Helper functions
async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const results = await db.select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .limit(1);
  return results[0] || null;
}

async function fetchLikedDogs(userId: string): Promise<Dog[]> {
  // Fetch recent liked dogs with a single JOIN query
  const results = await db.select({
    dog: schema.dogs,
  })
    .from(schema.swipes)
    .innerJoin(schema.dogs, eq(schema.swipes.dogId, schema.dogs.id))
    .where(and(
      eq(schema.swipes.userId, userId),
      eq(schema.swipes.direction, "right")
    ))
    .orderBy(desc(schema.swipes.timestamp))
    .limit(10);

  return results.map(r => r.dog);
}

async function fetchPassedDogs(userId: string): Promise<Dog[]> {
  // Fetch recent passed dogs with a single JOIN query
  const results = await db.select({
    dog: schema.dogs,
  })
    .from(schema.swipes)
    .innerJoin(schema.dogs, eq(schema.swipes.dogId, schema.dogs.id))
    .where(and(
      eq(schema.swipes.userId, userId),
      eq(schema.swipes.direction, "left")
    ))
    .orderBy(desc(schema.swipes.timestamp))
    .limit(5);

  return results.map(r => r.dog);
}

// SQL-based swipe pattern aggregation - avoids in-memory loops
async function fetchSwipePatternsFromDB(userId: string): Promise<SwipePatterns> {
  // Aggregate size preferences using SQL
  const sizeAgg = await db.select({
    size: schema.dogs.size,
    count: sql<number>`count(*)::int`,
  })
    .from(schema.swipes)
    .innerJoin(schema.dogs, eq(schema.swipes.dogId, schema.dogs.id))
    .where(and(
      eq(schema.swipes.userId, userId),
      eq(schema.swipes.direction, "right")
    ))
    .groupBy(schema.dogs.size);

  // Aggregate energy preferences using SQL
  const energyAgg = await db.select({
    energyLevel: schema.dogs.energyLevel,
    count: sql<number>`count(*)::int`,
  })
    .from(schema.swipes)
    .innerJoin(schema.dogs, eq(schema.swipes.dogId, schema.dogs.id))
    .where(and(
      eq(schema.swipes.userId, userId),
      eq(schema.swipes.direction, "right")
    ))
    .groupBy(schema.dogs.energyLevel);

  // Get total counts
  const totalLikes = await db.select({
    count: sql<number>`count(*)::int`,
  })
    .from(schema.swipes)
    .where(and(
      eq(schema.swipes.userId, userId),
      eq(schema.swipes.direction, "right")
    ));

  const totalPasses = await db.select({
    count: sql<number>`count(*)::int`,
  })
    .from(schema.swipes)
    .where(and(
      eq(schema.swipes.userId, userId),
      eq(schema.swipes.direction, "left")
    ));

  // Convert aggregations to records
  const preferredSizes: Record<string, number> = {};
  for (const row of sizeAgg) {
    if (row.size) preferredSizes[row.size] = row.count;
  }

  const preferredEnergy: Record<string, number> = {};
  for (const row of energyAgg) {
    if (row.energyLevel) preferredEnergy[row.energyLevel] = row.count;
  }

  // For temperaments, we still need to aggregate in JS since it's an array column
  // But we limit to recent swipes only
  const recentLikes = await db.select({
    temperament: schema.dogs.temperament,
  })
    .from(schema.swipes)
    .innerJoin(schema.dogs, eq(schema.swipes.dogId, schema.dogs.id))
    .where(and(
      eq(schema.swipes.userId, userId),
      eq(schema.swipes.direction, "right")
    ))
    .orderBy(desc(schema.swipes.timestamp))
    .limit(50); // Bounded to prevent unbounded growth

  const preferredTemperaments: Record<string, number> = {};
  for (const row of recentLikes) {
    if (row.temperament) {
      for (const temp of row.temperament) {
        preferredTemperaments[temp] = (preferredTemperaments[temp] || 0) + 1;
      }
    }
  }

  // Get avoided traits from passed dogs (limited)
  const recentPasses = await db.select({
    temperament: schema.dogs.temperament,
  })
    .from(schema.swipes)
    .innerJoin(schema.dogs, eq(schema.swipes.dogId, schema.dogs.id))
    .where(and(
      eq(schema.swipes.userId, userId),
      eq(schema.swipes.direction, "left")
    ))
    .orderBy(desc(schema.swipes.timestamp))
    .limit(20);

  const passedTemps: Record<string, number> = {};
  for (const row of recentPasses) {
    if (row.temperament) {
      for (const temp of row.temperament) {
        passedTemps[temp] = (passedTemps[temp] || 0) + 1;
      }
    }
  }

  const avoidedTraits: string[] = [];
  for (const [temp, count] of Object.entries(passedTemps)) {
    if (count >= 2 && (preferredTemperaments[temp] || 0) <= 1) {
      avoidedTraits.push(temp);
    }
  }

  return {
    totalLikes: totalLikes[0]?.count || 0,
    totalPasses: totalPasses[0]?.count || 0,
    preferredSizes,
    preferredEnergy,
    preferredTemperaments,
    avoidedTraits,
  };
}

async function fetchUserInsights(userId: string): Promise<any[]> {
  try {
    return await db.select()
      .from(schema.scoutInsights)
      .where(and(
        eq(schema.scoutInsights.userId, userId),
        eq(schema.scoutInsights.isActive, true)
      ))
      .orderBy(desc(schema.scoutInsights.confidence))
      .limit(10);
  } catch (error) {
    console.warn("[Scout Context] No insights table or error fetching insights:", error);
    return [];
  }
}

async function fetchActiveJourneys(userId: string): Promise<any[]> {
  const journeys = await db.select()
    .from(schema.adoptionJourneys)
    .where(and(
      eq(schema.adoptionJourneys.userId, userId),
      eq(schema.adoptionJourneys.status, "active")
    ))
    .orderBy(desc(schema.adoptionJourneys.createdAt))
    .limit(1);

  if (journeys.length === 0) return [];

  // Fetch dog details for the journey
  const dog = await db.select()
    .from(schema.dogs)
    .where(eq(schema.dogs.id, journeys[0].dogId))
    .limit(1);

  return journeys.map(j => ({
    ...j,
    dog: dog[0] || null,
  }));
}

function mapProfileToContext(profile: UserProfile): UserProfileContext {
  return {
    homeType: profile.homeType || "unknown",
    hasYard: profile.hasYard || false,
    hasOtherPets: profile.hasOtherPets || false,
    otherPetsType: profile.otherPetsType || undefined,
    activityLevel: profile.activityLevel || "moderate",
    workSchedule: profile.workSchedule || "varies",
    experienceLevel: profile.experienceLevel || "some_experience",
    preferredSize: profile.preferredSize || undefined,
    preferredAge: profile.preferredAge || undefined,
    preferredEnergy: profile.preferredEnergy || undefined,
    city: profile.city || undefined,
    state: profile.state || undefined,
    mode: profile.mode,
    // Family information
    hasChildren: profile.hasChildren || false,
    childrenAges: profile.childrenAges || undefined,
    familySize: profile.familySize || undefined,
  };
}

async function fetchHouseholdPets(userId: string): Promise<any[]> {
  try {
    return await db.select()
      .from(schema.householdPets)
      .where(eq(schema.householdPets.userId, userId));
  } catch (error) {
    console.warn("[Scout Context] Error fetching household pets:", error);
    return [];
  }
}

function mapHouseholdPetToContext(pet: any): HouseholdPetContext {
  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed || undefined,
    age: pet.age || undefined,
    size: pet.size || undefined,
    energyLevel: pet.energyLevel || undefined,
    temperament: pet.temperament || undefined,
    goodWithDogs: pet.goodWithDogs || false,
    goodWithCats: pet.goodWithCats || false,
    goodWithKids: pet.goodWithKids || false,
  };
}

function mapDogToSummary(dog: Dog): DogSummary {
  return {
    name: dog.name,
    breed: dog.breed,
    size: dog.size,
    energyLevel: dog.energyLevel,
    temperament: dog.temperament,
    goodWithKids: dog.goodWithKids,
    goodWithDogs: dog.goodWithDogs,
  };
}

function mapInsightToSummary(insight: any): InsightSummary {
  return {
    type: insight.insightType || "preference",
    category: insight.category || "general",
    value: insight.value || "",
    confidence: insight.confidence || 0.5,
  };
}

function buildJourneyContext(journey: any): JourneyContext {
  const dog = journey.dog;
  const createdAt = new Date(journey.createdAt);
  const now = new Date();
  const daysInJourney = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  // Determine next action based on current step
  let nextAction: string | undefined;
  switch (journey.currentStep) {
    case "application":
      nextAction = "Complete application and wait for review";
      break;
    case "phone_screening":
      if (journey.phoneScreeningStatus === "pending") {
        nextAction = "Schedule your phone screening call";
      } else if (journey.phoneScreeningStatus === "scheduled") {
        nextAction = "Prepare for your upcoming phone screening";
      }
      break;
    case "meet_greet":
      nextAction = "Schedule your meet & greet with the shelter";
      break;
    case "adoption":
      nextAction = "Finalize adoption paperwork and bring your new friend home!";
      break;
  }

  return {
    dogName: dog?.name || "Unknown",
    dogBreed: dog?.breed || "Unknown",
    currentStep: journey.currentStep,
    status: journey.status,
    nextAction,
    daysInJourney,
  };
}


function generateActivitySummary(
  likedCount: number,
  passedCount: number,
  insightCount: number,
  journey: JourneyContext | null
): string {
  const parts: string[] = [];

  if (likedCount + passedCount === 0) {
    parts.push("New user, no swipe history yet");
  } else {
    parts.push(`${likedCount} dogs liked, ${passedCount} passed`);
  }

  if (journey) {
    parts.push(`actively pursuing ${journey.dogName}`);
  }

  if (insightCount > 0) {
    parts.push(`${insightCount} learned preferences`);
  }

  return parts.join(", ");
}
