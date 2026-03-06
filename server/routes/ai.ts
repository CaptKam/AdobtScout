import type { Express } from "express";
import { storage } from "../storage";
import { getChatResponse, calculateCompatibility, getEnhancedChatResponse, getJourneyCoachingMessage, generateProactiveSuggestion } from "../ai/scout";
import { assembleScoutContext, invalidateUserContextCache } from "../ai/scout-context";
import { initiateConsultationCall, handleConsultationWebhook, initiateFosterConsultation } from "../vapi";
import type { DogWithCompatibility, UserProfile, User } from "@shared/schema";
import { isAuthenticated, isAdmin } from "../auth";
import { eq, and, or, sql, isNull, isNotNull, gt, gte, lte, desc, inArray, not } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "../db";
import { initiatePhoneScreening, handleVapiWebhook, getCallStatus, analyzeForQuickApply } from "../vapi";

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

// Compatibility flag detection - checks user profile + dog for potential issues
interface CompatibilityFlag {
  flagType: 'yellow' | 'red';
  category: string;
  title: string;
  description: string;
  triggerReason: string;
  relatedDogId?: string;
  relatedBreed?: string;
}

async function checkProfileCompatibility(
  userId: string,
  dogId: string
): Promise<CompatibilityFlag[]> {
  const flags: CompatibilityFlag[] = [];

  try {
    // Get user profile
    const profile = await storage.getUserProfile(userId);
    if (!profile) return flags;

    // Get dog details
    const dog = await storage.getDog(dogId);
    if (!dog) return flags;

    // Get user's household pets
    const householdPets = await db.select()
      .from(schema.householdPets)
      .where(eq(schema.householdPets.userId, userId));

    const isApartment = profile.homeType === 'apartment';
    const isHighEnergy = dog.energyLevel === 'high' || dog.energyLevel === 'very_high';

    // Check for high-energy breed in apartment
    if (isApartment && isHighEnergy) {
      // Check if they already have high-energy dogs
      const existingHighEnergyDogs = householdPets.filter(pet =>
        pet.species === 'dog' && (pet.energyLevel === 'high' || pet.energyLevel === 'very_high')
      );

      if (existingHighEnergyDogs.length > 0) {
        // RED FLAG - multiple high-energy dogs in apartment
        flags.push({
          flagType: 'red',
          category: 'space_requirements',
          title: 'Multiple high-energy dogs in apartment',
          description: `User lives in an apartment and already has ${existingHighEnergyDogs.length} high-energy dog(s). Adding ${dog.name} (${dog.breed}, ${dog.energyLevel} energy) raises significant space and exercise concerns. Recommend thorough discussion of exercise plans and living situation.`,
          triggerReason: 'apartment_multi_high_energy',
          relatedDogId: dogId,
          relatedBreed: dog.breed,
        });
      } else {
        // YELLOW FLAG - single high-energy dog in apartment
        flags.push({
          flagType: 'yellow',
          category: 'space_requirements',
          title: 'High-energy dog in apartment',
          description: `User is interested in ${dog.name} (${dog.breed}, ${dog.energyLevel} energy) and lives in an apartment. During phone screening, discuss exercise routines, nearby parks, and daily activity plans to ensure a good match.`,
          triggerReason: 'apartment_high_energy',
          relatedDogId: dogId,
          relatedBreed: dog.breed,
        });
      }
    }

    // Check for first-time owner with high-energy/large breed
    const isFirstTime = profile.experienceLevel === 'first_time';
    const isLarge = dog.size === 'large';

    if (isFirstTime && isHighEnergy && isLarge) {
      flags.push({
        flagType: 'yellow',
        category: 'experience_concern',
        title: 'First-time owner with high-energy large breed',
        description: `${dog.name} is a ${dog.size}, ${dog.energyLevel} energy ${dog.breed}. User is a first-time dog owner. Consider discussing training resources, commitment level, and whether a calmer dog might be a better first pet.`,
        triggerReason: 'first_time_high_energy_large',
        relatedDogId: dogId,
        relatedBreed: dog.breed,
      });
    }

    // Check for pet compatibility issues
    if (householdPets.length > 0) {
      const hasCats = householdPets.some(pet => pet.species === 'cat');
      const hasOtherDogs = householdPets.some(pet => pet.species === 'dog');

      if (hasCats && !dog.goodWithCats) {
        flags.push({
          flagType: 'yellow',
          category: 'multi_pet',
          title: 'Cat compatibility concern',
          description: `User has cats but ${dog.name} may not be cat-friendly. Recommend discussing cat introduction plans and whether a supervised meeting could be arranged.`,
          triggerReason: 'cat_incompatibility',
          relatedDogId: dogId,
          relatedBreed: dog.breed,
        });
      }

      if (hasOtherDogs && !dog.goodWithDogs) {
        flags.push({
          flagType: 'red',
          category: 'multi_pet',
          title: 'Dog compatibility concern',
          description: `User already has dog(s) but ${dog.name} may not be good with other dogs. This could lead to serious conflicts. Strongly recommend discussing this during screening.`,
          triggerReason: 'dog_incompatibility',
          relatedDogId: dogId,
          relatedBreed: dog.breed,
        });
      }
    }

    // Check for children compatibility
    const hasChildren = profile.hasChildren;
    if (hasChildren && !dog.goodWithKids) {
      flags.push({
        flagType: 'red',
        category: 'safety_concern',
        title: 'Child safety concern',
        description: `User has children but ${dog.name} may not be suitable for homes with kids. This is a safety concern that requires careful discussion with the adopter.`,
        triggerReason: 'child_incompatibility',
        relatedDogId: dogId,
        relatedBreed: dog.breed,
      });
    }

  } catch (error) {
    console.error('Error checking profile compatibility:', error);
  }

  return flags;
}

// Creates compatibility flags in the database
async function createCompatibilityFlags(
  userId: string,
  flags: CompatibilityFlag[]
): Promise<void> {
  for (const flag of flags) {
    try {
      // Check if a similar flag already exists (avoid duplicates)
      const existing = await db.select()
        .from(schema.profileCompatibilityFlags)
        .where(and(
          eq(schema.profileCompatibilityFlags.userId, userId),
          eq(schema.profileCompatibilityFlags.triggerReason, flag.triggerReason),
          flag.relatedDogId ? eq(schema.profileCompatibilityFlags.relatedDogId, flag.relatedDogId) : sql`TRUE`,
          eq(schema.profileCompatibilityFlags.status, 'pending')
        ))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.profileCompatibilityFlags)
          .values({
            userId,
            flagType: flag.flagType,
            category: flag.category,
            title: flag.title,
            description: flag.description,
            triggerReason: flag.triggerReason,
            relatedDogId: flag.relatedDogId,
            relatedBreed: flag.relatedBreed,
            status: 'pending',
            userNotified: false,
          });
        console.log(`Created ${flag.flagType} compatibility flag for user ${userId}: ${flag.title}`);
      }
    } catch (error) {
      console.error('Error creating compatibility flag:', error);
    }
  }
}

export function registerAiAndUserRoutes(app: Express) {
  // ============================================
  // USER PROFILE ROUTES
  // ============================================

  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const profile = await storage.getUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Prevent caching to ensure users always get their own current profile data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Check if profile already exists
      const existingProfile = await storage.getUserProfile(userId);
      if (existingProfile) {
        return res.status(400).json({ error: "Profile already exists. Use PATCH to update." });
      }

      // Create profile linked to the authenticated user
      const profile = await storage.createUserProfile({
        ...req.body,
        userId, // Link profile to authenticated user
      });
      res.json(profile);
    } catch (error: any) {
      console.error("Error creating profile:", error);
      res.status(500).json({ error: error.message || "Failed to create profile" });
    }
  });

  app.patch("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const profile = await storage.updateUserProfile(userId, req.body);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Invalidate Scout AI context cache on profile changes
      invalidateUserContextCache(userId);

      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Alias for /api/profile (used by dog-profile page)
  app.get("/api/user-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getUserProfile(userId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Get profile mode for a dog (returns owner's mode - adopt/foster/rehome)
  app.get("/api/profile-mode/:dogId", async (req: any, res) => {
    try {
      const dog = await storage.getDog(req.params.dogId);
      if (!dog) {
        return res.status(404).json({ error: "Dog not found" });
      }

      // If dog has an ownerId (rehomer), get their profile mode
      if (dog.ownerId) {
        const ownerProfile = await storage.getUserProfile(dog.ownerId);
        return res.json({
          mode: ownerProfile?.mode || 'rehome',
          isRehomerDog: true
        });
      }

      // If dog has a shelterId, it's a shelter dog
      if (dog.shelterId) {
        return res.json({
          mode: 'adopt',
          isShelterDog: true
        });
      }

      // Default to adopt mode
      res.json({ mode: 'adopt' });
    } catch (error) {
      console.error("Error fetching profile mode:", error);
      res.status(500).json({ error: "Failed to fetch profile mode" });
    }
  });

  // ===== VERIFIED ADOPTER PROFILE ENDPOINTS =====

  // Get adopter verification status
  app.get("/api/adopter-verification", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const verification = await db.select().from(schema.adopterVerifications).where(eq(schema.adopterVerifications.userId, userId)).limit(1);

      res.json(verification[0] || { userId, isReadyToAdopt: false, verificationScore: 0, backgroundCheckStatus: "not_started", petPolicyVerified: false });
    } catch (error) {
      console.error("Error fetching adopter verification:", error);
      res.status(500).json({ error: "Failed to fetch verification status" });
    }
  });

  // Update background check status (admin endpoint)
  app.post("/api/admin/adopter-verification/:userId/background-check", isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { status, notes, completedAt } = req.body;

      if (!["not_started", "pending", "passed", "failed"].includes(status)) {
        return res.status(400).json({ error: "Invalid background check status" });
      }

      // Upsert verification record
      let verification = await db.select().from(schema.adopterVerifications).where(eq(schema.adopterVerifications.userId, userId)).limit(1);
      const verificationRecord = verification[0];

      if (verificationRecord) {
        const updatedRecord = await db
          .update(schema.adopterVerifications)
          .set({
            backgroundCheckStatus: status,
            backgroundCheckNotes: notes,
            backgroundCheckCompletedAt: status === "passed" || status === "failed" ? new Date(completedAt) : null,
            isReadyToAdopt: status === "passed" && verificationRecord.petPolicyVerified,
            verificationScore: status === "passed" ? 100 : 0,
            updatedAt: new Date(),
          })
          .where(eq(schema.adopterVerifications.userId, userId))
          .returning();

        res.json(updatedRecord[0]);
      } else {
        const newRecord = await db
          .insert(schema.adopterVerifications)
          .values({
            userId,
            backgroundCheckStatus: status,
            backgroundCheckNotes: notes,
            backgroundCheckCompletedAt: status === "passed" || status === "failed" ? new Date(completedAt) : null,
            isReadyToAdopt: false,
            verificationScore: status === "passed" ? 100 : 0,
          })
          .returning();

        res.json(newRecord[0]);
      }
    } catch (error) {
      console.error("Error updating background check:", error);
      res.status(500).json({ error: "Failed to update background check status" });
    }
  });

  // Update pet policy verification (admin or user can submit)
  app.post("/api/adopter-verification/pet-policy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { verificationMethod, landlordName, landlordPhone, landlordEmail } = req.body;

      if (!["landlord_letter", "lease_copy", "self_attestation"].includes(verificationMethod)) {
        return res.status(400).json({ error: "Invalid verification method" });
      }

      let verification = await db.select().from(schema.adopterVerifications).where(eq(schema.adopterVerifications.userId, userId)).limit(1);
      const verificationRecord = verification[0];

      if (verificationRecord) {
        const updatedRecord = await db
          .update(schema.adopterVerifications)
          .set({
            petPolicyVerified: true,
            petPolicyVerificationMethod: verificationMethod,
            petPolicyVerifiedAt: new Date(),
            landlordName,
            landlordPhone,
            landlordEmail,
            isReadyToAdopt: verificationRecord.backgroundCheckStatus === "passed",
            verificationScore: (verificationRecord.backgroundCheckStatus === "passed" ? 100 : 50),
            updatedAt: new Date(),
          })
          .where(eq(schema.adopterVerifications.userId, userId))
          .returning();

        res.json(updatedRecord[0]);
      } else {
        const newRecord = await db
          .insert(schema.adopterVerifications)
          .values({
            userId,
            petPolicyVerified: true,
            petPolicyVerificationMethod: verificationMethod,
            petPolicyVerifiedAt: new Date(),
            landlordName,
            landlordPhone,
            landlordEmail,
            isReadyToAdopt: false,
            verificationScore: 50,
          })
          .returning();

        res.json(newRecord[0]);
      }
    } catch (error) {
      console.error("Error updating pet policy verification:", error);
      res.status(500).json({ error: "Failed to update pet policy verification" });
    }
  });

  // Chat Routes
  app.get("/api/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const messages = await storage.getUserChatMessages(userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat:", error);
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userMessage = req.body.content;

      // Store user message
      await storage.createChatMessage({
        userId: userId,
        role: "user",
        content: userMessage,
        dogContext: req.body.dogContext || null,
      });

      // Get conversation history
      const allMessages = await storage.getUserChatMessages(userId);
      const conversationHistory = allMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      // Use enhanced chat system with full context orchestration
      // This automatically:
      // - Assembles rich context (profile, journey, liked dogs, insights)
      // - Extracts preferences from conversation (AI-powered)
      // - Periodically analyzes swipe patterns
      const { response: aiResponse, context } = await getEnhancedChatResponse(
        userId,
        userMessage,
        conversationHistory
      );

      console.log(`[Scout AI] Enhanced response for user ${userId}, context: ${context.activitySummary}`);

      // Store AI response
      const assistantMessage = await storage.createChatMessage({
        userId: userId,
        role: "assistant",
        content: aiResponse,
        dogContext: null,
      });

      res.json(assistantMessage);
    } catch (error) {
      console.error("Error in chat:", error);
      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  // Get Scout context summary (for UI hints/suggestions)
  app.get("/api/chat/context", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const context = await assembleScoutContext(userId);

      // Generate proactive suggestion if appropriate
      const suggestion = await generateProactiveSuggestion(context);

      res.json({
        hasActiveJourney: !!context.journeyStatus,
        journeyStatus: context.journeyStatus,
        likedDogsCount: context.likedDogs.length,
        insightsCount: context.insights.length,
        activitySummary: context.activitySummary,
        proactiveSuggestion: suggestion,
      });
    } catch (error) {
      console.error("Error fetching chat context:", error);
      res.status(500).json({ error: "Failed to fetch context" });
    }
  });

  // Get journey coaching message
  app.get("/api/chat/journey-coaching/:journeyId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { journeyId } = req.params;

      // Get the journey
      const journey = await db.query.adoptionJourneys.findFirst({
        where: and(
          eq(schema.adoptionJourneys.id, journeyId),
          eq(schema.adoptionJourneys.userId, userId)
        ),
      });

      if (!journey) {
        return res.status(404).json({ error: "Journey not found" });
      }

      // Get dog details
      const dog = await storage.getDog(journey.dogId);
      if (!dog) {
        return res.status(404).json({ error: "Dog not found" });
      }

      // Generate coaching message
      const coachingMessage = await getJourneyCoachingMessage(
        userId,
        journey.currentStep,
        dog.name,
        dog.breed
      );

      res.json({ message: coachingMessage, step: journey.currentStep });
    } catch (error) {
      console.error("Error getting coaching message:", error);
      res.status(500).json({ error: "Failed to get coaching message" });
    }
  });

  // Conversation Routes (User-to-Shelter messaging)
  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversations = await storage.getUserConversations(userId);
      const allDogs = await storage.getAllDogs();

      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          const dog = allDogs.find((d) => d.id === conv.dogId);
          const messages = await storage.getConversationMessages(conv.id);
          const lastMessage = messages[messages.length - 1];
          const unreadCount = await storage.getUnreadCount(conv.id, userId);

          // Log if dog is not found for debugging
          if (!dog) {
            console.warn(`[Conversations] Dog not found for conversation ${conv.id}, dogId: ${conv.dogId}`);
          }

          return {
            ...conv,
            dog: dog || null,
            lastMessage,
            unreadCount,
          };
        })
      );

      res.json(conversationsWithDetails);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversationId = req.params.conversationId;

      const conversation = await storage.getConversation(conversationId);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify the user has access to this conversation
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const dog = await storage.getDog(conversation.dogId);
      const messages = await storage.getConversationMessages(conversation.id);
      const lastMessage = messages[messages.length - 1];
      const unreadCount = await storage.getUnreadCount(conversation.id, userId);

      res.json({
        ...conversation,
        dog: dog || null,
        lastMessage,
        unreadCount,
      });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Delete a conversation
  app.delete("/api/conversations/:conversationId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversationId = req.params.conversationId;

      const conversation = await storage.getConversation(conversationId);

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Verify the user has access to this conversation
      if (conversation.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteConversation(conversationId);
      res.json({ success: true, message: "Conversation deleted" });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.get("/api/conversations/by-dog/:dogId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let conversation = await storage.getConversationByDog(userId, req.params.dogId);

      if (!conversation) {
        const dog = await storage.getDog(req.params.dogId);
        if (!dog) {
          return res.status(404).json({ error: "Dog not found" });
        }

        conversation = await storage.createConversation({
          userId: userId,
          dogId: dog.id,
          shelterName: dog.shelterName,
        });
      }

      res.json(conversation);
    } catch (error) {
      console.error("Error fetching/creating conversation:", error);
      res.status(500).json({ error: "Failed to get conversation" });
    }
  });

  app.get("/api/conversations/:conversationId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const conversationId = req.params.conversationId;

      const messages = await storage.getConversationMessages(conversationId);

      // Mark messages as read when fetching them
      await storage.markMessagesAsRead(conversationId, userId);

      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:conversationId/mark-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.markMessagesAsRead(req.params.conversationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
  });

  app.post("/api/conversations/:conversationId/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const message = await storage.createMessage({
        conversationId: req.params.conversationId,
        senderId: userId,
        senderType: "user",
        messageType: "text",
        content: req.body.content,
      });

      // Simulate shelter response after a delay (for demo purposes)
      setTimeout(async () => {
        const shelterResponses = [
          "Thank you for your interest! We'd love to schedule a meet-and-greet. What days work best for you?",
          "Great to hear from you! Our shelter is open Tuesday-Sunday, 10am-6pm. When would you like to visit?",
          "We're excited you're interested in this pup! Let me know your availability and we'll set something up.",
        ];

        await storage.createMessage({
          conversationId: req.params.conversationId,
          senderId: "shelter",
          senderType: "shelter",
          content: shelterResponses[Math.floor(Math.random() * shelterResponses.length)],
        });
      }, 2000);

      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Check if user has any completed applications (for quick apply feature)
  app.get("/api/adoption-journeys/has-completed-application", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Check if user has any journey with applicationSubmittedAt set
      const completedApplication = await db.query.adoptionJourneys.findFirst({
        where: (journeys, { and, eq, isNotNull }) =>
          and(
            eq(journeys.userId, userId),
            isNotNull(journeys.applicationSubmittedAt)
          ),
      });

      res.json({
        hasCompletedApplication: !!completedApplication,
        applicationCount: completedApplication ? 1 : 0 // Could expand to count all
      });
    } catch (error: any) {
      console.error("Error checking application status:", error);
      res.status(500).json({ message: error.message || "Failed to check application status" });
    }
  });

  // Adoption Journey Routes
  app.post("/api/adoption-journeys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId, quickApply, applicationResponses } = req.body;

      // Check if journey already exists
      const existing = await db.query.adoptionJourneys.findFirst({
        where: (journeys, { and, eq }) =>
          and(eq(journeys.userId, userId), eq(journeys.dogId, dogId), eq(journeys.status, "active")),
      });

      // If journey exists and applicationResponses is provided, update it to mark application as submitted
      if (existing) {
        if (applicationResponses) {
          // Application form was submitted - update journey to mark it complete
          const [updated] = await db.update(schema.adoptionJourneys)
            .set({
              currentStep: "phone_screening",
              applicationSubmittedAt: new Date(),
              applicationResponses: applicationResponses, // Store the application answers
              updatedAt: new Date(),
            })
            .where(eq(schema.adoptionJourneys.id, existing.id))
            .returning();
          return res.json(updated);
        }
        return res.json(existing);
      }

      // If quick apply, check if user has previously completed an application
      if (quickApply) {
        console.log("[Quick Apply] User:", userId, "requesting quick apply for dog:", dogId);

        const hasCompletedApplication = await db.query.adoptionJourneys.findFirst({
          where: (journeys, { and, eq, isNotNull }) =>
            and(
              eq(journeys.userId, userId),
              isNotNull(journeys.applicationSubmittedAt)
            ),
        });

        console.log("[Quick Apply] Has completed application:", !!hasCompletedApplication);

        if (hasCompletedApplication) {
          // Fetch previous completed phone screenings for this user
          const previousScreenings = await db.query.adoptionJourneys.findMany({
            where: (journeys, { and, eq, isNotNull }) =>
              and(
                eq(journeys.userId, userId),
                isNotNull(journeys.phoneScreeningCompletedAt)
              ),
          });

          console.log("[Quick Apply] Previous completed phone screenings:", previousScreenings.length);

          // If user has completed phone screenings, analyze if they can skip
          let canSkipToMeetGreet = false;
          let skipReason = "";
          let quickApplyAnalysis = null;

          if (previousScreenings.length > 0) {
            console.log("[Quick Apply] Analyzing if user can skip screening...");
            // Get dog details for each previous screening
            const screeningsWithDogs = await Promise.all(
              previousScreenings.map(async (s) => {
                const dogInfo = await db.query.dogs.findFirst({
                  where: eq(schema.dogs.id, s.dogId),
                });
                return {
                  dogBreed: dogInfo?.breed || "Unknown",
                  dogSize: dogInfo?.size || "medium",
                  dogEnergy: dogInfo?.energyLevel || "moderate",
                  transcript: s.phoneScreeningTranscript,
                  summary: s.phoneScreeningSummary,
                  screeningNotes: s.phoneScreeningNotes,
                  completedAt: s.phoneScreeningCompletedAt,
                };
              })
            );

            // Use AI to analyze if screening can be skipped
            try {
              quickApplyAnalysis = await analyzeForQuickApply(userId, dogId, screeningsWithDogs);
              canSkipToMeetGreet = quickApplyAnalysis.canSkipScreening;
              skipReason = quickApplyAnalysis.reason;
              console.log("[Quick Apply] AI analysis result:", {
                canSkipScreening: canSkipToMeetGreet,
                reason: skipReason,
                confidenceScore: quickApplyAnalysis.confidenceScore
              });
            } catch (aiError: any) {
              console.error("[Quick Apply] AI analysis failed:", aiError.message);
            }
          }

          // Determine which step to start at
          const startStep = canSkipToMeetGreet ? "meet_greet" : "phone_screening";
          console.log("[Quick Apply] Starting journey at step:", startStep);

          // Build compatible phoneScreeningNotes format (same as CallAnalytics)
          const screeningNotes = quickApplyAnalysis ? JSON.stringify({
            sentimentScore: quickApplyAnalysis.confidenceScore,
            concerningPatterns: [],
            positiveIndicators: ["Returning applicant with completed screening"],
            recommendedFollowUp: quickApplyAnalysis.followUpQuestions,
            analyzedAt: new Date().toISOString(),
            quickApplyData: {
              skippedScreening: canSkipToMeetGreet,
              reason: skipReason,
              previousScreeningSummary: quickApplyAnalysis.previousScreeningSummary,
            }
          }) : null;

          // Create journey with proper state for fast-track or regular quick apply
          const [journey] = await db.insert(schema.adoptionJourneys)
            .values({
              userId,
              dogId,
              currentStep: startStep,
              applicationSubmittedAt: new Date(),
              status: "active",
              phoneScreeningNotes: screeningNotes,
              ...(canSkipToMeetGreet ? {
                phoneScreeningStatus: "completed",
                phoneScreeningCompletedAt: new Date(),
                phoneScreeningSummary: `Fast-tracked via Quick Apply: ${skipReason}`,
              } : {}),
            })
            .returning();

          // Check and create compatibility flags
          const compatFlags = await checkProfileCompatibility(userId, dogId);
          if (compatFlags.length > 0) {
            await createCompatibilityFlags(userId, compatFlags);
          }

          // Return journey with extra info about quick apply status
          return res.json({
            ...journey,
            quickApplyResult: quickApplyAnalysis ? {
              skippedScreening: canSkipToMeetGreet,
              reason: skipReason,
              followUpQuestions: quickApplyAnalysis.followUpQuestions,
            } : null,
          });
        }
      }

      // If applicationResponses is provided on new journey, create with application already submitted
      if (applicationResponses) {
        const [journey] = await db.insert(schema.adoptionJourneys)
          .values({
            userId,
            dogId,
            currentStep: "phone_screening",
            applicationSubmittedAt: new Date(),
            applicationResponses: applicationResponses, // Store the application answers
            status: "active",
          })
          .returning();

        // Check and create compatibility flags
        const compatFlags = await checkProfileCompatibility(userId, dogId);
        if (compatFlags.length > 0) {
          await createCompatibilityFlags(userId, compatFlags);
        }

        return res.json(journey);
      }

      const [journey] = await db.insert(schema.adoptionJourneys)
        .values({
          userId,
          dogId,
          currentStep: "application",
          status: "active",
        })
        .returning();

      // Check and create compatibility flags
      const compatFlags = await checkProfileCompatibility(userId, dogId);
      if (compatFlags.length > 0) {
        await createCompatibilityFlags(userId, compatFlags);
      }

      res.json(journey);
    } catch (error: any) {
      console.error("Error creating adoption journey:", error);
      res.status(500).json({ message: error.message || "Failed to create adoption journey" });
    }
  });

  // Get all adoption journeys for a user with dog details
  app.get("/api/my-adoption-journeys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const journeys = await db.query.adoptionJourneys.findMany({
        where: eq(schema.adoptionJourneys.userId, userId),
        orderBy: (journeys, { desc }) => [desc(journeys.updatedAt)],
      });

      // Get dog details for each journey
      const journeysWithDogs = await Promise.all(
        journeys.map(async (journey) => {
          const dog = await db.query.dogs.findFirst({
            where: eq(schema.dogs.id, journey.dogId),
          });

          return {
            ...journey,
            dog: dog ? {
              id: dog.id,
              name: dog.name,
              breed: dog.breed,
              age: dog.age,
              photos: dog.photos,
            } : null,
            shelterName: dog?.shelterName || "Unknown",
          };
        })
      );

      res.json(journeysWithDogs);
    } catch (error: any) {
      console.error("Error fetching adoption journeys:", error);
      res.status(500).json({ message: error.message || "Failed to fetch adoption journeys" });
    }
  });

  app.get("/api/adoption-journeys/:dogId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;

      const journey = await db.query.adoptionJourneys.findFirst({
        where: (journeys, { and, eq }) =>
          and(eq(journeys.userId, userId), eq(journeys.dogId, dogId)),
      });

      res.json(journey || null);
    } catch (error: any) {
      console.error("Error fetching adoption journey:", error);
      res.status(500).json({ message: error.message || "Failed to fetch adoption journey" });
    }
  });

  app.patch("/api/adoption-journeys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify ownership
      const journey = await db.query.adoptionJourneys.findFirst({
        where: eq(schema.adoptionJourneys.id, id),
      });

      if (!journey || journey.userId !== userId) {
        return res.status(404).json({ message: "Journey not found" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating adoption journey:", error);
      res.status(500).json({ message: error.message || "Failed to update adoption journey" });
    }
  });

  // Withdraw from an adoption journey (delete application)
  app.delete("/api/adoption-journeys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify ownership - user can only withdraw their own applications
      const journey = await db.query.adoptionJourneys.findFirst({
        where: eq(schema.adoptionJourneys.id, id),
      });

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (journey.userId !== userId) {
        return res.status(403).json({ message: "You can only withdraw your own applications" });
      }

      // Delete associated documents first
      await db.delete(schema.adoptionDocuments)
        .where(eq(schema.adoptionDocuments.journeyId, id));

      // Delete the journey
      await db.delete(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, id));

      res.json({ message: "Application withdrawn successfully" });
    } catch (error: any) {
      console.error("Error withdrawing application:", error);
      res.status(500).json({ message: error.message || "Failed to withdraw application" });
    }
  });

  app.post("/api/adoption-documents", isAuthenticated, async (req: any, res) => {
    try {
      const { journeyId, documentType, fileName, fileUrl } = req.body;

      const [document] = await db.insert(schema.adoptionDocuments)
        .values({ journeyId, documentType, fileName, fileUrl })
        .returning();

      res.json(document);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: error.message || "Failed to upload document" });
    }
  });

  app.get("/api/adoption-documents/:journeyId", isAuthenticated, async (req: any, res) => {
    try {
      const { journeyId } = req.params;

      const documents = await db.query.adoptionDocuments.findMany({
        where: eq(schema.adoptionDocuments.journeyId, journeyId),
      });

      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: error.message || "Failed to fetch documents" });
    }
  });

  // ============================================
  // PHONE SCREENING (VAPI) ROUTES
  // ============================================

  // Initiate AI phone screening call (admin only - for admin panel)
  app.post("/api/adoption-journeys/:id/initiate-call", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Get journey and verify it exists
      const journey = await db.query.adoptionJourneys.findFirst({
        where: eq(schema.adoptionJourneys.id, id),
      });

      if (!journey) {
        return res.status(404).json({ message: "Journey not found" });
      }

      // Initiate the call
      const result = await initiatePhoneScreening(id, phoneNumber);

      if (result.success) {
        res.json({ message: "Call initiated successfully", callId: result.callId });
      } else {
        res.status(500).json({ message: result.error || "Failed to initiate call" });
      }
    } catch (error: any) {
      console.error("Error initiating phone screening:", error);
      res.status(500).json({ message: error.message || "Failed to initiate phone screening" });
    }
  });

  // User-initiated phone screening (adopters can start their own call)
  app.post("/api/adoption-journeys/:id/start-my-call", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get journey and verify it belongs to this user
      const journey = await db.query.adoptionJourneys.findFirst({
        where: eq(schema.adoptionJourneys.id, id),
      });

      if (!journey) {
        return res.status(404).json({ message: "Journey not found" });
      }

      // Verify the journey belongs to this user
      if (journey.userId !== userId) {
        return res.status(403).json({ message: "You can only start calls for your own applications" });
      }

      // Check if the journey is at the phone screening step
      if (journey.currentStep !== "phone_screening" && journey.currentStep !== "home_visit") {
        return res.status(400).json({ message: "Phone screening is not available at this step" });
      }

      // Check if there's already a call in progress
      if (journey.phoneScreeningStatus === "in_progress") {
        return res.status(400).json({ message: "A call is already in progress" });
      }

      // Check if screening is already completed
      if (journey.phoneScreeningStatus === "completed") {
        return res.status(400).json({ message: "Phone screening has already been completed" });
      }

      // Get the user's phone number from their profile
      const [userProfile] = await db
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId));

      if (!userProfile?.phoneNumber) {
        return res.status(400).json({
          message: "Please add your phone number to your profile before starting the call",
          code: "PHONE_REQUIRED"
        });
      }

      // Initiate the call
      const result = await initiatePhoneScreening(id, userProfile.phoneNumber);

      if (result.success) {
        res.json({
          message: "Call initiated! You'll receive a call from Scout AI shortly.",
          callId: result.callId
        });
      } else {
        res.status(500).json({ message: result.error || "Failed to initiate call" });
      }
    } catch (error: any) {
      console.error("Error initiating user phone screening:", error);
      res.status(500).json({ message: error.message || "Failed to start phone screening" });
    }
  });

  // Get phone screening status
  app.get("/api/adoption-journeys/:id/call-status", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      const journey = await db.query.adoptionJourneys.findFirst({
        where: eq(schema.adoptionJourneys.id, id),
      });

      if (!journey) {
        return res.status(404).json({ message: "Journey not found" });
      }

      // If there's a Vapi call ID, fetch the latest status
      if (journey.vapiCallId) {
        const callData = await getCallStatus(journey.vapiCallId);
        if (callData) {
          return res.json({
            ...journey,
            vapiCallData: callData,
          });
        }
      }

      res.json(journey);
    } catch (error: any) {
      console.error("Error fetching call status:", error);
      res.status(500).json({ message: error.message || "Failed to fetch call status" });
    }
  });

  // Vapi webhook endpoint (receives call events)
  app.post("/api/vapi/webhook", async (req, res) => {
    try {
      console.log("Vapi webhook received:", JSON.stringify(req.body, null, 2));

      // Check if this is a consultation call or screening call
      const callType = req.body?.message?.call?.metadata?.callType;
      if (callType === "consultation") {
        await handleConsultationWebhook(req.body);
      } else {
        await handleVapiWebhook(req.body);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Error handling Vapi webhook:", error);
      res.status(500).json({ message: error.message || "Failed to process webhook" });
    }
  });

  // Request Scout consultation call about a dog
  app.post("/api/dogs/:id/consultation-call", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const dogId = req.params.id;
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      // Verify dog exists
      const dog = await storage.getDog(dogId);
      if (!dog) {
        return res.status(404).json({ error: "Dog not found" });
      }

      console.log(`[Consultation] User ${userId} requesting call about dog ${dogId}`);

      // Initiate the consultation call
      const result = await initiateConsultationCall(userId, dogId, phoneNumber);

      if (result.success) {
        res.json({
          success: true,
          message: "Scout will call you shortly to chat about this dog!",
          callId: result.callId
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to initiate call"
        });
      }
    } catch (error: any) {
      console.error("Error initiating consultation call:", error);
      res.status(500).json({ error: error.message || "Failed to initiate consultation call" });
    }
  });

  // Foster mode consultation call
  app.post("/api/profile/foster-consultation", async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const result = await initiateFosterConsultation(req.user.id, phoneNumber);

    if (result.success) {
      res.json({ success: true, callId: result.callId });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  });

  // ============================================
  // HOUSEHOLD PETS ROUTES
  // ============================================

  // Get user's household pets
  app.get("/api/household-pets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const pets = await db.select().from(schema.householdPets).where(eq(schema.householdPets.userId, userId));
      res.json(pets);
    } catch (error: any) {
      console.error("Error fetching household pets:", error);
      res.status(500).json({ message: error.message || "Failed to fetch household pets" });
    }
  });

  // Create household pet
  app.post("/api/household-pets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [pet] = await db.insert(schema.householdPets)
        .values({
          userId,
          name: req.body.name,
          species: req.body.species,
          breed: req.body.breed || null,
          age: req.body.age || null,
          size: req.body.size || null,
          energyLevel: req.body.energyLevel || null,
          temperament: req.body.temperament || [],
          goodWithDogs: req.body.goodWithDogs || false,
          goodWithCats: req.body.goodWithCats || false,
          goodWithKids: req.body.goodWithKids || false,
          specialNeeds: req.body.specialNeeds || null,
          photo: req.body.photo || null,
        })
        .returning();

      res.json(pet);
    } catch (error: any) {
      console.error("Error creating household pet:", error);
      res.status(500).json({ message: error.message || "Failed to create household pet" });
    }
  });

  // Update household pet
  app.patch("/api/household-pets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify ownership
      const pet = await db.select().from(schema.householdPets).where(eq(schema.householdPets.id, id)).limit(1);
      if (!pet[0] || pet[0].userId !== userId) {
        return res.status(404).json({ message: "Pet not found" });
      }

      const [updated] = await db.update(schema.householdPets)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(schema.householdPets.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating household pet:", error);
      res.status(500).json({ message: error.message || "Failed to update household pet" });
    }
  });

  // Delete household pet
  app.delete("/api/household-pets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify ownership
      const pet = await db.select().from(schema.householdPets).where(eq(schema.householdPets.id, id)).limit(1);
      if (!pet[0] || pet[0].userId !== userId) {
        return res.status(404).json({ message: "Pet not found" });
      }

      await db.delete(schema.householdPets).where(eq(schema.householdPets.id, id));
      res.json({ message: "Pet deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting household pet:", error);
      res.status(500).json({ message: error.message || "Failed to delete household pet" });
    }
  });

  // ============================================
  // FAMILY MEMBERS ROUTES
  // ============================================

  // Get user's family members
  app.get("/api/family-members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const members = await db.select().from(schema.familyMembers).where(eq(schema.familyMembers.userId, userId));
      res.json(members);
    } catch (error: any) {
      console.error("Error fetching family members:", error);
      res.status(500).json({ message: error.message || "Failed to fetch family members" });
    }
  });

  // Create family member
  app.post("/api/family-members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [member] = await db.insert(schema.familyMembers)
        .values({
          userId: userId,
          name: req.body.name,
          relation: req.body.relation,
          ageGroup: req.body.ageGroup || null,
        })
        .returning();

      res.json(member);
    } catch (error: any) {
      console.error("Error creating family member:", error);
      res.status(500).json({ message: error.message || "Failed to create family member" });
    }
  });

  // Delete family member
  app.delete("/api/family-members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify ownership
      const member = await db.select().from(schema.familyMembers).where(eq(schema.familyMembers.id, id)).limit(1);
      if (!member[0] || member[0].userId !== userId) {
        return res.status(404).json({ message: "Family member not found" });
      }

      await db.delete(schema.familyMembers).where(eq(schema.familyMembers.id, id));
      res.json({ message: "Family member deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting family member:", error);
      res.status(500).json({ message: error.message || "Failed to delete family member" });
    }
  });

  // File upload endpoint for dog photos
  app.post("/api/upload/dog-photo", isAuthenticated, async (req: any, res) => {
    try {
      // Check if file was provided
      const base64Data = req.body.image;
      if (!base64Data) {
        return res.status(400).json({ message: "No image data provided" });
      }

      // Extract base64 data (remove data:image/...;base64, prefix if present)
      const base64Match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
      const imageData = base64Match ? base64Match[1] : base64Data;

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const filename = `dog_photo_${timestamp}_${randomId}.jpg`;

      // Save to attached_assets directory
      const fs = await import('fs/promises');
      const path = await import('path');

      const uploadsDir = path.join(process.cwd(), 'attached_assets', 'dog_photos');

      // Create directory if it doesn't exist
      try {
        await fs.mkdir(uploadsDir, { recursive: true });
      } catch (err) {
        // Directory might already exist
      }

      const filePath = path.join(uploadsDir, filename);

      // Write file
      await fs.writeFile(filePath, imageData, 'base64');

      // Return public URL
      const publicUrl = `/attached_assets/dog_photos/${filename}`;

      res.json({ url: publicUrl });
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ message: error.message || "Failed to upload photo" });
    }
  });

  // AI-powered dog photo analysis endpoint
  // Uses Gemini vision to identify breed, size, age, and other characteristics
  // This uses Replit's AI Integrations service for Gemini access without requiring your own API key
  app.post("/api/analyze/dog-photo", isAuthenticated, async (req: any, res) => {
    try {
      const { imageUrl, imageBase64 } = req.body;

      if (!imageUrl && !imageBase64) {
        return res.status(400).json({ message: "Please provide an image URL or base64 data" });
      }

      // Import Google GenAI dynamically
      const { GoogleGenAI, Type } = await import('@google/genai');

      // This is using Replit's AI Integrations service for Gemini access
      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      // Extract base64 data and mime type from the image
      let base64Data: string;
      let mimeType: string = 'image/jpeg';

      if (imageBase64) {
        // Parse data URI if present
        const dataUriMatch = imageBase64.match(/^data:image\/\w+;base64,(.+)$/);
        if (dataUriMatch) {
          mimeType = dataUriMatch[1];
          base64Data = dataUriMatch[2];
        } else {
          base64Data = imageBase64;
        }
      } else if (imageUrl) {
        // Read from local file
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl);

        try {
          const imageBuffer = await fs.readFile(filePath);
          base64Data = imageBuffer.toString('base64');

          // Detect mime type from magic bytes
          const header = imageBuffer.slice(0, 4).toString('hex').toUpperCase();
          if (header.startsWith('FFD8FF')) mimeType = 'image/jpeg';
          else if (header.startsWith('89504E47')) mimeType = 'image/png';
          else if (header.startsWith('47494638')) mimeType = 'image/gif';
          else if (header.startsWith('52494646')) mimeType = 'image/webp';
        } catch {
          return res.status(400).json({ message: "Image file not found", success: false });
        }
      } else {
        return res.status(400).json({ message: "No valid image data provided", success: false });
      }

      console.log(`[Dog Analysis] Analyzing image, size: ${base64Data.length} chars, mime: ${mimeType}`);

      const prompt = `You are an expert dog breed identifier and animal behaviorist. Analyze this dog photo and return detailed information.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) with this structure:
{
  "breed": "Primary breed or mix description (e.g., 'Labrador Retriever', 'German Shepherd Mix', 'Mixed Breed')",
  "breedConfidence": "high" or "medium" or "low",
  "size": "small" or "medium" or "large",
  "ageCategory": "puppy" or "young" or "adult" or "senior",
  "estimatedAge": "Estimated age range (e.g., '1-2 years', '6-8 months')",
  "energyLevel": "low" or "moderate" or "high" or "very_high",
  "suggestedTemperament": ["friendly", "playful", "etc"],
  "suggestedGoodWithKids": true or false or null,
  "suggestedGoodWithDogs": true or false or null,
  "suggestedGoodWithCats": true or false or null,
  "coatColor": "Description of coat color/pattern",
  "estimatedWeight": "Estimated weight range in lbs",
  "observations": "Brief description of what you observe about the dog's appearance and likely personality"
}

Valid temperament options: friendly, playful, calm, energetic, loyal, protective, independent, affectionate, curious, gentle, intelligent, stubborn, social, reserved, adaptable, anxious

Analyze this dog photo now:`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              breed: { type: Type.STRING },
              breedConfidence: { type: Type.STRING },
              size: { type: Type.STRING },
              ageCategory: { type: Type.STRING },
              estimatedAge: { type: Type.STRING },
              energyLevel: { type: Type.STRING },
              suggestedTemperament: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedGoodWithKids: { type: Type.BOOLEAN, nullable: true },
              suggestedGoodWithDogs: { type: Type.BOOLEAN, nullable: true },
              suggestedGoodWithCats: { type: Type.BOOLEAN, nullable: true },
              coatColor: { type: Type.STRING },
              estimatedWeight: { type: Type.STRING },
              observations: { type: Type.STRING }
            },
            required: ["breed", "breedConfidence", "size", "ageCategory", "energyLevel", "suggestedTemperament"]
          }
        }
      });

      const analysisText = response.text;
      if (!analysisText) {
        return res.status(500).json({ message: "Failed to analyze image - no response from AI" });
      }

      const analysis = JSON.parse(analysisText);

      console.log(`[Dog Analysis] Identified: ${analysis.breed} (${analysis.breedConfidence} confidence)`);

      res.json({
        success: true,
        analysis
      });
    } catch (error: any) {
      console.error("Error analyzing dog photo:", error);
      res.status(500).json({
        message: error.message || "Failed to analyze photo",
        success: false
      });
    }
  });

  // AI-powered person photo analysis endpoint
  // Analyzes person photos to estimate age group for family member profiles
  app.post("/api/analyze/person-photo", isAuthenticated, async (req: any, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ message: "Please provide image base64 data" });
      }

      const { GoogleGenAI, Type } = await import('@google/genai');

      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      // Extract base64 data and mime type
      let base64Data: string;
      let mimeType: string = 'image/jpeg';

      const dataUriMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        base64Data = dataUriMatch[2];
      } else {
        base64Data = imageBase64;
      }

      console.log(`[Person Analysis] Analyzing image, size: ${base64Data.length} chars`);

      const prompt = `You are an expert at estimating human age from photos. Analyze this photo of a person and estimate their age group.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) with this structure:
{
  "ageGroup": "infant" or "toddler" or "child" or "teen" or "adult" or "senior",
  "estimatedAge": "Estimated age range (e.g., '5-7 years', '30-35 years')",
  "confidence": "high" or "medium" or "low",
  "observations": "Brief description of what you observe"
}

Age group definitions:
- infant: 0-1 years
- toddler: 1-3 years
- child: 4-12 years
- teen: 13-17 years
- adult: 18-64 years
- senior: 65+ years

Analyze this person photo now:`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ageGroup: { type: Type.STRING },
              estimatedAge: { type: Type.STRING },
              confidence: { type: Type.STRING },
              observations: { type: Type.STRING }
            },
            required: ["ageGroup", "estimatedAge", "confidence"]
          }
        }
      });

      const analysisText = response.text;
      if (!analysisText) {
        return res.status(500).json({ message: "Failed to analyze image - no response from AI" });
      }

      const analysis = JSON.parse(analysisText);

      console.log(`[Person Analysis] Identified age group: ${analysis.ageGroup} (${analysis.confidence} confidence)`);

      res.json({
        success: true,
        analysis
      });
    } catch (error: any) {
      console.error("Error analyzing person photo:", error);
      res.status(500).json({
        message: error.message || "Failed to analyze photo",
        success: false
      });
    }
  });

  // AI-powered home environment photo analysis endpoint
  // Analyzes home photos to assess pet suitability
  app.post("/api/analyze/home-photo", isAuthenticated, async (req: any, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ message: "Please provide image base64 data" });
      }

      const { GoogleGenAI, Type } = await import('@google/genai');

      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      // Extract base64 data and mime type
      let base64Data: string;
      let mimeType: string = 'image/jpeg';

      const dataUriMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        base64Data = dataUriMatch[2];
      } else {
        base64Data = imageBase64;
      }

      console.log(`[Home Analysis] Analyzing image, size: ${base64Data.length} chars`);

      const prompt = `You are an expert at evaluating home environments for pet suitability. Analyze this photo of a home/living space and assess how suitable it would be for a dog.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) with this structure:
{
  "homeType": "house" or "apartment" or "condo" or "other",
  "hasYard": true or false or null (if cannot determine),
  "yardSize": "small" or "medium" or "large" or null,
  "isFenced": true or false or null,
  "petFriendlyFeatures": ["array", "of", "positive", "features"],
  "potentialConcerns": ["array", "of", "concerns"],
  "overallSuitability": "excellent" or "good" or "fair" or "needs_improvement",
  "observations": "Brief description of what you observe about the space",
  "confidence": "high" or "medium" or "low"
}

Pet-friendly features to look for: spacious areas, hardwood/tile floors (easy to clean), access to outdoors, fenced areas, no visible hazards, dog-friendly furniture, pet gates, etc.

Potential concerns to note: small spaces, lots of fragile items, steep stairs, toxic plants, unfenced areas near roads, etc.

Analyze this home photo now:`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              homeType: { type: Type.STRING },
              hasYard: { type: Type.BOOLEAN, nullable: true },
              yardSize: { type: Type.STRING, nullable: true },
              isFenced: { type: Type.BOOLEAN, nullable: true },
              petFriendlyFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
              potentialConcerns: { type: Type.ARRAY, items: { type: Type.STRING } },
              overallSuitability: { type: Type.STRING },
              observations: { type: Type.STRING },
              confidence: { type: Type.STRING }
            },
            required: ["homeType", "overallSuitability", "confidence", "petFriendlyFeatures", "potentialConcerns"]
          }
        }
      });

      const analysisText = response.text;
      if (!analysisText) {
        return res.status(500).json({ message: "Failed to analyze image - no response from AI" });
      }

      const analysis = JSON.parse(analysisText);

      console.log(`[Home Analysis] Suitability: ${analysis.overallSuitability} (${analysis.confidence} confidence)`);

      res.json({
        success: true,
        analysis
      });
    } catch (error: any) {
      console.error("Error analyzing home photo:", error);
      res.status(500).json({
        message: error.message || "Failed to analyze photo",
        success: false
      });
    }
  });

  // ============================================
  // AI PET NAME GENERATOR ENDPOINT
  // ============================================
  // Generate creative pet name suggestions based on breed, size, and color
  app.post("/api/generate-pet-names", isAuthenticated, async (req: any, res) => {
    try {
      const { breed, size, color } = req.body;

      const { GoogleGenAI } = await import('@google/genai');

      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      const prompt = `Generate 6 creative, fun, and memorable pet names for a ${size || 'medium'} ${breed || 'dog'}${color ? ` with ${color} coloring` : ''}.

Include a mix of:
- Classic names that are timeless
- Fun/quirky names that show personality
- Names inspired by the breed's origin or characteristics
- Names that are easy to call out and remember

You MUST respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "names": ["Name1", "Name2", "Name3", "Name4", "Name5", "Name6"]
}`;

      console.log(`[Pet Names] Generating names for ${breed || 'unknown breed'}`);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No response from AI");
      }

      // Clean up response - remove markdown code blocks if present
      let cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }

      const result = JSON.parse(cleanedResponse);
      console.log(`[Pet Names] Generated: ${result.names?.join(', ')}`);

      res.json({
        success: true,
        names: result.names || [],
      });
    } catch (error: any) {
      console.error("Error generating pet names:", error);
      res.status(500).json({
        message: error.message || "Failed to generate names",
        success: false,
        names: []
      });
    }
  });

  // ============================================
  // ENHANCED AI ANIMAL SCANNER ENDPOINT
  // ============================================
  // Full animal scanning with breed detection + temperament analysis
  // Analyzes body language cues: tail position, ear position, posture, facial expression
  app.post("/api/analyze/animal-scan", isAuthenticated, async (req: any, res) => {
    try {
      const { imageBase64 } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ message: "Please provide image base64 data", success: false });
      }

      const { GoogleGenAI, Type } = await import('@google/genai');

      const ai = new GoogleGenAI({
        apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
        httpOptions: {
          apiVersion: "",
          baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
        },
      });

      // Extract base64 data and mime type
      let base64Data: string;
      let mimeType: string = 'image/jpeg';

      const dataUriMatch = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (dataUriMatch) {
        mimeType = dataUriMatch[1];
        base64Data = dataUriMatch[2];
      } else {
        base64Data = imageBase64;
      }

      console.log(`[Animal Scan] Analyzing image with temperament detection, size: ${base64Data.length} chars`);

      const prompt = `You are an expert animal behaviorist and breed specialist. Perform a comprehensive analysis of this animal photo including breed identification, temperament assessment, and body language analysis.

IMPORTANT: Analyze the animal's visible body language cues to assess temperament:
- Tail position and movement patterns (raised, lowered, wagging)
- Ear position (forward, back, relaxed)
- Posture (confident, submissive, relaxed, tense, anxious)
- Facial expression (relaxed, alert, stressed, happy)
- Overall energy and demeanor

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) with this structure:
{
  "species": "dog" or "cat" or "other",
  "breed": "Primary breed or mix description",
  "breedConfidence": "high" or "medium" or "low",
  "size": "small" or "medium" or "large",
  "ageCategory": "puppy" or "young" or "adult" or "senior",
  "estimatedAge": "Estimated age range (e.g., '1-2 years')",
  "energyLevel": "low" or "moderate" or "high" or "very_high",
  "coatColor": "Description of coat color/pattern",
  "estimatedWeight": "Estimated weight range in lbs",
  "temperament": {
    "calmLevel": 0.0 to 1.0 (how calm vs excited the animal appears),
    "friendlinessScore": 0.0 to 1.0 (how friendly/approachable based on body language),
    "confidenceScore": 0.0 to 1.0 (how confident vs nervous),
    "stressScore": 0.0 to 1.0 (visible stress indicators),
    "energyEstimate": "low" or "medium" or "high"
  },
  "bodyLanguage": {
    "tailPosition": "Description of tail position/movement",
    "earPosition": "Description of ear position",
    "posture": "Description of body posture",
    "facialExpression": "Description of facial expression"
  },
  "suggestedTemperament": ["trait1", "trait2", ...],
  "suggestedGoodWithKids": true or false or null,
  "suggestedGoodWithDogs": true or false or null,
  "suggestedGoodWithCats": true or false or null,
  "observations": "Brief narrative description of the animal's appearance, visible personality traits, and any notable behavioral signals"
}

Valid temperament trait options: friendly, playful, calm, energetic, loyal, protective, independent, affectionate, curious, gentle, intelligent, stubborn, social, reserved, adaptable, anxious, confident, shy

Analyze this animal photo now:`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ]
        }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              species: { type: Type.STRING },
              breed: { type: Type.STRING },
              breedConfidence: { type: Type.STRING },
              size: { type: Type.STRING },
              ageCategory: { type: Type.STRING },
              estimatedAge: { type: Type.STRING },
              energyLevel: { type: Type.STRING },
              coatColor: { type: Type.STRING },
              estimatedWeight: { type: Type.STRING },
              temperament: {
                type: Type.OBJECT,
                properties: {
                  calmLevel: { type: Type.NUMBER },
                  friendlinessScore: { type: Type.NUMBER },
                  confidenceScore: { type: Type.NUMBER },
                  stressScore: { type: Type.NUMBER },
                  energyEstimate: { type: Type.STRING }
                }
              },
              bodyLanguage: {
                type: Type.OBJECT,
                properties: {
                  tailPosition: { type: Type.STRING },
                  earPosition: { type: Type.STRING },
                  posture: { type: Type.STRING },
                  facialExpression: { type: Type.STRING }
                }
              },
              suggestedTemperament: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedGoodWithKids: { type: Type.BOOLEAN, nullable: true },
              suggestedGoodWithDogs: { type: Type.BOOLEAN, nullable: true },
              suggestedGoodWithCats: { type: Type.BOOLEAN, nullable: true },
              observations: { type: Type.STRING }
            },
            required: ["species", "breed", "breedConfidence", "size", "ageCategory", "energyLevel", "temperament", "bodyLanguage", "suggestedTemperament"]
          }
        }
      });

      const analysisText = response.text;
      if (!analysisText) {
        return res.status(500).json({ message: "Failed to analyze image - no response from AI", success: false });
      }

      const analysis = JSON.parse(analysisText);

      console.log(`[Animal Scan] Identified: ${analysis.species} - ${analysis.breed} (${analysis.breedConfidence} confidence), Energy: ${analysis.temperament?.energyEstimate}`);

      // Store scan metadata for ML improvement (anonymized)
      try {
        await storage.createScanMetadata({
          userId: req.user?.id || null,
          species: analysis.species,
          breed: analysis.breed,
          breedConfidence: analysis.breedConfidence,
          temperamentData: analysis.temperament,
          bodyLanguageData: analysis.bodyLanguage,
          scanTimestamp: new Date(),
        });
      } catch (err) {
        // Don't fail the request if metadata storage fails
        console.error("[Animal Scan] Failed to store scan metadata:", err);
      }

      res.json({
        success: true,
        analysis
      });
    } catch (error: any) {
      console.error("Error in animal scan:", error);
      res.status(500).json({
        message: error.message || "Failed to analyze animal",
        success: false
      });
    }
  });

  // File upload endpoint for family photos
  app.post("/api/upload/family-photo", isAuthenticated, async (req: any, res) => {
    try {
      const base64Data = req.body.image;
      if (!base64Data) {
        return res.status(400).json({ message: "No image data provided" });
      }

      // Extract base64 data (remove data:image/...;base64, prefix if present)
      const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
      const imageData = base64Match ? base64Match[2] : base64Data;
      const ext = base64Match ? base64Match[1] : 'jpg';

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const filename = `family_photo_${timestamp}_${randomId}.${ext}`;

      // Save to attached_assets directory
      const fs = await import('fs/promises');
      const path = await import('path');

      const uploadsDir = path.join(process.cwd(), 'attached_assets', 'family_photos');

      // Create directory if it doesn't exist
      try {
        await fs.mkdir(uploadsDir, { recursive: true });
      } catch (err) {
        // Directory might already exist
      }

      const filePath = path.join(uploadsDir, filename);

      // Write file
      await fs.writeFile(filePath, imageData, 'base64');

      // Return public URL
      const photoUrl = `/attached_assets/family_photos/${filename}`;

      res.json({ photoUrl });
    } catch (error: any) {
      console.error("Error uploading family photo:", error);
      res.status(500).json({ message: error.message || "Failed to upload photo" });
    }
  });

  // ============================================
  // FOSTER DISCOVERY (for rehomers to find fosters)
  // ============================================

  // Get available fosters for rehomers
  app.get("/api/fosters/discover", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { latitude, longitude, radius = 50, size, age, energy, specialNeeds } = req.query;

      // Get user's profile for location fallback
      const userProfile = await db.select().from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);

      const userLat = latitude ? parseFloat(latitude as string) : userProfile[0]?.latitude;
      const userLng = longitude ? parseFloat(longitude as string) : userProfile[0]?.longitude;
      const searchRadius = parseInt(radius as string) || 50;

      if (!userLat || !userLng) {
        return res.status(400).json({ message: "Location required" });
      }

      // Get all visible fosters with their user info
      const fostersWithUsers = await db
        .select({
          profile: schema.userProfiles,
          user: schema.users,
        })
        .from(schema.userProfiles)
        .innerJoin(schema.users, eq(schema.userProfiles.userId, schema.users.id))
        .where(
          and(
            eq(schema.userProfiles.fosterVisible, true),
            sql`${schema.userProfiles.fosterCapacity} > COALESCE(${schema.userProfiles.fosterCurrentCount}, 0)`
          )
        );

      // Calculate distance and filter
      const fostersWithDistance = fostersWithUsers.map(({ profile, user }) => {
        const distance = calculateDistance(
          userLat,
          userLng,
          profile.latitude,
          profile.longitude
        );
        return {
          id: profile.id,
          userId: profile.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImage: profile.profileImage || user.profileImageUrl,
          city: profile.city,
          state: profile.state,
          latitude: profile.latitude,
          longitude: profile.longitude,
          distance: Math.round(distance * 10) / 10,

          // Foster-specific info
          fosterTimeCommitment: profile.fosterTimeCommitment,
          fosterSizePreference: profile.fosterSizePreference,
          fosterAgePreference: profile.fosterAgePreference,
          fosterEnergyPreference: profile.fosterEnergyPreference,
          fosterSpecialNeedsWilling: profile.fosterSpecialNeedsWilling,
          fosterEmergencyAvailability: profile.fosterEmergencyAvailability,
          fosterPreviousExperience: profile.fosterPreviousExperience,
          fosterCapacity: profile.fosterCapacity,
          fosterCurrentCount: profile.fosterCurrentCount || 0,
          fosterBio: profile.fosterBio,
        };
      });

      // Filter by distance
      let results = fostersWithDistance.filter(f => f.distance <= searchRadius);

      // Apply preference filters
      if (size) {
        results = results.filter(f =>
          !f.fosterSizePreference ||
          f.fosterSizePreference.includes(size as string) ||
          f.fosterSizePreference.includes('any')
        );
      }

      if (age) {
        results = results.filter(f =>
          !f.fosterAgePreference ||
          f.fosterAgePreference.includes(age as string) ||
          f.fosterAgePreference.includes('any')
        );
      }

      if (energy) {
        results = results.filter(f =>
          !f.fosterEnergyPreference ||
          f.fosterEnergyPreference.includes(energy as string) ||
          f.fosterEnergyPreference.includes('any')
        );
      }

      if (specialNeeds === 'true') {
        results = results.filter(f => f.fosterSpecialNeedsWilling === true);
      }

      // Sort by distance
      results.sort((a, b) => a.distance - b.distance);

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching fosters:", error);
      res.status(500).json({ message: error.message || "Failed to fetch fosters" });
    }
  });
}
