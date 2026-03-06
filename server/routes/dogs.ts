import type { Express } from "express";
import { storage } from "../storage";
import { calculateCompatibility } from "../ai/scout";
import type { DogWithCompatibility } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "../db";
import { cache, CACHE_KEYS, CACHE_TTL } from "../cache";

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Rule-based compatibility calculation (normalized scoring with proper distribution)
// Score ranges: 40-55 (poor), 55-70 (fair), 70-80 (good), 80-90 (great), 90+ (excellent)
// Uses per-category clamping to ensure scores spread across 50-90 range
function calculateRuleBasedCompatibility(
  dog: any,
  userProfile: any,
  distance: number,
  householdPets?: any[]
): { score: number; reasons: string[] } {
  let score = 50; // Neutral baseline
  const reasons: string[] = [];
  const concerns: string[] = [];
  let dealBreakerCap: number | null = null;

  if (userProfile) {
    // ============================================
    // DEAL-BREAKER CHECKS (set hard caps first)
    // ============================================

    const hasOtherDogs = householdPets?.some(pet => pet.species === 'dog') ?? false;
    const hasCats = householdPets?.some(pet => pet.species === 'cat') ?? false;

    // DEAL-BREAKER: Dog not good with existing dogs
    if (hasOtherDogs && dog.goodWithDogs === false) {
      dealBreakerCap = Math.min(dealBreakerCap ?? 100, 45);
      concerns.push(`Not recommended with your existing dogs`);
    }

    // DEAL-BREAKER: Dog not good with cats
    if (hasCats && dog.goodWithCats === false) {
      dealBreakerCap = Math.min(dealBreakerCap ?? 100, 45);
      concerns.push(`Not recommended with your cats`);
    }

    // DEAL-BREAKER: High-energy dog + apartment + low activity
    const isApartment = userProfile.homeType === 'apartment';
    const hasNoYard = !userProfile.hasYard;
    const isLowActivity = userProfile.activityLevel === 'low' || userProfile.activityLevel === 'sedentary';
    const isModerateActivity = userProfile.activityLevel === 'moderate' || userProfile.activityLevel === 'medium';
    const isHighEnergy = dog.energyLevel === 'high' || dog.energyLevel === 'very_high';

    // Only apply apartment cap for truly sedentary users - active adopters can handle high-energy dogs
    if (isApartment && hasNoYard && isLowActivity && isHighEnergy) {
      dealBreakerCap = Math.min(dealBreakerCap ?? 100, 45);
      concerns.push(`High-energy dog needs more active lifestyle`);
    } else if (isApartment && hasNoYard && isModerateActivity && isHighEnergy) {
      // Moderate cap for moderate activity in apartment
      dealBreakerCap = Math.min(dealBreakerCap ?? 100, 75);
      concerns.push(`High-energy dog in apartment - plan extra exercise`);
    }
    // Note: Active adopters in apartments with high-energy dogs = no cap

    // DEAL-BREAKER: Dog not good with kids + user has young children
    const hasYoungChildren = userProfile.hasChildren &&
      userProfile.childrenAges?.some((age: string) => {
        const ageNum = parseInt(age);
        return !isNaN(ageNum) && ageNum < 10;
      });

    if (hasYoungChildren && dog.goodWithKids === false) {
      dealBreakerCap = Math.min(dealBreakerCap ?? 100, 40);
      concerns.push(`Not recommended for homes with young children`);
    }

    // ============================================
    // LIFESTYLE FIT (capped at ±15 points)
    // ============================================
    let lifestyleScore = 0;

    const energyMap: Record<string, number> = {
      'low': 1, 'moderate': 2, 'medium': 2, 'high': 3, 'very_high': 4
    };
    const userEnergy = energyMap[userProfile.activityLevel] || 2;
    const dogEnergy = energyMap[dog.energyLevel] || 2;
    const energyDiff = Math.abs(userEnergy - dogEnergy);

    if (energyDiff === 0) {
      lifestyleScore += 10;
      reasons.push(`Perfect energy match for your lifestyle`);
    } else if (energyDiff === 1) {
      lifestyleScore += 5;
      reasons.push(`Good energy compatibility`);
    } else if (energyDiff === 2) {
      lifestyleScore -= 8;
      concerns.push(`Energy level mismatch`);
    } else {
      lifestyleScore -= 12;
      concerns.push(`Significant energy mismatch`);
    }

    // Preferred energy match (small bonus)
    if (userProfile.preferredEnergy?.includes(dog.energyLevel)) {
      lifestyleScore += 3;
    }

    // Clamp lifestyle score to ±15
    score += Math.max(-15, Math.min(15, lifestyleScore));

    // ============================================
    // LIVING SITUATION (capped at ±10 points)
    // ============================================
    const sizeSpaceResult = calculateSizeSpaceScore(dog.size, userProfile.homeType, userProfile.hasYard);
    const livingScore = Math.max(-10, Math.min(10, sizeSpaceResult.points));
    score += livingScore;
    if (sizeSpaceResult.reason) {
      if (livingScore > 0) reasons.push(sizeSpaceResult.reason);
      else if (livingScore < 0) concerns.push(sizeSpaceResult.reason);
    }

    // ============================================
    // HOUSEHOLD COMPATIBILITY (capped at ±12 points)
    // ============================================
    let householdScore = 0;

    if (hasOtherDogs && dog.goodWithDogs === true) {
      householdScore += 6;
      reasons.push(`Great with other dogs`);
    }

    if (hasCats && dog.goodWithCats === true) {
      householdScore += 5;
      reasons.push(`Cat-friendly`);
    }

    if (userProfile.hasChildren) {
      if (dog.goodWithKids === true) {
        householdScore += 6;
        reasons.push(`Great with children`);
      } else if (dog.goodWithKids === false) {
        householdScore -= 8;
      }
    }

    // Clamp household score to ±12
    score += Math.max(-12, Math.min(12, householdScore));

    // ============================================
    // PREFERENCES MATCH (capped at ±8 points)
    // ============================================
    let prefScore = 0;

    if (userProfile.preferredSize?.length > 0) {
      if (userProfile.preferredSize.includes(dog.size)) {
        prefScore += 4;
        reasons.push(`${dog.size} size matches preference`);
      } else {
        prefScore -= 4;
        concerns.push(`Not preferred size`);
      }
    }

    if (userProfile.preferredAge?.length > 0) {
      if (userProfile.preferredAge.includes(dog.ageCategory)) {
        prefScore += 4;
        reasons.push(`${dog.ageCategory} age matches preference`);
      } else {
        prefScore -= 4;
        concerns.push(`Not preferred age`);
      }
    }

    // Clamp preferences score to ±8
    score += Math.max(-8, Math.min(8, prefScore));

    // ============================================
    // EXPERIENCE (capped at ±5 points)
    // ============================================
    let expScore = 0;

    if (userProfile.experienceLevel === 'first_time') {
      if (dog.specialNeeds) {
        expScore -= 5;
        concerns.push(`Special needs - challenging for first-time owners`);
      } else if (dog.energyLevel === 'low' || dog.energyLevel === 'moderate') {
        expScore += 3;
        reasons.push(`Good for first-time adopters`);
      }
    } else if (userProfile.experienceLevel === 'experienced' && dog.specialNeeds) {
      expScore += 3;
      reasons.push(`Your experience suits special needs`);
    }

    score += Math.max(-5, Math.min(5, expScore));

  } else {
    // No user profile - use modest general appeal factors
    if (dog.goodWithKids) {
      score += 4;
      reasons.push(`Family-friendly`);
    }
    if (dog.goodWithDogs) {
      score += 3;
      reasons.push(`Gets along with other dogs`);
    }
    if (!dog.specialNeeds && (dog.energyLevel === 'moderate' || dog.energyLevel === 'medium')) {
      score += 4;
      reasons.push(`Easy-going companion`);
    }
  }

  // ============================================
  // PROXIMITY (capped at ±5 points)
  // ============================================
  let proximityScore = 0;
  if (distance < 5) {
    proximityScore = 5;
    reasons.push(`Just ${distance.toFixed(1)} miles away!`);
  } else if (distance < 15) {
    proximityScore = 3;
    reasons.push(`${distance.toFixed(1)} miles - easy visit`);
  } else if (distance < 30) {
    proximityScore = 1;
  } else if (distance > 50) {
    proximityScore = -3;
    concerns.push(`${distance.toFixed(0)} miles away`);
  }
  score += Math.max(-5, Math.min(5, proximityScore));

  // ============================================
  // APPLY DEAL-BREAKER CAP
  // ============================================
  if (dealBreakerCap !== null) {
    score = Math.min(score, dealBreakerCap);
  }

  // Final bounds: 30-92 (meaningful range without extremes)
  score = Math.max(30, Math.min(92, score));

  // Combine reasons, prioritizing positives then concerns
  const allReasons = reasons.length > 0 ? reasons : concerns;
  if (allReasons.length === 0) {
    allReasons.push(`${dog.name} could be a companion for you`);
  }

  return { score, reasons: allReasons };
}

// Helper: Calculate size vs living space compatibility
function calculateSizeSpaceScore(
  dogSize: string,
  homeType: string | undefined,
  hasYard: boolean | undefined
): { points: number; reason: string | null } {
  const isLargeDog = dogSize === 'large' || dogSize === 'extra_large' || dogSize === 'xlarge';
  const isMediumDog = dogSize === 'medium';
  const isSmallDog = dogSize === 'small' || dogSize === 'toy';
  const isApartment = homeType === 'apartment';
  const isHouse = homeType === 'house' || homeType === 'house_with_yard';

  if (isLargeDog) {
    if (isHouse && hasYard) {
      return { points: 10, reason: `Your house with yard is perfect for a large dog` };
    } else if (isHouse) {
      return { points: 5, reason: `House provides good space for a large dog` };
    } else if (isApartment) {
      return { points: -10, reason: `Large dog may need more space than apartment provides` };
    }
  } else if (isMediumDog) {
    if (hasYard) {
      return { points: 8, reason: `Your yard is great for a medium-sized dog` };
    } else if (isApartment) {
      return { points: 0, reason: null }; // Neutral
    } else {
      return { points: 5, reason: `Good living space for medium dog` };
    }
  } else if (isSmallDog) {
    if (isApartment) {
      return { points: 8, reason: `Perfect apartment-sized companion` };
    } else {
      return { points: 3, reason: `Adaptable to any living space` };
    }
  }

  return { points: 0, reason: null };
}

export function registerDogsRoutes(app: Express) {

  // ============================================
  // PUBLIC DOG LISTINGS
  // ============================================

  // Get all dogs (without filtering or compatibility scoring)
  app.get("/api/dogs", async (req, res) => {
    try {
      // Try to get from cache first
      const cached = cache.get<any[]>(CACHE_KEYS.ALL_DOGS);
      if (cached) {
        return res.json(cached);
      }

      const allDogs = await storage.getAllDogs();
      // Cache for 2 minutes
      cache.set(CACHE_KEYS.ALL_DOGS, allDogs, CACHE_TTL.MEDIUM);
      res.json(allDogs);
    } catch (error) {
      console.error("Error fetching dogs:", error);
      res.status(500).json({ error: "Failed to fetch dogs" });
    }
  });

  // ============================================
  // PUBLIC SHELTER LISTINGS
  // ============================================

  // Get all shelter profiles
  app.get("/api/shelters", async (req, res) => {
    try {
      const shelters = await storage.getAllShelterProfiles();
      res.json(shelters);
    } catch (error) {
      console.error("Error fetching shelters:", error);
      res.status(500).json({ error: "Failed to fetch shelters" });
    }
  });

  // Get shelter profile by ID
  app.get("/api/shelters/:id", async (req, res) => {
    try {
      const shelter = await storage.getShelterProfileById(req.params.id);
      if (!shelter) {
        return res.status(404).json({ error: "Shelter not found" });
      }
      res.json(shelter);
    } catch (error) {
      console.error("Error fetching shelter:", error);
      res.status(500).json({ error: "Failed to fetch shelter" });
    }
  });

  // Get all dogs for a specific shelter (public profile page)
  // Only shows dogs that are in the "ready" pipeline stage
  app.get("/api/shelters/:id/dogs", async (req, res) => {
    // Prevent browser caching to ensure fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    try {
      const shelter = await storage.getShelterProfileById(req.params.id);
      if (!shelter) {
        return res.status(404).json({ error: "Shelter not found" });
      }

      const dogs = await storage.getUserDogs(shelter.userId);

      // Get intake records - check both userId and profile ID (data may use either)
      const intakeByUserId = await storage.getIntakeRecords(shelter.userId);
      const intakeByProfileId = await db.select()
        .from(schema.intakeRecords)
        .where(eq(schema.intakeRecords.shelterId, shelter.id));

      // Combine and dedupe intake records
      const allIntakeRecords = [...intakeByUserId, ...intakeByProfileId];
      const intakeByDog = new Map(allIntakeRecords.map(r => [r.dogId, r]));

      // Only show dogs that are in the "ready" pipeline stage
      const readyDogs = dogs.filter(dog => {
        const intake = intakeByDog.get(dog.id);
        // For shelter dogs, they MUST have an intake record and be in "ready" status
        // Dogs without intake records should not be shown publicly for shelters
        return intake?.pipelineStatus === 'ready';
      });
      res.json(readyDogs);
    } catch (error) {
      console.error("Error fetching shelter dogs:", error);
      res.status(500).json({ error: "Failed to fetch shelter dogs" });
    }
  });

  // Get all resources for a specific shelter (public profile page)
  app.get("/api/shelters/:id/resources", async (req, res) => {
    try {
      const shelter = await storage.getShelterProfileById(req.params.id);
      if (!shelter) {
        return res.status(404).json({ error: "Shelter not found" });
      }

      // Fetch active resources for this shelter
      const resources = await db.select()
        .from(schema.shelterResources)
        .where(
          and(
            eq(schema.shelterResources.shelterId, shelter.userId),
            eq(schema.shelterResources.isActive, true)
          )
        )
        .orderBy(desc(schema.shelterResources.createdAt));

      res.json(resources);
    } catch (error) {
      console.error("Error fetching shelter resources:", error);
      res.status(500).json({ error: "Failed to fetch shelter resources" });
    }
  });

  // ============================================
  // MAP DATA ENDPOINTS
  // ============================================

  // Lightweight endpoint for map - returns shelters with location and dog count
  // This avoids loading all dogs on the map page
  // Shelter location is ALWAYS address-based from shelter_profiles, never from dog locations
  app.get("/api/map/shelters", async (req, res) => {
    try {
      const cacheKey = "map_shelters";
      const cached = cache.get<any[]>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const shelters = await storage.getAllShelterProfiles();

      // Get dog counts for each shelter (only dogs in "ready" pipeline stage)
      const sheltersWithInfo = await Promise.all(
        shelters.map(async (shelter) => {
          const dogs = await storage.getUserDogs(shelter.userId);

          // Get intake records by BOTH userId and shelterId (same as shelter profile endpoint)
          const intakeByUserId = await storage.getIntakeRecords(shelter.userId);
          const intakeByShelterId = await db.select()
            .from(schema.intakeRecords)
            .where(eq(schema.intakeRecords.shelterId, shelter.id));
          const allIntakeRecords = [...intakeByUserId, ...intakeByShelterId];
          const intakeByDog = new Map(allIntakeRecords.map(r => [r.dogId, r]));

          // Only count dogs in "ready" pipeline stage
          // Must have an intake record with 'ready' status - same logic as shelter profile
          const readyDogs = dogs.filter(dog => {
            const intake = intakeByDog.get(dog.id);
            return intake?.pipelineStatus === 'ready';
          });

          return {
            id: shelter.id,
            userId: shelter.userId,
            shelterName: shelter.shelterName,
            location: shelter.location,
            address: shelter.address,
            city: shelter.city,
            state: shelter.state,
            phone: shelter.phone,
            isVerified: shelter.isVerified,
            dogCount: readyDogs.length,
            // Use shelter's own address-based coordinates only
            latitude: shelter.latitude,
            longitude: shelter.longitude,
          };
        })
      );

      // Filter out shelters with no public dogs or no address-based location set
      const validShelters = sheltersWithInfo.filter(s => s.dogCount > 0 && s.latitude && s.longitude);

      // Cache for 2 minutes
      cache.set(cacheKey, validShelters, CACHE_TTL.MEDIUM);
      res.json(validShelters);
    } catch (error) {
      console.error("Error fetching map shelters:", error);
      res.status(500).json({ error: "Failed to fetch map shelters" });
    }
  });

  // Get only dogs that are ready for adoption (for map display)
  // Returns: 1) Shelter dogs with "ready" pipeline status, 2) Rehomer dogs with approved status
  // OPTIMIZED: Batch-loads all data upfront to avoid N+1 queries
  app.get("/api/map/dogs", async (req, res) => {
    try {
      const cacheKey = "map_dogs";
      const cached = cache.get<any[]>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const startTime = Date.now();

      // BATCH LOAD: Fetch all data upfront in parallel (3 queries instead of 170+)
      const [allShelters, allDogs, allIntakeRecords] = await Promise.all([
        storage.getAllShelterProfiles(),
        storage.getAllDogs(),
        db.select().from(schema.intakeRecords),
      ]);

      // Build lookup maps for O(1) access
      const approvedShelters = allShelters.filter(s => s.approvalStatus === 'approved');
      const shelterByUserId = new Map(approvedShelters.map(s => [s.userId, s]));
      const shelterUserIds = new Set(approvedShelters.map(s => s.userId));
      const intakeByDogId = new Map(allIntakeRecords.map(r => [r.dogId, r]));

      const readyDogs: any[] = [];
      const addedDogIds = new Set<string>();

      // 1. Process shelter dogs with "ready" pipeline status
      for (const dog of allDogs) {
        const shelter = shelterByUserId.get(dog.userId);
        if (!shelter) continue;

        const intake = intakeByDogId.get(dog.id);
        if (intake && intake.pipelineStatus === 'ready') {
          readyDogs.push({
            ...dog,
            latitude: dog.latitude || shelter.latitude,
            longitude: dog.longitude || shelter.longitude,
            source: 'shelter',
          });
          addedDogIds.add(dog.id);
        }
      }

      // 2. Process rehomer dogs - approved dogs from non-shelter users
      for (const dog of allDogs) {
        if (addedDogIds.has(dog.id)) continue;
        if (shelterUserIds.has(dog.userId)) continue;

        // Include if: not a shelter dog, approved, public, and has location
        if (dog.approvalStatus === 'approved' && dog.isPublic !== false && dog.latitude && dog.longitude) {
          readyDogs.push({
            ...dog,
            source: 'rehomer',
          });
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[Map Dogs] Loaded ${readyDogs.length} dogs in ${duration}ms`);

      // Cache for 2 minutes
      cache.set(cacheKey, readyDogs, CACHE_TTL.MEDIUM);
      res.json(readyDogs);
    } catch (error) {
      console.error("Error fetching map dogs:", error);
      res.status(500).json({ error: "Failed to fetch map dogs" });
    }
  });

  // ============================================
  // DONATION ENDPOINTS
  // ============================================

  // Get donation info for a shelter (public)
  app.get("/api/donate/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      // Verify user exists and is a shelter
      const user = await storage.getUser(userId);
      if (!user || user.role !== 'shelter') {
        return res.status(404).json({ error: "Shelter not found" });
      }

      // Fetch payment/donation settings
      const [settings] = await db.select()
        .from(schema.shelterPaymentSettings)
        .where(eq(schema.shelterPaymentSettings.shelterId, userId))
        .limit(1);

      // Fetch active fundraising campaigns
      const campaigns = await db.select()
        .from(schema.fundraisingCampaigns)
        .where(
          and(
            eq(schema.fundraisingCampaigns.shelterId, userId),
            eq(schema.fundraisingCampaigns.status, "active"),
            eq(schema.fundraisingCampaigns.isPublic, true)
          )
        )
        .orderBy(desc(schema.fundraisingCampaigns.createdAt));

      res.json({
        settings: settings || { acceptsDonations: true, suggestedAmounts: [10, 25, 50, 100] },
        campaigns: campaigns || []
      });
    } catch (error) {
      console.error("Error fetching donation info:", error);
      res.status(500).json({ error: "Failed to fetch donation info" });
    }
  });

  // ============================================
  // DOG DISCOVERY (swipe-based matching)
  // ============================================

  app.get("/api/dogs/discover", async (req: any, res) => {
    try {
      // Check if user is authenticated
      const userId = req.user?.id; // Use req.user.id directly after isAuthenticated

      // Try to get dogs from cache first
      let allDogs = cache.get<any[]>(CACHE_KEYS.ALL_DOGS);
      if (!allDogs) {
        allDogs = await storage.getAllDogs();
        cache.set(CACHE_KEYS.ALL_DOGS, allDogs, CACHE_TTL.MEDIUM);
      }
      const userSwipes = userId ? await storage.getUserSwipes(userId) : [];
      const swipedDogIds = new Set(userSwipes.map((s) => s.dogId));

      // Filter out already swiped dogs
      const availableDogs = allDogs.filter((dog) => !swipedDogIds.has(dog.id));

      // If not authenticated, return available dogs without compatibility scores but with default location distance
      if (!userId) {
        const defaultLat = 30.2672; // Default Austin coordinates
        const defaultLon = -97.7431;
        const dogsWithBasicInfo = availableDogs.map((dog) => {
          const distance = calculateDistance(defaultLat, defaultLon, dog.latitude, dog.longitude);
          return {
            ...dog,
            distance: Number(distance.toFixed(2)),
            compatibilityScore: 50,
            compatibilityReasons: ["Sign in to see your compatibility score!"],
          };
        });
        return res.json(dogsWithBasicInfo);
      }

      // Get user profile by their actual user ID
      let userProfile = await storage.getUserProfile(userId);

      if (!userProfile) {
        // No profile yet, return available dogs with prompt to complete onboarding
        const dogsWithBasicInfo = availableDogs.map((dog) => ({
          ...dog,
          distance: 0,
          compatibilityScore: 50,
          compatibilityReasons: ["Complete your profile to see personalized compatibility!"],
        }));
        return res.json(dogsWithBasicInfo);
      }

      // Check if user is in adopt mode with valid location data
      if (userProfile.mode !== 'adopt' || !userProfile.latitude || !userProfile.longitude) {
        // Rehome-mode users or users without location can't use discover
        const dogsWithBasicInfo = availableDogs.map((dog) => ({
          ...dog,
          distance: 0,
          compatibilityScore: 50,
          compatibilityReasons: ["Switch to 'Looking to Adopt' mode to discover dogs near you!"],
        }));
        return res.json(dogsWithBasicInfo);
      }

      // Filter dogs within search radius and not already swiped
      const nearbyDogs = availableDogs.filter((dog) => {
        const distance = calculateDistance(
          userProfile.latitude,
          userProfile.longitude,
          dog.latitude,
          dog.longitude
        );
        return distance <= userProfile.searchRadius;
      });

      // Log summary only (not per-dog to avoid performance hit)
      console.log(`[Discover] User ${userId}: ${nearbyDogs.length}/${availableDogs.length} dogs within ${userProfile.searchRadius}mi radius`);

      // Use AI for top 10 matches, rule-based for the rest (cost optimization)
      const USE_AI_MATCHING = nearbyDogs.length <= 10;

      // Get user's household pets for enhanced compatibility
      const householdPets = await db.select().from(schema.householdPets).where(eq(schema.householdPets.userId, userId));

      const dogsWithCompatibility: DogWithCompatibility[] = await Promise.all(
        nearbyDogs.map(async (dog) => {
          const distance = calculateDistance(
            userProfile.latitude,
            userProfile.longitude,
            dog.latitude,
            dog.longitude
          );

          let score: number;
          let reasons: string[];

          // Use AI for detailed analysis on small sets, rules for large sets
          // Only use AI if user has complete adopter profile (mode='adopt' with lifestyle data)
          if (USE_AI_MATCHING && userProfile.mode === 'adopt' && userProfile.homeType && userProfile.hasYard !== null && userProfile.activityLevel && userProfile.workSchedule && userProfile.experienceLevel) {
            try {
              const aiResult = await calculateCompatibility(
                {
                  homeType: userProfile.homeType,
                  hasYard: userProfile.hasYard,
                  activityLevel: userProfile.activityLevel,
                  workSchedule: userProfile.workSchedule,
                  experienceLevel: userProfile.experienceLevel,
                  preferredSize: userProfile.preferredSize ?? undefined,
                  preferredAge: userProfile.preferredAge ?? undefined,
                  preferredEnergy: userProfile.preferredEnergy ?? undefined,
                },
                {
                  name: dog.name,
                  breed: dog.breed,
                  age: dog.age,
                  size: dog.size,
                  energyLevel: dog.energyLevel,
                  temperament: dog.temperament,
                  goodWithKids: dog.goodWithKids,
                  goodWithDogs: dog.goodWithDogs,
                  goodWithCats: dog.goodWithCats,
                }
              );
              score = aiResult.score;
              reasons = aiResult.reasons;
            } catch (error) {
              console.error(`AI matching failed for ${dog.name}, falling back to rules:`, error);
              // Fallback to rule-based
              const ruleResult = calculateRuleBasedCompatibility(dog, userProfile, distance);
              score = ruleResult.score;
              reasons = ruleResult.reasons;
            }
          } else {
            // Rule-based scoring for performance (include household pets)
            const ruleResult = calculateRuleBasedCompatibility(dog, userProfile, distance, householdPets);
            score = ruleResult.score;
            reasons = ruleResult.reasons;
          }

          return {
            ...dog,
            distance,
            compatibilityScore: score,
            compatibilityReasons: reasons,
          };
        })
      );

      // Sort by urgency first (critical > urgent > normal), then by compatibility score
      // Create a new sorted array to avoid mutating the original
      const urgencyPriority = { critical: 3, urgent: 2, normal: 1 };
      const sortedDogs = [...dogsWithCompatibility].sort((a, b) => {
        const aUrgency = urgencyPriority[a.urgencyLevel as keyof typeof urgencyPriority] || 1;
        const bUrgency = urgencyPriority[b.urgencyLevel as keyof typeof urgencyPriority] || 1;

        // First sort by urgency (higher urgency first)
        if (aUrgency !== bUrgency) {
          return bUrgency - aUrgency;
        }
        // Then by compatibility score
        return b.compatibilityScore - a.compatibilityScore;
      });

      res.json(sortedDogs);
    } catch (error) {
      console.error("Error discovering dogs:", error);
      res.status(500).json({ error: "Failed to discover dogs" });
    }
  });

  // ============================================
  // LIKED DOGS
  // ============================================

  // Get liked dogs (must come BEFORE /api/dogs/:id to avoid route conflict)
  app.get("/api/dogs/liked", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile) {
        return res.json([]);
      }

      const likedDogsData = await storage.getLikedDogs(userId);

      if (!likedDogsData || likedDogsData.length === 0) {
        return res.json([]);
      }

      // Create a map of dogId to likedAt timestamp
      const likedAtMap = new Map(
        likedDogsData.map(({ dogId, likedAt }) => [dogId, likedAt])
      );

      const allDogs = await storage.getAllDogs();
      const likedDogs = allDogs.filter((dog) => likedAtMap.has(dog.id));

      if (likedDogs.length === 0) {
        return res.json([]);
      }

      // Fetch household pets for accurate compatibility scoring
      const householdPets = await db.select()
        .from(schema.householdPets)
        .where(eq(schema.householdPets.userId, userId));

      // Add compatibility data with normalized scoring
      const dogsWithCompatibility: DogWithCompatibility[] = likedDogs.map((dog) => {
        const distance = calculateDistance(
          userProfile.latitude || 0,
          userProfile.longitude || 0,
          dog.latitude || 0,
          dog.longitude || 0
        );

        // Use main compatibility function for consistent scoring
        const { score, reasons } = calculateRuleBasedCompatibility(
          dog,
          userProfile,
          distance,
          householdPets
        );

        return {
          ...dog,
          distance,
          compatibilityScore: score,
          compatibilityReasons: reasons,
          likedAt: likedAtMap.get(dog.id)!,
        };
      });

      res.json(dogsWithCompatibility);
    } catch (error) {
      console.error("Error fetching liked dogs:", error);
      res.status(500).json({ error: "Failed to fetch liked dogs" });
    }
  });

  // ============================================
  // DOGS NEEDING FOSTER
  // ============================================

  // Get dogs that need foster care (from rehomers)
  // NOTE: This route MUST be defined before /api/dogs/:id to avoid "need-foster" being interpreted as a dog ID
  app.get("/api/dogs/need-foster", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { latitude, longitude, radius = 50, size, age, energy, urgency } = req.query;

      // Get user's profile for location fallback
      const [userProfile] = await db.select().from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);

      const userLat = latitude ? parseFloat(latitude as string) : userProfile?.latitude;
      const userLng = longitude ? parseFloat(longitude as string) : userProfile?.longitude;
      const searchRadius = parseInt(radius as string) || 50;

      if (!userLat || !userLng) {
        return res.status(400).json({ message: "Location required" });
      }

      // Get all dogs that need foster care
      // These are dogs with listingType = 'foster' from rehomers
      const dogsNeedingFoster = await db
        .select({
          dog: schema.dogs,
          owner: schema.users,
          ownerProfile: schema.userProfiles,
        })
        .from(schema.dogs)
        .innerJoin(schema.users, eq(schema.dogs.userId, schema.users.id))
        .leftJoin(schema.userProfiles, eq(schema.dogs.userId, schema.userProfiles.userId))
        .where(
          and(
            eq(schema.dogs.listingType, "foster"),
            eq(schema.dogs.approvalStatus, "approved"),
            eq(schema.dogs.isPublic, true)
          )
        );

      // Calculate distance and filter
      const dogsWithDistance = dogsNeedingFoster.map(({ dog, owner, ownerProfile }) => {
        const distance = calculateDistance(
          userLat,
          userLng,
          dog.latitude,
          dog.longitude
        );
        return {
          ...dog,
          distance: Math.round(distance * 10) / 10,
          ownerName: `${owner.firstName} ${owner.lastName?.charAt(0) || ''}`.trim(),
          ownerCity: ownerProfile?.city,
          ownerState: ownerProfile?.state,
        };
      })
      .filter(dog => dog.distance <= searchRadius)
      .sort((a, b) => {
        // Sort by urgency first
        const urgencyOrder: Record<string, number> = { critical: 0, urgent: 1, normal: 2 };
        const aUrgency = urgencyOrder[a.urgencyLevel] ?? 2;
        const bUrgency = urgencyOrder[b.urgencyLevel] ?? 2;
        if (aUrgency !== bUrgency) return aUrgency - bUrgency;
        // Then by distance
        return a.distance - b.distance;
      });

      // Apply optional filters
      let filteredDogs = dogsWithDistance;

      if (size) {
        const sizeFilter = (size as string).split(',');
        filteredDogs = filteredDogs.filter(d => sizeFilter.includes(d.size));
      }

      if (age) {
        const ageFilter = (age as string).split(',');
        filteredDogs = filteredDogs.filter(d => ageFilter.includes(d.ageCategory));
      }

      if (energy) {
        const energyFilter = (energy as string).split(',');
        filteredDogs = filteredDogs.filter(d => energyFilter.includes(d.energyLevel));
      }

      if (urgency) {
        const urgencyFilter = (urgency as string).split(',');
        filteredDogs = filteredDogs.filter(d => urgencyFilter.includes(d.urgencyLevel));
      }

      res.json(filteredDogs);
    } catch (error: any) {
      console.error("Error fetching dogs needing foster:", error);
      res.status(500).json({ message: error.message || "Failed to fetch dogs needing foster" });
    }
  });

  // ============================================
  // DOG PROFILE (public, single dog view)
  // ============================================

  // Increment dog view count
  app.post("/api/dogs/:id/view", async (req: any, res) => {
    try {
      const dogId = req.params.id;
      const dog = await storage.getDog(dogId);

      if (!dog) {
        return res.status(404).json({ error: "Dog not found" });
      }

      // Increment view count
      const updatedDog = await storage.updateDog(dogId, {
        viewCount: (dog.viewCount || 0) + 1
      });

      if (!updatedDog) {
        return res.status(500).json({ error: "Failed to update view count" });
      }

      res.json({ viewCount: updatedDog.viewCount });
    } catch (error) {
      console.error("Error incrementing view count:", error);
      res.status(500).json({ error: "Failed to increment view count" });
    }
  });

  // Get specific dog with compatibility
  app.get("/api/dogs/:id", async (req: any, res) => {
    try {
      const dogId = req.params.id;
      const dog = await storage.getDog(dogId);

      if (!dog) {
        return res.status(404).json({ error: "Dog not found" });
      }

      // Get the dog owner's role to determine if this is a shelter or rehomer listing
      const [dogOwner] = await db.select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, dog.userId))
        .limit(1);

      const ownerRole = dogOwner?.role || 'shelter'; // Default to shelter for backward compatibility

      // Get user profile for location-based distance calculation
      let userLat = 30.2672; // Default Austin coordinates
      let userLon = -97.7431;
      let userProfile = null;

      if (req.user) {
        userProfile = await storage.getUserProfile(req.user.id);
        if (userProfile?.latitude && userProfile?.longitude) {
          userLat = userProfile.latitude;
          userLon = userProfile.longitude;
          console.log(`[Dog Profile] Using user location: ${userLat}, ${userLon}`);
        } else {
          console.log(`[Dog Profile] User has no location, using default Austin coordinates`);
        }
      } else {
        console.log(`[Dog Profile] No authenticated user, using default Austin coordinates`);
      }

      // Calculate distance using Haversine formula - only if dog has valid coordinates
      let distance = null;
      if (dog.latitude && dog.longitude && dog.latitude !== 0 && dog.longitude !== 0) {
        const R = 3959; // Earth's radius in miles
        const dLat = ((dog.latitude - userLat) * Math.PI) / 180;
        const dLon = ((dog.longitude - userLon) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((userLat * Math.PI) / 180) *
          Math.cos((dog.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = R * c;
        console.log(`[Dog Profile] Distance calculation: User(${userLat.toFixed(4)}, ${userLon.toFixed(4)}) to Dog(${dog.latitude}, ${dog.longitude}) = ${distance.toFixed(2)} miles`);
      } else {
        console.log(`[Dog Profile] Dog has invalid coordinates (${dog.latitude}, ${dog.longitude}) - distance unavailable`);
      }

      // Fetch household pets for accurate compatibility scoring
      let householdPets: any[] = [];
      if (req.user) {
        householdPets = await db.select()
          .from(schema.householdPets)
          .where(eq(schema.householdPets.userId, req.user.id));
      }

      // Calculate compatibility score using enhanced normalized algorithm
      let { score, reasons } = calculateRuleBasedCompatibility(dog, userProfile, distance ?? 0, householdPets);

      // Scout AI insights boost (small boost, capped to maintain distribution)
      if (userProfile) {
        // Fetch actual Scout insights for this user
        const insights = await db.select()
          .from(schema.scoutInsights)
          .where(eq(schema.scoutInsights.userId, req.user.id))
          .limit(10);

        // Apply small boost based on matching insights (max +5)
        let scoutBoost = 0;
        for (const insight of insights) {
          if (insight.category === 'size' && insight.value?.includes(dog.size)) scoutBoost += 2;
          if (insight.category === 'energy' && insight.value?.includes(dog.energyLevel)) scoutBoost += 2;
          if (insight.category === 'temperament' && dog.temperament?.some((t: string) => insight.value?.includes(t))) scoutBoost += 1;
        }
        scoutBoost = Math.min(5, scoutBoost);
        score = Math.min(98, score + scoutBoost); // Maintain 98 cap
        if (scoutBoost > 0) {
          console.log(`[Scout AI] Applied ${scoutBoost} point boost to ${dog.name}'s compatibility based on learned preferences`);
        }
      }

      const dogWithCompatibility = {
        ...dog,
        distance: distance !== null ? Number(distance.toFixed(2)) : undefined, // Null if dog has no valid coordinates
        compatibilityScore: score,
        compatibilityReasons: reasons,
        ownerRole, // 'shelter' or 'adopter' - determines UI display
      };

      console.log(`[Dog Profile] Sending response with distance: ${dogWithCompatibility.distance} miles, ownerRole: ${ownerRole}`);
      res.json(dogWithCompatibility);
    } catch (error) {
      console.error("Error fetching dog:", error);
      res.status(500).json({ error: "Failed to fetch dog" });
    }
  });

  // ============================================
  // SWIPE ROUTES
  // ============================================

  app.get("/api/swipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const swipes = await storage.getUserSwipes(userId);
      res.json(swipes);
    } catch (error) {
      console.error("Error fetching swipes:", error);
      res.status(500).json({ error: "Failed to fetch swipes" });
    }
  });

  app.post("/api/swipes", isAuthenticated, async (req: any, res) => {
    try {
      // Require authentication - no guest mode for swipes
      const userId = req.user.id;

      const swipe = await storage.createSwipe({
        userId,
        dogId: req.body.dogId,
        direction: req.body.direction,
      });

      // Trigger swipe pattern analysis periodically (every ~10 swipes)
      if (Math.random() < 0.1) {
        // Import dynamically to avoid circular dependencies
        import("../ai/scout-insights").then(({ analyzeSwipePatterns }) => {
          analyzeSwipePatterns(userId).catch(err => {
            console.error("[Scout Insights] Error analyzing swipe patterns:", err);
          });
        });
      }

      res.json(swipe);
    } catch (error) {
      console.error("Error creating swipe:", error);
      res.status(500).json({ error: "Failed to record swipe" });
    }
  });

  app.delete("/api/swipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deleteUserSwipes(userId);
      res.json({ message: "All swipes deleted successfully" });
    } catch (error) {
      console.error("Error deleting swipes:", error);
      res.status(500).json({ error: "Failed to delete swipes" });
    }
  });

  // Get liked dogs with full details for matches page
  app.get("/api/swipes/liked", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile) {
        return res.json([]);
      }

      const likedDogsData = await storage.getLikedDogs(userId);

      if (!likedDogsData || likedDogsData.length === 0) {
        return res.json([]);
      }

      // Create a map of dogId to likedAt timestamp
      const likedAtMap = new Map(
        likedDogsData.map(({ dogId, likedAt }) => [dogId, likedAt])
      );

      const allDogs = await storage.getAllDogs();
      const likedDogs = allDogs.filter((dog) => likedAtMap.has(dog.id));

      if (likedDogs.length === 0) {
        return res.json([]);
      }

      // Fetch household pets for accurate compatibility scoring
      const householdPets = await db.select()
        .from(schema.householdPets)
        .where(eq(schema.householdPets.userId, userId));

      // Add compatibility data with normalized scoring
      const dogsWithCompatibility: DogWithCompatibility[] = likedDogs.map((dog) => {
        const distance = calculateDistance(
          userProfile.latitude || 0,
          userProfile.longitude || 0,
          dog.latitude || 0,
          dog.longitude || 0
        );

        // Use main compatibility function for consistent scoring
        const { score, reasons } = calculateRuleBasedCompatibility(
          dog,
          userProfile,
          distance,
          householdPets
        );

        return {
          ...dog,
          distance,
          compatibilityScore: score,
          compatibilityReasons: reasons,
          likedAt: likedAtMap.get(dog.id)!,
        };
      });

      res.json(dogsWithCompatibility);
    } catch (error) {
      console.error("Error fetching liked dogs:", error);
      res.status(500).json({ error: "Failed to fetch liked dogs" });
    }
  });
}
