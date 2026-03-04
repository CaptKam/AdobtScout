import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sampleDogs } from "./data/sample-dogs";
import { getChatResponse, calculateCompatibility, getEnhancedChatResponse, getJourneyCoachingMessage, generateProactiveSuggestion } from "./ai/scout";
import { assembleScoutContext, invalidateUserContextCache } from "./ai/scout-context";
import { initiateConsultationCall, handleConsultationWebhook, initiateFosterConsultation } from "./vapi";
import type { DogWithCompatibility, UserProfile, User, InsertIntakeRecord, IntakeFormData, OutcomeFormData } from "@shared/schema";
import { insertIntakeRecordSchema, intakeFormSchema, outcomeFormSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin, hashPassword, validatePassword, canReviewEligibility, isPlatformAdmin } from "./auth";
import passport from "passport";
import { randomUUID } from "crypto";
import { eq, and, or, sql, isNull, isNotNull, gt, gte, lte, desc, inArray, not } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "./db";
import crypto from "crypto";
import { initiatePhoneScreening, handleVapiWebhook, getCallStatus, analyzeForQuickApply } from "./vapi";
import { cache, CACHE_KEYS, CACHE_TTL } from "./cache";
import { emitAnalyzeRequest, isPluginEnabled, getCreatedMedicalRecordsSync, enablePlugin, disablePlugin } from "./plugins/health-screening";
import { isPluginEnabled as isAutomationsPluginEnabled, enablePlugin as enableAutomationsPlugin, disablePlugin as disableAutomationsPlugin } from "./plugins/automations";
import { eventBus } from "./events/event-bus";

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

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  await setupAuth(app);

  // Initialize default admin user
  const ensureDefaultAdmin = async () => {
    const DEFAULT_ADMIN_EMAIL = "admin@scout.app";
    const DEFAULT_ADMIN_PASSWORD = "Admin1234!";

    const existingAdmin = await storage.getUserByEmail(DEFAULT_ADMIN_EMAIL);

    if (!existingAdmin) {
      const hashedPassword = await hashPassword(DEFAULT_ADMIN_PASSWORD);
      await storage.createUser({
        email: DEFAULT_ADMIN_EMAIL,
        password: hashedPassword,
        firstName: "Scout",
        lastName: "Admin",
        role: "adopter",
      });

      // Update the user to be an admin
      const adminUser = await storage.getUserByEmail(DEFAULT_ADMIN_EMAIL);
      if (adminUser) {
        await db.update(schema.users)
          .set({ 
            isAdmin: true,
            isActive: true 
          })
          .where(eq(schema.users.id, adminUser.id));
        console.log(`✓ Created default admin account: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
      }
    }
  };

  // Initialize default shelter user for sample dogs
  const ensureDefaultShelter = async (): Promise<string> => {
    const DEFAULT_SHELTER_EMAIL = "shelter@happytails.org";
    const DEFAULT_SHELTER_PASSWORD = "password123";

    const existingUser = await storage.getUserByEmail(DEFAULT_SHELTER_EMAIL);

    if (existingUser) {
      // If existing shelter doesn't have a password, add one
      if (!existingUser.password) {
        const hashedPassword = await hashPassword(DEFAULT_SHELTER_PASSWORD);
        await db.update(schema.users)
          .set({ password: hashedPassword })
          .where(eq(schema.users.id, existingUser.id));
        console.log(`✓ Added password to existing shelter account: ${DEFAULT_SHELTER_EMAIL} / ${DEFAULT_SHELTER_PASSWORD}`);
      }
      return existingUser.id;
    }

    // Create default shelter user with password (using createUser like admin)
    const hashedPassword = await hashPassword(DEFAULT_SHELTER_PASSWORD);
    const shelterUser = await storage.createUser({
      email: DEFAULT_SHELTER_EMAIL,
      password: hashedPassword,
      firstName: "Happy Tails",
      lastName: "Rescue",
      role: "shelter",
    });

    console.log(`✓ Created default shelter account: ${DEFAULT_SHELTER_EMAIL} / ${DEFAULT_SHELTER_PASSWORD}`);
    return shelterUser.id;
  };

  // Initialize sample dog data
  const initializeDogs = async () => {
    const existingDogs = await storage.getAllDogs();
    if (existingDogs.length === 0) {
      const shelterId = await ensureDefaultShelter();

      for (const dogData of sampleDogs) {
        await storage.createDog({
          ...dogData,
          userId: shelterId, // Assign all sample dogs to the default shelter
        });
      }
      console.log("✓ Sample dog data initialized");
    }
  };

  await ensureDefaultAdmin();
  await ensureDefaultShelter();
  await initializeDogs();


  // ============================================
  // AUTH ROUTES
  // ============================================

  // Demo account endpoint
  app.post("/api/demo-login", async (req, res) => {
    try {
      const demoEmail = "demo@scout.app";
      const demoPassword = "Demo1234!";

      // Check if demo user exists
      let demoUser = await storage.getUserByEmail(demoEmail);

      // Create demo user if it doesn't exist
      if (!demoUser) {
        const hashedPassword = await hashPassword(demoPassword);
        demoUser = await storage.createUser({
          email: demoEmail,
          password: hashedPassword,
          firstName: "Demo",
          lastName: "User",
          role: "adopter",
        });

        // Create a demo profile with typical preferences - Dallas, TX
        await storage.createUserProfile({
          userId: demoUser.id,
          homeType: "house",
          hasYard: true,
          hasOtherPets: false,
          otherPetsType: null,
          activityLevel: "moderate",
          workSchedule: "hybrid",
          exerciseCommitment: "1-2 hours daily",
          experienceLevel: "some_experience",
          preferredSize: ["medium"],
          preferredAge: ["young_adult", "adult"],
          preferredEnergy: ["moderate"],
          householdComposition: "couple",
          searchRadius: 50,
          latitude: 32.7767, // Dallas, TX
          longitude: -96.7970,
          city: "Dallas",
          state: "TX",
        });
      } else {
        // Demo user exists - ensure profile is set to Dallas
        const existingProfile = await storage.getUserProfile(demoUser.id);
        if (existingProfile && (existingProfile.latitude !== 32.7767 || existingProfile.longitude !== -96.7970)) {
          await storage.updateUserProfile(demoUser.id, {
            latitude: 32.7767,
            longitude: -96.7970,
            city: "Dallas",
            state: "TX",
          });
        }
      }

      // Log in the demo user
      req.login(demoUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({
          id: demoUser!.id,
          email: demoUser!.email,
          role: demoUser!.role,
          firstName: demoUser!.firstName,
          lastName: demoUser!.lastName,
        });
      });
    } catch (error) {
      console.error("Demo login error:", error);
      res.status(500).json({ message: "Demo account creation failed" });
    }
  });

  // Login endpoint
  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }

      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      });
    })(req, res, next);
  });

  // Signup endpoint
  app.post('/api/signup', async (req, res) => {
    const { email, password, firstName, lastName, role = 'adopter' } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate password strength
    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      return res.status(400).json({ message: passwordResult.message });
    }

    try {
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "Email already in use" });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);
      const newUser = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: (role as 'adopter' | 'shelter' | 'owner') || 'adopter',
      });

      // Log the user in
      req.login(newUser, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Failed to establish session after signup" });
        }

        res.json({
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        });
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      res.status(500).json({ message: error.message || "Signup failed" });
    }
  });

  // Google OAuth routes
  app.get('/api/auth/google', 
    (req, res, next) => {
      // Store intended role if provided in query params
      const intendedRole = req.query.intended_role as 'adopter' | 'shelter';
      if (intendedRole) {
        req.session.intendedRole = intendedRole;
      }
      next();
    },
    passport.authenticate('google', { 
      scope: ['profile', 'email'] 
    })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req: any, res) => {
      // Successful authentication - check if this was a signup flow
      const intendedRole = req.session.intendedRole;

      if (intendedRole) {
        // Clear the intended role from session
        delete req.session.intendedRole;
        res.redirect('/onboarding');
      } else {
        // Regular login
        res.redirect('/onboarding');
      }
    }
  );

  // Apple OAuth routes (placeholder - requires Apple Developer setup)
  app.post('/api/auth/apple', async (req, res) => {
    res.status(501).json({ 
      message: 'Apple Sign In requires Apple Developer account configuration. Please set up Apple Sign In credentials.' 
    });
  });

  // Admin login endpoint - validates admin status before establishing session
  app.post('/api/auth/admin-login', (req, res, next) => {
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      if (err) {
        console.error("[Admin Login] Authentication error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      if (!user) {
        console.log("[Admin Login] Failed - Invalid credentials");
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Debug logging to see what Passport returned
      console.log("[Admin Login] User object from Passport:", {
        email: user.email,
        role: user.role,
        has_isAdmin: 'isAdmin' in user,
        has_is_admin: 'is_admin' in user,
        isAdmin_value: user.isAdmin,
        is_admin_value: (user as any).is_admin,
        all_keys: Object.keys(user)
      });

      // Verify admin status and active status before allowing login
      // Check both camelCase and snake_case due to DB/type inconsistencies
      const isAdmin = user.isAdmin || (user as any).is_admin;
      const isActive = user.isActive || (user as any).is_active;

      if (!isAdmin) {
        console.log("[Admin Login] Rejected - User is not an admin:", { email: user.email, userId: user.id, isAdmin, is_admin: (user as any).is_admin });
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      if (!isActive) {
        console.log("[Admin Login] Rejected - Admin account is inactive:", { email: user.email, userId: user.id });
        return res.status(403).json({ message: "Account is inactive. Please contact support." });
      }

      // Log successful admin login for audit trail
      console.log("[Admin Login] Success:", {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      // Establish admin session
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("[Admin Login] Session creation failed:", loginErr);
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: user.isAdmin,
        });
      });
    })(req, res, next);
  });

  // Shelter login endpoint - validates shelter role before establishing session
  app.post('/api/auth/shelter-login', (req, res, next) => {
    passport.authenticate('local', async (err: any, user: any, info: any) => {
      if (err) {
        console.error("[Shelter Login] Authentication error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }

      if (!user) {
        console.log("[Shelter Login] Failed - Invalid credentials");
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify shelter role before allowing login
      if (user.role !== 'shelter') {
        console.log("[Shelter Login] Rejected - User is not a shelter:", { email: user.email, userId: user.id, role: user.role });
        return res.status(403).json({ message: "Access denied. This login is for shelter accounts only." });
      }

      // Check if account is active
      const isActive = user.isActive || (user as any).is_active;
      if (isActive === false) {
        console.log("[Shelter Login] Rejected - Shelter account is inactive:", { email: user.email, userId: user.id });
        return res.status(403).json({ message: "Account is inactive. Please contact support." });
      }

      // Log successful shelter login
      console.log("[Shelter Login] Success:", {
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      // Establish shelter session
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("[Shelter Login] Session creation failed:", loginErr);
          return res.status(500).json({ message: "Login failed" });
        }

        res.json({
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      });
    })(req, res, next);
  });

  app.post('/api/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
          return res.status(500).json({ message: "Failed to destroy session" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  // ============================================
  // ADMIN ROUTES
  // ============================================
  // const { isAdmin } = await import('./auth'); // Already imported above

  // Dashboard metrics
  app.get('/api/admin/metrics', isAdmin, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error: any) {
      console.error("Error fetching admin metrics:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending shelters
  app.get('/api/admin/shelters/pending', isAdmin, async (req, res) => {
    try {
      const shelters = await storage.getPendingShelters();
      res.json(shelters);
    } catch (error: any) {
      console.error("Error fetching pending shelters:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending dogs
  app.get('/api/admin/dogs/pending', isAdmin, async (req, res) => {
    try {
      const dogs = await storage.getPendingDogs();
      res.json(dogs);
    } catch (error: any) {
      console.error("Error fetching pending dogs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve shelter
  app.patch('/api/admin/shelters/:id/approve', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const shelter = await storage.approveShelter(id, adminId);
      if (!shelter) {
        return res.status(404).json({ message: "Shelter not found" });
      }

      res.json(shelter);
    } catch (error: any) {
      console.error("Error approving shelter:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reject shelter
  app.patch('/api/admin/shelters/:id/reject', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason required" });
      }

      const shelter = await storage.rejectShelter(id, adminId, reason);
      if (!shelter) {
        return res.status(404).json({ message: "Shelter not found" });
      }

      res.json(shelter);
    } catch (error: any) {
      console.error("Error rejecting shelter:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve dog
  app.patch('/api/admin/dogs/:id/approve', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const dog = await storage.approveDog(id, adminId);
      if (!dog) {
        return res.status(404).json({ message: "Dog not found" });
      }

      res.json(dog);
    } catch (error: any) {
      console.error("Error approving dog:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reject dog
  app.patch('/api/admin/dogs/:id/reject', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason required" });
      }

      const dog = await storage.rejectDog(id, adminId, reason);
      if (!dog) {
        return res.status(404).json({ message: "Dog not found" });
      }

      res.json(dog);
    } catch (error: any) {
      console.error("Error rejecting dog:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ---- Foster Approval Routes ----

  // Get pending foster accounts
  app.get('/api/admin/fosters/pending', isAdmin, async (req, res) => {
    try {
      const fosters = await db.select({
        id: schema.userProfiles.id,
        userId: schema.userProfiles.userId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
        phoneNumber: schema.userProfiles.phoneNumber,
        city: schema.userProfiles.city,
        state: schema.userProfiles.state,
        profileImage: schema.userProfiles.profileImage,
        fosterApprovalStatus: schema.userProfiles.fosterApprovalStatus,
        fosterTimeCommitment: schema.userProfiles.fosterTimeCommitment,
        fosterSizePreference: schema.userProfiles.fosterSizePreference,
        fosterSpecialNeedsWilling: schema.userProfiles.fosterSpecialNeedsWilling,
        fosterEmergencyAvailability: schema.userProfiles.fosterEmergencyAvailability,
        fosterPreviousExperience: schema.userProfiles.fosterPreviousExperience,
        fosterCapacity: schema.userProfiles.fosterCapacity,
        createdAt: schema.userProfiles.createdAt,
      })
      .from(schema.userProfiles)
      .innerJoin(schema.users, eq(schema.users.id, schema.userProfiles.userId))
      .where(eq(schema.userProfiles.fosterApprovalStatus, 'pending'));

      res.json(fosters);
    } catch (error: any) {
      console.error("Error fetching pending fosters:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve foster account
  app.patch('/api/admin/fosters/:id/approve', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;

      const [updated] = await db.update(schema.userProfiles)
        .set({
          fosterApprovalStatus: 'approved',
          fosterApprovedBy: adminId,
          fosterApprovedAt: new Date(),
        })
        .where(eq(schema.userProfiles.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Foster profile not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error approving foster:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reject foster account
  app.patch('/api/admin/fosters/:id/reject', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const adminId = req.user.id;

      if (!reason) {
        return res.status(400).json({ message: "Rejection reason required" });
      }

      const [updated] = await db.update(schema.userProfiles)
        .set({
          fosterApprovalStatus: 'rejected',
          fosterApprovedBy: adminId,
          fosterApprovedAt: new Date(),
          fosterRejectionReason: reason,
        })
        .where(eq(schema.userProfiles.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Foster profile not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error rejecting foster:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // TRUST & SAFETY ELIGIBILITY ROUTES
  // ============================================

  // Get eligibility queue metrics (counts per status)
  app.get('/api/admin/eligibility-metrics', canReviewEligibility, async (req, res) => {
    try {
      const pendingCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.eligibilityStatus, 'pending_eligibility'));

      const eligibleCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.eligibilityStatus, 'eligible'));

      const ineligibleCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.eligibilityStatus, 'ineligible'));

      const escalatedCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.eligibilityStatus, 'escalated'));

      res.json({
        pending: pendingCount[0]?.count || 0,
        eligible: eligibleCount[0]?.count || 0,
        ineligible: ineligibleCount[0]?.count || 0,
        escalated: escalatedCount[0]?.count || 0,
      });
    } catch (error: any) {
      console.error("Error fetching eligibility metrics:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending eligibility reviews count (for notification badge)
  app.get('/api/admin/eligibility-reviews/pending/count', canReviewEligibility, async (req, res) => {
    try {
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.adoptionJourneys)
        .where(sql`${schema.adoptionJourneys.eligibilityStatus} IN ('pending_eligibility', 'escalated')`);

      res.json({ pending: result?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching pending eligibility count:", error);
      res.json({ pending: 0 });
    }
  });

  // Get pending approvals count (for notification badge)
  app.get('/api/admin/approvals/pending/count', isAdmin, async (req, res) => {
    try {
      const [dogResult] = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.dogs)
        .where(eq(schema.dogs.isApproved, false));

      res.json({ pending: dogResult?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching pending approvals count:", error);
      res.json({ pending: 0 });
    }
  });

  // Get pending compatibility flags count (for notification badge)
  app.get('/api/admin/compatibility-flags/pending/count', canReviewEligibility, async (req, res) => {
    try {
      const [result] = await db.select({ count: sql<number>`count(*)::int` })
        .from(schema.compatibilityFlags)
        .where(eq(schema.compatibilityFlags.status, 'pending'));

      res.json({ pending: result?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching pending flags count:", error);
      res.json({ pending: 0 });
    }
  });

  // Get eligibility queue (list of journeys with eligibility data)
  app.get('/api/admin/eligibility-queue', canReviewEligibility, async (req, res) => {
    try {
      const { status } = req.query;
      const statusFilter = status && typeof status === 'string' ? status : 'pending_eligibility';

      const journeys = await db.select({
        id: schema.adoptionJourneys.id,
        userId: schema.adoptionJourneys.userId,
        dogId: schema.adoptionJourneys.dogId,
        currentStep: schema.adoptionJourneys.currentStep,
        status: schema.adoptionJourneys.status,
        eligibilityStatus: schema.adoptionJourneys.eligibilityStatus,
        eligibilityNotes: schema.adoptionJourneys.eligibilityNotes,
        eligibilityReviewedBy: schema.adoptionJourneys.eligibilityReviewedBy,
        eligibilityReviewedAt: schema.adoptionJourneys.eligibilityReviewedAt,
        escalatedTo: schema.adoptionJourneys.escalatedTo,
        escalatedAt: schema.adoptionJourneys.escalatedAt,
        escalationReason: schema.adoptionJourneys.escalationReason,
        applicationSubmittedAt: schema.adoptionJourneys.applicationSubmittedAt,
        phoneScreeningStatus: schema.adoptionJourneys.phoneScreeningStatus,
        phoneScreeningCompletedAt: schema.adoptionJourneys.phoneScreeningCompletedAt,
        phoneScreeningSummary: schema.adoptionJourneys.phoneScreeningSummary,
        aiReviewScore: schema.adoptionJourneys.aiReviewScore,
        aiRecommendation: schema.adoptionJourneys.aiRecommendation,
        aiReviewSummary: schema.adoptionJourneys.aiReviewSummary,
        applicationResponses: schema.adoptionJourneys.applicationResponses,
        userFirstName: schema.users.firstName,
        userLastName: schema.users.lastName,
        userEmail: schema.users.email,
        userProfileImage: schema.users.profileImageUrl,
        dogName: schema.dogs.name,
        dogBreed: schema.dogs.breed,
        dogPhotos: schema.dogs.photos,
        shelterName: schema.dogs.shelterName,
      })
      .from(schema.adoptionJourneys)
      .innerJoin(schema.users, eq(schema.adoptionJourneys.userId, schema.users.id))
      .innerJoin(schema.dogs, eq(schema.adoptionJourneys.dogId, schema.dogs.id))
      .where(eq(schema.adoptionJourneys.eligibilityStatus, statusFilter))
      .orderBy(desc(schema.adoptionJourneys.applicationSubmittedAt));

      res.json(journeys);
    } catch (error: any) {
      console.error("Error fetching eligibility queue:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get detailed journey info for eligibility review
  app.get('/api/admin/eligibility-queue/:id', canReviewEligibility, async (req, res) => {
    try {
      const { id } = req.params;

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, id))
        .limit(1);

      if (!journey) {
        return res.status(404).json({ message: "Journey not found" });
      }

      // Get user details
      const user = await storage.getUser(journey.userId);
      const userProfile = await storage.getUserProfile(journey.userId);

      // Get dog details
      const dog = await storage.getDog(journey.dogId);

      // Get household pets
      const householdPets = await db.select()
        .from(schema.householdPets)
        .where(eq(schema.householdPets.userId, journey.userId));

      // Get family members
      const familyMembers = await db.select()
        .from(schema.familyMembers)
        .where(eq(schema.familyMembers.userId, journey.userId));

      // Get compatibility flags for this user+dog combo
      const compatibilityFlags = await db.select()
        .from(schema.profileCompatibilityFlags)
        .where(and(
          eq(schema.profileCompatibilityFlags.userId, journey.userId),
          eq(schema.profileCompatibilityFlags.relatedDogId, journey.dogId)
        ));

      // Get reviewer info if reviewed
      let reviewer = null;
      if (journey.eligibilityReviewedBy) {
        reviewer = await storage.getUser(journey.eligibilityReviewedBy);
      }

      // Get escalation admin if escalated
      let escalatedAdmin = null;
      if (journey.escalatedTo) {
        escalatedAdmin = await storage.getUser(journey.escalatedTo);
      }

      res.json({
        journey,
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          createdAt: user.createdAt,
        } : null,
        userProfile,
        dog,
        householdPets,
        familyMembers,
        compatibilityFlags,
        reviewer: reviewer ? {
          id: reviewer.id,
          firstName: reviewer.firstName,
          lastName: reviewer.lastName,
          email: reviewer.email,
        } : null,
        escalatedAdmin: escalatedAdmin ? {
          id: escalatedAdmin.id,
          firstName: escalatedAdmin.firstName,
          lastName: escalatedAdmin.lastName,
          email: escalatedAdmin.email,
        } : null,
      });
    } catch (error: any) {
      console.error("Error fetching journey details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mark application as eligible (T&S approval)
  app.patch('/api/admin/eligibility/:id/eligible', canReviewEligibility, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const reviewerId = req.user.id;

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          eligibilityStatus: 'eligible',
          eligibilityReviewedBy: reviewerId,
          eligibilityReviewedAt: new Date(),
          eligibilityNotes: notes || null,
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Journey not found" });
      }

      console.log(`[T&S] Journey ${id} marked eligible by ${reviewerId}`);
      res.json(updated);
    } catch (error: any) {
      console.error("Error marking eligible:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Mark application as ineligible (T&S rejection)
  app.patch('/api/admin/eligibility/:id/ineligible', canReviewEligibility, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { notes, reason } = req.body;
      const reviewerId = req.user.id;

      if (!reason && !notes) {
        return res.status(400).json({ message: "Reason or notes required for ineligibility" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          eligibilityStatus: 'ineligible',
          eligibilityReviewedBy: reviewerId,
          eligibilityReviewedAt: new Date(),
          eligibilityNotes: notes || reason,
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Journey not found" });
      }

      console.log(`[T&S] Journey ${id} marked ineligible by ${reviewerId}: ${notes || reason}`);
      res.json(updated);
    } catch (error: any) {
      console.error("Error marking ineligible:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Escalate to Platform Admin
  app.patch('/api/admin/eligibility/:id/escalate', canReviewEligibility, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reason, notes } = req.body;
      const reviewerId = req.user.id;

      if (!reason) {
        return res.status(400).json({ message: "Escalation reason required" });
      }

      // Get the first platform admin to assign to
      const [platformAdmin] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.adminRole, 'platform_admin'))
        .limit(1);

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          eligibilityStatus: 'escalated',
          eligibilityReviewedBy: reviewerId,
          eligibilityReviewedAt: new Date(),
          eligibilityNotes: notes || null,
          escalatedTo: platformAdmin?.id || null,
          escalatedAt: new Date(),
          escalationReason: reason,
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Journey not found" });
      }

      console.log(`[T&S] Journey ${id} escalated to Platform Admin by ${reviewerId}: ${reason}`);
      res.json(updated);
    } catch (error: any) {
      console.error("Error escalating:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Platform Admin override for escalated cases
  app.patch('/api/admin/eligibility/:id/override', isPlatformAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { decision, notes } = req.body; // decision: 'eligible' | 'ineligible'
      const adminId = req.user.id;

      if (!decision || !['eligible', 'ineligible'].includes(decision)) {
        return res.status(400).json({ message: "Valid decision required: 'eligible' or 'ineligible'" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          eligibilityStatus: decision,
          eligibilityReviewedBy: adminId,
          eligibilityReviewedAt: new Date(),
          eligibilityNotes: `[Platform Admin Override] ${notes || 'No additional notes'}`,
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Journey not found" });
      }

      console.log(`[Platform Admin] Journey ${id} override to ${decision} by ${adminId}`);
      res.json(updated);
    } catch (error: any) {
      console.error("Error overriding:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all users (for user management)
  app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get detailed user info (for admin user profile view)
  app.get('/api/admin/users/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      // Get user
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user profile
      const userProfile = await storage.getUserProfile(id);

      // Get family members
      const familyMembers = await db.select()
        .from(schema.familyMembers)
        .where(eq(schema.familyMembers.userId, id));

      // Get household pets
      const householdPets = await db.select()
        .from(schema.householdPets)
        .where(eq(schema.householdPets.userId, id));

      // Get verification status
      const [verification] = await db.select()
        .from(schema.adopterVerifications)
        .where(eq(schema.adopterVerifications.userId, id))
        .limit(1);

      // Get user's dogs (for shelters and rehomers)
      const dogs = await storage.getUserDogs(id);

      // Get intake records for dogs to show pipeline status
      const intakeRecords = await storage.getIntakeRecords(id);
      const intakeByDog = new Map(intakeRecords.map(r => [r.dogId, r]));

      // Enrich dogs with intake status
      const dogsWithStatus = dogs.map(dog => ({
        ...dog,
        intakeRecord: intakeByDog.get(dog.id) || null,
      }));

      // Set cache control to prevent stale data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json({
        ...user,
        userProfile,
        familyMembers,
        householdPets,
        verification,
        dogs: dogsWithStatus,
      });
    } catch (error: any) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Suspend/activate user
  app.patch('/api/admin/users/:id/status', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      const user = await storage.updateUserActiveStatus(id, isActive);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error: any) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // ADOPTION REQUIREMENTS ROUTES
  // ============================================

  // Get adoption requirements (admin)
  app.get('/api/admin/adoption-requirements', isAdmin, async (req, res) => {
    try {
      let requirements = await storage.getAdoptionRequirements();

      // If no requirements exist, return defaults
      if (!requirements) {
        requirements = {
          requireCompletedProfile: true,
          requirePhoneNumber: true,
          requireProfilePhoto: false,
          requireIdVerification: false,
          requireBackgroundCheck: false,
          requireHomePhotos: false,
          requirePetPolicyVerification: false,
          requirementsMessage: null,
        };
      }

      res.json(requirements);
    } catch (error: any) {
      console.error("Error fetching adoption requirements:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update adoption requirements (admin)
  app.put('/api/admin/adoption-requirements', isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const requirements = await storage.updateAdoptionRequirements(req.body, adminId);
      res.json(requirements);
    } catch (error: any) {
      console.error("Error updating adoption requirements:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get adoption requirements (public - for frontend to check)
  app.get('/api/adoption-requirements', async (req, res) => {
    try {
      let requirements = await storage.getAdoptionRequirements();

      // If no requirements exist, return defaults
      if (!requirements) {
        requirements = {
          requireCompletedProfile: true,
          requirePhoneNumber: true,
          requireProfilePhoto: false,
          requireIdVerification: false,
          requireBackgroundCheck: false,
          requireHomePhotos: false,
          requirePetPolicyVerification: false,
          requirementsMessage: null,
        };
      }

      res.json(requirements);
    } catch (error: any) {
      console.error("Error fetching adoption requirements:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // ADMIN PLATFORM SETTINGS ROUTES
  // ============================================

  // Admin: Get all animal type settings
  app.get('/api/admin/animal-types', isAdmin, async (req, res) => {
    try {
      const setting = await db.select()
        .from(schema.platformSettings)
        .where(eq(schema.platformSettings.settingKey, 'animal_types'))
        .limit(1);

      if (setting.length === 0) {
        // Return default settings
        const defaults = schema.ANIMAL_TYPES.map(t => ({ id: t.id, enabled: t.enabled }));
        return res.json(defaults);
      }

      res.json(setting[0].settingValue);
    } catch (error: any) {
      console.error("Error fetching animal types:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update animal types settings
  app.put('/api/admin/animal-types', isAdmin, async (req: any, res) => {
    try {
      const adminId = req.user.id;
      const animalTypes = req.body;

      // Upsert the setting
      const existing = await db.select()
        .from(schema.platformSettings)
        .where(eq(schema.platformSettings.settingKey, 'animal_types'))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(schema.platformSettings).values({
          settingKey: 'animal_types',
          settingValue: animalTypes,
          description: 'Enabled animal types on the platform',
          updatedBy: adminId,
        });
      } else {
        await db.update(schema.platformSettings)
          .set({ 
            settingValue: animalTypes, 
            updatedAt: new Date(),
            updatedBy: adminId 
          })
          .where(eq(schema.platformSettings.settingKey, 'animal_types'));
      }

      res.json(animalTypes);
    } catch (error: any) {
      console.error("Error updating animal types:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get enabled animal types (public endpoint)
  app.get('/api/animal-types', async (req, res) => {
    try {
      const setting = await db.select()
        .from(schema.platformSettings)
        .where(eq(schema.platformSettings.settingKey, 'animal_types'))
        .limit(1);

      if (setting.length === 0) {
        // Return default settings (only dogs enabled) with id and label
        const defaults = schema.ANIMAL_TYPES
          .filter(t => t.enabled)
          .map(t => ({ id: t.id, label: t.label }));
        return res.json(defaults);
      }

      // Get enabled type IDs from settings, then map to include labels
      const storedTypes = setting[0].settingValue as { id: string; enabled: boolean }[];
      const enabledTypes = storedTypes
        .filter(t => t.enabled)
        .map(t => {
          const fullType = schema.ANIMAL_TYPES.find(at => at.id === t.id);
          return { id: t.id, label: fullType?.label || t.id };
        });
      res.json(enabledTypes);
    } catch (error: any) {
      console.error("Error fetching animal types:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // ADMIN CONTENT MANAGEMENT ROUTES
  // ============================================

  // --- Application Questions ---
  app.get('/api/admin/application-questions', isAdmin, async (req, res) => {
    try {
      const questions = await storage.getApplicationQuestions();
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching application questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/application-questions/:id', isAdmin, async (req, res) => {
    try {
      const question = await storage.getApplicationQuestion(req.params.id);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json(question);
    } catch (error: any) {
      console.error("Error fetching application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/application-questions', isAdmin, async (req: any, res) => {
    try {
      const question = await storage.createApplicationQuestion({
        ...req.body,
        updatedBy: req.user.id,
      });
      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/admin/application-questions/:id', isAdmin, async (req: any, res) => {
    try {
      const question = await storage.updateApplicationQuestion(req.params.id, {
        ...req.body,
        updatedBy: req.user.id,
      });
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json(question);
    } catch (error: any) {
      console.error("Error updating application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/admin/application-questions/:id', isAdmin, async (req, res) => {
    try {
      await storage.deleteApplicationQuestion(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/application-questions/reorder', isAdmin, async (req, res) => {
    try {
      const { questionIds } = req.body;
      if (!Array.isArray(questionIds)) {
        return res.status(400).json({ message: "questionIds must be an array" });
      }
      await storage.reorderApplicationQuestions(questionIds);
      res.status(200).json({ message: "Questions reordered successfully" });
    } catch (error: any) {
      console.error("Error reordering application questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // --- Phone Screening Questions ---
  app.get('/api/admin/phone-screening-questions', isAdmin, async (req, res) => {
    try {
      const scenario = req.query.scenario as string | undefined;
      const questions = await storage.getPhoneScreeningQuestions(scenario);
      res.json(questions);
    } catch (error: any) {
      console.error("Error fetching phone screening questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/phone-screening-questions/:id', isAdmin, async (req, res) => {
    try {
      const question = await storage.getPhoneScreeningQuestion(req.params.id);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json(question);
    } catch (error: any) {
      console.error("Error fetching phone screening question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/phone-screening-questions', isAdmin, async (req: any, res) => {
    try {
      const question = await storage.createPhoneScreeningQuestion({
        ...req.body,
        updatedBy: req.user.id,
      });
      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating phone screening question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/admin/phone-screening-questions/:id', isAdmin, async (req: any, res) => {
    try {
      const question = await storage.updatePhoneScreeningQuestion(req.params.id, {
        ...req.body,
        updatedBy: req.user.id,
      });
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      res.json(question);
    } catch (error: any) {
      console.error("Error updating phone screening question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/admin/phone-screening-questions/:id', isAdmin, async (req, res) => {
    try {
      await storage.deletePhoneScreeningQuestion(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting phone screening question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/phone-screening-questions/reorder', isAdmin, async (req, res) => {
    try {
      const { questionIds } = req.body;
      if (!Array.isArray(questionIds)) {
        return res.status(400).json({ message: "questionIds must be an array" });
      }
      await storage.reorderPhoneScreeningQuestions(questionIds);
      res.status(200).json({ message: "Questions reordered successfully" });
    } catch (error: any) {
      console.error("Error reordering phone screening questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // --- Vapi Knowledge Base ---
  app.get('/api/admin/vapi-knowledge-base', isAdmin, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const entries = await storage.getVapiKnowledgeBaseEntries(category);
      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching vapi knowledge base:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/vapi-knowledge-base/:id', isAdmin, async (req, res) => {
    try {
      const entry = await storage.getVapiKnowledgeBaseEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(entry);
    } catch (error: any) {
      console.error("Error fetching vapi knowledge base entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/admin/vapi-knowledge-base', isAdmin, async (req: any, res) => {
    try {
      const entry = await storage.createVapiKnowledgeBaseEntry({
        ...req.body,
        updatedBy: req.user.id,
      });
      res.status(201).json(entry);
    } catch (error: any) {
      console.error("Error creating vapi knowledge base entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/admin/vapi-knowledge-base/:id', isAdmin, async (req: any, res) => {
    try {
      const entry = await storage.updateVapiKnowledgeBaseEntry(req.params.id, {
        ...req.body,
        updatedBy: req.user.id,
      });
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(entry);
    } catch (error: any) {
      console.error("Error updating vapi knowledge base entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/admin/vapi-knowledge-base/:id', isAdmin, async (req, res) => {
    try {
      await storage.deleteVapiKnowledgeBaseEntry(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting vapi knowledge base entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/admin/vapi-knowledge-base/:id/publish', isAdmin, async (req, res) => {
    try {
      const { isPublished } = req.body;
      if (typeof isPublished !== 'boolean') {
        return res.status(400).json({ message: "isPublished must be a boolean" });
      }
      const entry = await storage.publishVapiKnowledgeBaseEntry(req.params.id, isPublished);
      if (!entry) {
        return res.status(404).json({ message: "Entry not found" });
      }
      res.json(entry);
    } catch (error: any) {
      console.error("Error publishing vapi knowledge base entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint for published knowledge base (for Vapi AI use)
  app.get('/api/vapi-knowledge-base', async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      const entries = await storage.getVapiKnowledgeBaseEntries(category, true);
      res.json(entries);
    } catch (error: any) {
      console.error("Error fetching published vapi knowledge base:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // VAPI DASHBOARD ROUTES
  // ============================================

  // Admin: Get all Vapi call logs (phone screenings + consultations)
  app.get('/api/admin/vapi/call-logs', isAdmin, async (req, res) => {
    try {
      const { type, status, limit = '50', offset = '0' } = req.query;
      const callLogs = await storage.getVapiCallLogs({
        type: type as string | undefined,
        status: status as string | undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
      res.json(callLogs);
    } catch (error: any) {
      console.error("Error fetching Vapi call logs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get Vapi dashboard stats
  app.get('/api/admin/vapi/stats', isAdmin, async (req, res) => {
    try {
      const stats = await storage.getVapiDashboardStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching Vapi stats:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Sync call statuses from Vapi API
  app.post('/api/admin/vapi/sync-calls', isAdmin, async (req, res) => {
    try {
      const { syncVapiCallStatuses } = await import('./vapi');
      const result = await syncVapiCallStatuses();
      res.json(result);
    } catch (error: any) {
      console.error("Error syncing Vapi call statuses:", error);
      res.status(500).json({ message: error.message || "Failed to sync Vapi call statuses" });
    }
  });

  // Public endpoint for application questions (for forms)
  app.get('/api/application-questions', async (req, res) => {
    try {
      const mode = req.query.mode as string | undefined;
      const questions = await storage.getApplicationQuestions(mode || 'all');
      // Only return active questions
      const activeQuestions = questions.filter(q => q.isActive);
      res.json(activeQuestions);
    } catch (error: any) {
      console.error("Error fetching application questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to get shelter-specific application questions for a dog
  app.get('/api/dogs/:dogId/application-questions', async (req, res) => {
    try {
      const { dogId } = req.params;
      const mode = req.query.mode as string | undefined;
      
      // Get the dog to find its shelter
      const dog = await storage.getDog(dogId);
      if (!dog) {
        return res.status(404).json({ message: "Dog not found" });
      }
      
      // Get standard admin questions
      const standardQuestions = await storage.getApplicationQuestions(mode || 'adopt');
      const activeStandardQuestions = standardQuestions.filter(q => q.isActive);
      
      // Get shelter-specific questions if the dog belongs to a shelter
      let shelterQuestions: any[] = [];
      let shelterForm = null;
      
      if (dog.shelterId) {
        shelterForm = await storage.getShelterApplicationForm(dog.shelterId);
        if (shelterForm) {
          const questions = await storage.getShelterApplicationQuestions(shelterForm.id);
          shelterQuestions = questions.filter(q => q.isActive);
        }
      }
      
      res.json({
        standardQuestions: activeStandardQuestions,
        shelterQuestions: shelterQuestions,
        shelterForm: shelterForm,
        shelterId: dog.shelterId,
        shelterName: dog.shelterName,
      });
    } catch (error: any) {
      console.error("Error fetching dog application questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // FEATURE FLAGS ROUTES
  // ============================================

  // Public: Get all enabled feature flags (for frontend)
  app.get('/api/features', async (req, res) => {
    try {
      const flags = await storage.getEnabledFeatureFlags();
      // Return just the keys for efficiency
      const enabledKeys = flags.map(f => f.key);
      res.json({ enabledFeatures: enabledKeys });
    } catch (error: any) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get all feature flags with full details
  app.get('/api/admin/features', isAdmin, async (req, res) => {
    try {
      const flags = await storage.getAllFeatureFlags();
      res.json(flags);
    } catch (error: any) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update a feature flag
  app.put('/api/admin/features/:key', isAdmin, async (req, res) => {
    try {
      const { isEnabled } = req.body;
      const user = req.user as User;
      const flag = await storage.updateFeatureFlag(req.params.key, isEnabled, user?.id);
      if (!flag) {
        return res.status(404).json({ message: "Feature flag not found" });
      }
      res.json(flag);
    } catch (error: any) {
      console.error("Error updating feature flag:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Seed feature flags (initialize defaults)
  app.post('/api/admin/features/seed', isAdmin, async (req, res) => {
    try {
      await storage.seedFeatureFlags();
      const flags = await storage.getAllFeatureFlags();
      res.json({ message: "Feature flags seeded successfully", flags });
    } catch (error: any) {
      console.error("Error seeding feature flags:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // PLUGIN CONTROL ROUTES
  // ============================================

  // Admin: Get health screening plugin status
  app.get('/api/admin/plugins/health-screening/status', isAdmin, async (req, res) => {
    try {
      const featureFlag = await storage.getFeatureFlag('ai_health_screening');
      res.json({
        pluginEnabled: isPluginEnabled(),
        featureFlagEnabled: featureFlag?.isEnabled ?? false,
        pluginName: 'health-screening',
        description: 'AI-powered health screening for shelter dogs',
      });
    } catch (error: any) {
      console.error("Error fetching plugin status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Toggle health screening plugin
  app.post('/api/admin/plugins/health-screening/toggle', isAdmin, async (req: any, res) => {
    try {
      const { enabled } = req.body;
      const userId = req.user?.id;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "enabled (boolean) is required" });
      }

      if (enabled) {
        enablePlugin();
        console.log(`[Plugin Control] Health screening plugin ENABLED by admin ${userId}`);
      } else {
        disablePlugin();
        console.log(`[Plugin Control] Health screening plugin DISABLED by admin ${userId}`);
      }

      // Also update the feature flag to persist the change
      const updatedFlag = await storage.updateFeatureFlag('ai_health_screening', enabled, userId);
      
      if (!updatedFlag) {
        // Feature flag doesn't exist - plugin state changed but won't persist across restarts
        console.warn(`[Plugin Control] Feature flag 'ai_health_screening' not found - plugin state not persisted`);
      }

      res.json({
        success: true,
        pluginEnabled: isPluginEnabled(),
        flagPersisted: !!updatedFlag,
        message: enabled ? 'Health screening plugin enabled' : 'Health screening plugin disabled',
      });
    } catch (error: any) {
      console.error("Error toggling plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get automations plugin status
  app.get('/api/admin/plugins/automations/status', isAdmin, async (req, res) => {
    try {
      const featureFlag = await storage.getFeatureFlag('automations_engine');
      res.json({
        pluginEnabled: isAutomationsPluginEnabled(),
        featureFlagEnabled: featureFlag?.isEnabled ?? false,
        pluginName: 'automations-engine',
        description: 'Rule-based task automation triggered by events like intake, status changes, and applications',
      });
    } catch (error: any) {
      console.error("Error fetching automations plugin status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Toggle automations plugin
  app.post('/api/admin/plugins/automations/toggle', isAdmin, async (req: any, res) => {
    try {
      const { enabled } = req.body;
      const userId = req.user?.id;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "enabled (boolean) is required" });
      }

      if (enabled) {
        enableAutomationsPlugin();
        console.log(`[Plugin Control] Automations plugin ENABLED by admin ${userId}`);
      } else {
        disableAutomationsPlugin();
        console.log(`[Plugin Control] Automations plugin DISABLED by admin ${userId}`);
      }

      // Also update the feature flag to persist the change
      const updatedFlag = await storage.updateFeatureFlag('automations_engine', enabled, userId);
      
      if (!updatedFlag) {
        console.warn(`[Plugin Control] Feature flag 'automations_engine' not found - plugin state not persisted`);
      }

      res.json({
        success: true,
        pluginEnabled: isAutomationsPluginEnabled(),
        flagPersisted: !!updatedFlag,
        message: enabled ? 'Automations plugin enabled' : 'Automations plugin disabled',
      });
    } catch (error: any) {
      console.error("Error toggling automations plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // MARKETING / ADVERTISERSROUTES
  // ============================================

  // Admin: Get all advertisers
  app.get('/api/admin/advertisers', isAdmin, async (req, res) => {
    try {
      const advertisers = await storage.getAllAdvertisers();
      res.json(advertisers);
    } catch (error: any) {
      console.error("Error fetching advertisers:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get single advertiser
  app.get('/api/admin/advertisers/:id', isAdmin, async (req, res) => {
    try {
      const advertiser = await storage.getAdvertiser(req.params.id);
      if (!advertiser) {
        return res.status(404).json({ message: "Advertiser not found" });
      }
      res.json(advertiser);
    } catch (error: any) {
      console.error("Error fetching advertiser:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Create advertiser
  app.post('/api/admin/advertisers', isAdmin, async (req, res) => {
    try {
      const advertiser = await storage.createAdvertiser(req.body);
      res.status(201).json(advertiser);
    } catch (error: any) {
      console.error("Error creating advertiser:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update advertiser
  app.put('/api/admin/advertisers/:id', isAdmin, async (req, res) => {
    try {
      const advertiser = await storage.updateAdvertiser(req.params.id, req.body);
      if (!advertiser) {
        return res.status(404).json({ message: "Advertiser not found" });
      }
      res.json(advertiser);
    } catch (error: any) {
      console.error("Error updating advertiser:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Delete advertiser
  app.delete('/api/admin/advertisers/:id', isAdmin, async (req, res) => {
    try {
      await storage.deleteAdvertiser(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting advertiser:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get advertiser locations
  app.get('/api/admin/advertisers/:advertiserId/locations', isAdmin, async (req, res) => {
    try {
      const locations = await storage.getAdvertiserLocations(req.params.advertiserId);
      res.json(locations);
    } catch (error: any) {
      console.error("Error fetching advertiser locations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Create advertiser location
  app.post('/api/admin/advertisers/:advertiserId/locations', isAdmin, async (req, res) => {
    try {
      const location = await storage.createAdvertiserLocation({
        ...req.body,
        advertiserId: req.params.advertiserId,
      });
      res.status(201).json(location);
    } catch (error: any) {
      console.error("Error creating advertiser location:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get single advertiser location
  app.get('/api/admin/advertiser-locations/:id', isAdmin, async (req, res) => {
    try {
      const location = await storage.getAdvertiserLocation(req.params.id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error: any) {
      console.error("Error fetching advertiser location:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update advertiser location
  app.put('/api/admin/advertiser-locations/:id', isAdmin, async (req, res) => {
    try {
      const location = await storage.updateAdvertiserLocation(req.params.id, req.body);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      res.json(location);
    } catch (error: any) {
      console.error("Error updating advertiser location:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Delete advertiser location
  app.delete('/api/admin/advertiser-locations/:id', isAdmin, async (req, res) => {
    try {
      await storage.deleteAdvertiserLocation(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting advertiser location:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Get all active advertiser locations for map display
  app.get('/api/map/advertisers', async (req, res) => {
    try {
      const locations = await storage.getAllActiveAdvertiserLocations();
      res.json(locations);
    } catch (error: any) {
      console.error("Error fetching advertiser locations for map:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // ADMIN ADOPTION APPLICATIONSROUTES
  // ============================================

  // Get all adoption journeys for admin review
  // Only shows platform-owned dogs (those without a shelterId)
  // Shelter-managed dogs are handled by shelters via /api/shelter/applications
  app.get('/api/admin/adoption-journeys', isAdmin, async (req, res) => {
    try {
      // Fetch all adoption journeys with dog and user details
      const journeys = await db.select().from(schema.adoptionJourneys);

      // Enrich with dog and user details, filtering out shelter-managed dogs
      const enrichedJourneys = await Promise.all(
        journeys.map(async (journey) => {
          const [dog] = await db.select().from(schema.dogs).where(eq(schema.dogs.id, journey.dogId));
          
          // Skip shelter-managed dogs - those are handled by the shelter CRM
          if (dog && dog.shelterId) {
            return null;
          }
          
          const [user] = await db.select().from(schema.users).where(eq(schema.users.id, journey.userId));
          const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, journey.userId));

          return {
            ...journey,
            dog: dog ? { id: dog.id, name: dog.name, breed: dog.breed, photos: dog.photos } : null,
            user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email } : null,
            userProfile: profile || null, // Return full profile so admin always sees current user data
          };
        })
      );

      // Filter out null entries (shelter-managed dogs)
      const filteredJourneys = enrichedJourneys.filter(j => j !== null);

      // Prevent caching to ensure admin always sees current user profile data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.json(filteredJourneys);
    } catch (error: any) {
      console.error("Error fetching admin adoption journeys:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single adoption journey details for admin review
  // Only allows viewing platform-owned dogs (those without a shelterId)
  app.get('/api/admin/adoption-journeys/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const [journey] = await db.select().from(schema.adoptionJourneys).where(eq(schema.adoptionJourneys.id, id));

      if (!journey) {
        return res.status(404).json({ message: "Adoption journey not found" });
      }

      const [dog] = await db.select().from(schema.dogs).where(eq(schema.dogs.id, journey.dogId));
      
      // Block admin access to shelter-managed dogs
      if (dog && dog.shelterId) {
        return res.status(403).json({ message: "This application is managed by the shelter, not admin" });
      }
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, journey.userId));
      const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, journey.userId));

      // Fetch related user data for complete profile view (matching user's profile page)
      const familyMembers = await db.select().from(schema.familyMembers).where(eq(schema.familyMembers.userId, journey.userId));
      const householdPets = await db.select().from(schema.householdPets).where(eq(schema.householdPets.userId, journey.userId));
      const [verification] = await db.select().from(schema.adopterVerifications).where(eq(schema.adopterVerifications.userId, journey.userId));

      // Get application questions to map responses
      const questions = await storage.getApplicationQuestions('all');

      // Prevent caching to ensure admin always sees current user profile data
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.json({
        ...journey,
        dog: dog ? { id: dog.id, name: dog.name, breed: dog.breed, photos: dog.photos, age: dog.age, size: dog.size } : null,
        user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email } : null,
        userProfile: profile || null,
        familyMembers: familyMembers || [],
        householdPets: householdPets || [],
        verification: verification || null,
        applicationQuestions: questions,
      });
    } catch (error: any) {
      console.error("Error fetching adoption journey details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve adoption application (admin only for platform-owned dogs)
  app.patch('/api/admin/adoption-journeys/:id/approve', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const { notes } = req.body;

      const [journey] = await db.select().from(schema.adoptionJourneys).where(eq(schema.adoptionJourneys.id, id));

      if (!journey) {
        return res.status(404).json({ message: "Adoption journey not found" });
      }

      // Block admin approval for shelter-managed dogs
      const [dog] = await db.select().from(schema.dogs).where(eq(schema.dogs.id, journey.dogId));
      if (dog && dog.shelterId) {
        return res.status(403).json({ message: "This application is managed by the shelter, not admin" });
      }

      // Update journey to approved - currentStep already set to phone_screening when application was submitted
      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          status: "approved",
          approvedAt: new Date(),
          approvedBy: adminId,
          adminNotes: notes || journey.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error approving adoption journey:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve transcript review and move to Meet & Greet (admin only for platform-owned dogs)
  app.patch('/api/admin/adoption-journeys/:id/approve-transcript', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const { notes } = req.body;

      const [journey] = await db.select().from(schema.adoptionJourneys).where(eq(schema.adoptionJourneys.id, id));

      if (!journey) {
        return res.status(404).json({ message: "Adoption journey not found" });
      }

      // Block admin transcript approval for shelter-managed dogs
      const [dog] = await db.select().from(schema.dogs).where(eq(schema.dogs.id, journey.dogId));
      if (dog && dog.shelterId) {
        return res.status(403).json({ message: "This application is managed by the shelter, not admin" });
      }

      // Check that phone screening is awaiting review
      if (journey.phoneScreeningStatus !== "awaiting_review") {
        return res.status(400).json({ message: "Phone screening is not awaiting review" });
      }

      // Approve transcript - set phoneScreeningStatus to "approved" and move to meet_greet
      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          phoneScreeningStatus: "approved",
          currentStep: "meet_greet",
          adminNotes: notes ? (journey.adminNotes ? `${journey.adminNotes}\n\n[Transcript Review]: ${notes}` : `[Transcript Review]: ${notes}`) : journey.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error approving transcript:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reject adoption application (admin only for platform-owned dogs)
  app.patch('/api/admin/adoption-journeys/:id/reject', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const { reason, notes } = req.body;

      const [journey] = await db.select().from(schema.adoptionJourneys).where(eq(schema.adoptionJourneys.id, id));

      if (!journey) {
        return res.status(404).json({ message: "Adoption journey not found" });
      }

      // Block admin rejection for shelter-managed dogs
      const [dog] = await db.select().from(schema.dogs).where(eq(schema.dogs.id, journey.dogId));
      if (dog && dog.shelterId) {
        return res.status(403).json({ message: "This application is managed by the shelter, not admin" });
      }

      // Update journey to rejected
      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          status: "rejected",
          rejectedAt: new Date(),
          rejectedBy: adminId,
          rejectionReason: reason || null,
          adminNotes: notes || journey.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error rejecting adoption journey:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Block adoption application (admin intervention for concerning cases)
  app.patch('/api/admin/adoption-journeys/:id/block', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.id;
      const { reason, notes } = req.body;

      if (!reason || reason.trim() === '') {
        return res.status(400).json({ message: "Block reason is required" });
      }

      const [journey] = await db.select().from(schema.adoptionJourneys).where(eq(schema.adoptionJourneys.id, id));

      if (!journey) {
        return res.status(404).json({ message: "Adoption journey not found" });
      }

      // Update journey to blocked status
      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          status: "blocked",
          rejectedAt: new Date(),
          rejectedBy: adminId,
          rejectionReason: `BLOCKED: ${reason}`,
          adminNotes: notes || journey.adminNotes,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error blocking adoption journey:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update admin notes for adoption journey
  app.patch('/api/admin/adoption-journeys/:id/notes', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      const [journey] = await db.select().from(schema.adoptionJourneys).where(eq(schema.adoptionJourneys.id, id));

      if (!journey) {
        return res.status(404).json({ message: "Adoption journey not found" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          adminNotes: notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating admin notes:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // ADMIN DIAGNOSTICS ROUTES
  // ============================================

  // Route test configuration - key endpoints to monitor
  const ROUTE_TESTS: schema.RouteTestConfig[] = [
    {
      id: "auth-me",
      label: "Auth: Current user check",
      category: "Auth",
      route: "/api/me",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "dogs-all",
      label: "Dogs: Get all dogs",
      category: "Dogs",
      route: "/api/dogs",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "shelters-list",
      label: "Shelters: Get all shelters",
      category: "Shelters",
      route: "/api/shelters",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "admin-metrics",
      label: "Admin: Dashboard metrics",
      category: "Admin",
      route: "/api/admin/metrics",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "admin-users",
      label: "Admin: User list",
      category: "Admin",
      route: "/api/admin/users",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "map-dogs",
      label: "Map: Dogs for map display",
      category: "Map",
      route: "/api/map/dogs",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "shelter-intake",
      label: "Shelter CRM: Intake records",
      category: "Shelter CRM",
      route: "/api/shelter/intake-records",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-tasks",
      label: "Shelter CRM: Task list",
      category: "Shelter CRM",
      route: "/api/shelter/tasks",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "application-questions",
      label: "Content: Application questions",
      category: "Content",
      route: "/api/admin/application-questions",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "knowledge-base",
      label: "AI: Knowledge base entries",
      category: "AI",
      route: "/api/admin/vapi-knowledge-base",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "database-health",
      label: "Database: Connection health",
      category: "Database",
      route: "/api/admin/diagnostics/db-health",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "conversations-list",
      label: "Messaging: Conversations list",
      category: "Messaging",
      route: "/api/conversations",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "scout-chat-get",
      label: "Messaging: Scout AI chat history",
      category: "Messaging",
      route: "/api/chat",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "chat-context",
      label: "Messaging: Chat context loader",
      category: "Messaging",
      route: "/api/chat/context",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "adoption-journeys",
      label: "Adoption: All journeys (admin)",
      category: "Adoption",
      route: "/api/adoption-journeys",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "my-adoption-journeys",
      label: "Adoption: User's own journeys",
      category: "Adoption",
      route: "/api/my-adoption-journeys",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "adoption-applications",
      label: "Adoption: Applications list",
      category: "Adoption",
      route: "/api/adoption-applications",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "phone-screening-config",
      label: "Adoption: Phone screening config",
      category: "Adoption",
      route: "/api/admin/phone-screening-config",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "liked-dogs",
      label: "Adoption: Liked/saved dogs",
      category: "Adoption",
      route: "/api/dogs/liked",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "user-profile",
      label: "User: Profile data",
      category: "User",
      route: "/api/user-profile",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "swipes-history",
      label: "User: Swipe history",
      category: "User",
      route: "/api/swipes",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "shelter-applications",
      label: "Shelter CRM: Applications queue",
      category: "Shelter CRM",
      route: "/api/shelter/applications",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-profile",
      label: "Shelter CRM: Profile data",
      category: "Shelter CRM",
      route: "/api/shelter/profile",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-dogs",
      label: "Shelter CRM: Dogs list",
      category: "Shelter CRM",
      route: "/api/shelter/dogs",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-dashboard",
      label: "Shelter CRM: Dashboard stats",
      category: "Shelter CRM",
      route: "/api/shelter/dashboard",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-intake-list",
      label: "Shelter CRM: Intake pipeline",
      category: "Shelter CRM",
      route: "/api/shelter/intake",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-conversations",
      label: "Shelter CRM: Conversations inbox",
      category: "Shelter CRM",
      route: "/api/shelter/conversations",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-unread-count",
      label: "Shelter CRM: Unread message count",
      category: "Shelter CRM",
      route: "/api/shelter/conversations/unread/count",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-resources",
      label: "Shelter CRM: Resources",
      category: "Shelter CRM",
      route: "/api/shelter/resources",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-vaccines-upcoming",
      label: "Shelter CRM: Upcoming vaccines",
      category: "Shelter CRM",
      route: "/api/shelter/medical/vaccines/upcoming",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-bulk-templates-dogs",
      label: "Shelter CRM: Bulk import dog template",
      category: "Shelter CRM",
      route: "/api/shelter/bulk/templates/dogs",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-bulk-templates-medical",
      label: "Shelter CRM: Bulk import medical template",
      category: "Shelter CRM",
      route: "/api/shelter/bulk/templates/medical",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-templates",
      label: "Shelter CRM: Message templates",
      category: "Shelter CRM",
      route: "/api/shelter/templates",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-bulk-recipients",
      label: "Shelter CRM: Bulk message recipients",
      category: "Shelter CRM",
      route: "/api/shelter/bulk/recipients",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelter-bulk-history",
      label: "Shelter CRM: Bulk operation history",
      category: "Shelter CRM",
      route: "/api/shelter/bulk/history",
      method: "GET",
      expectedStatus: 200,
      requiresShelterProfile: true
    },
    {
      id: "shelters-public-list",
      label: "Shelter: Public shelters list",
      category: "Shelter CRM",
      route: "/api/shelters",
      method: "GET",
      expectedStatus: 200
    },
    {
      id: "map-shelters",
      label: "Shelter: Map markers",
      category: "Shelter CRM",
      route: "/api/map/shelters",
      method: "GET",
      expectedStatus: 200
    }
  ];

  // Helper function to run a single route test
  async function runRouteTest(
    config: schema.RouteTestConfig,
    baseUrl: string,
    cookies?: string
  ): Promise<schema.DiagnosticResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const response = await fetch(`${baseUrl}${config.route}`, {
        method: config.method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookies ? { 'Cookie': cookies } : {}),
        },
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      const durationMs = Date.now() - startTime;
      const expectedStatus = config.expectedStatus || 200;
      const passed = response.status === expectedStatus;
      const slow = durationMs > 1000;

      // Handle shelter profile routes - if they return 403/404, mark as SKIP instead of FAIL
      // These routes require a shelter profile which the admin user doesn't have
      if (config.requiresShelterProfile && (response.status === 403 || response.status === 404)) {
        return {
          id: config.id,
          label: config.label,
          category: config.category,
          route: config.route,
          method: config.method,
          status: "SKIP",
          statusCode: response.status,
          durationMs,
          message: "Requires shelter profile (not available for admin user)",
          timestamp,
        };
      }

      return {
        id: config.id,
        label: config.label,
        category: config.category,
        route: config.route,
        method: config.method,
        status: passed ? (slow ? "WARN" : "PASS") : "FAIL",
        statusCode: response.status,
        durationMs,
        message: passed
          ? (slow ? `Passed but slow (${durationMs}ms)` : `OK - ${response.status}`)
          : `Expected ${expectedStatus}, got ${response.status}`,
        timestamp,
      };
    } catch (error: any) {
      return {
        id: config.id,
        label: config.label,
        category: config.category,
        route: config.route,
        method: config.method,
        status: "FAIL",
        durationMs: Date.now() - startTime,
        message: "Request failed",
        timestamp,
        error: error.message || "Unknown error",
      };
    }
  }

  // Lightweight health check
  app.get('/api/admin/diagnostics/health', isAdmin, async (req, res) => {
    res.json({
      status: "OK",
      app: "Scout Admin Diagnostics",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Database health check endpoint
  app.get('/api/admin/diagnostics/db-health', isAdmin, async (req, res) => {
    const startTime = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      res.json({
        status: "OK",
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        status: "ERROR",
        error: error.message,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Get list of available route tests
  app.get('/api/admin/diagnostics/routes', isAdmin, async (req, res) => {
    res.json(ROUTE_TESTS);
  });

  // Run all diagnostic tests
  app.post('/api/admin/diagnostics/run-all', isAdmin, async (req: any, res) => {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    // Get the base URL from the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Forward cookies for authenticated routes
    const cookies = req.headers.cookie;

    // Run all tests in parallel
    const results = await Promise.all(
      ROUTE_TESTS.map(config => runRouteTest(config, baseUrl, cookies))
    );

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    const summary: schema.RunAllSummary = {
      total: results.length,
      passed: results.filter(r => r.status === "PASS").length,
      failed: results.filter(r => r.status === "FAIL").length,
      warned: results.filter(r => r.status === "WARN").length,
      skipped: results.filter(r => r.status === "SKIP").length,
      startedAt,
      finishedAt,
      durationMs,
    };

    res.json({ summary, results });
  });

  // Stub webhook events endpoint
  app.get('/api/admin/diagnostics/webhooks', isAdmin, async (req, res) => {
    // Stub - return empty array for now, ready for future Vapi/Stripe integration
    const webhookEvents: schema.WebhookEventLog[] = [];
    res.json(webhookEvents);
  });

  // ============================================
  // COMPATIBILITY FLAGS ROUTES
  // ============================================

  // Get all compatibility flags with optional filtering
  app.get('/api/admin/compatibility-flags', isAdmin, async (req, res) => {
    try {
      const { status, flagType } = req.query;
      
      let query = db.select({
        flag: schema.profileCompatibilityFlags,
        user: {
          id: schema.users.id,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        },
        dog: {
          id: schema.dogs.id,
          name: schema.dogs.name,
          breed: schema.dogs.breed,
          photos: schema.dogs.photos,
        },
      })
        .from(schema.profileCompatibilityFlags)
        .leftJoin(schema.users, eq(schema.profileCompatibilityFlags.userId, schema.users.id))
        .leftJoin(schema.dogs, eq(schema.profileCompatibilityFlags.relatedDogId, schema.dogs.id))
        .orderBy(desc(schema.profileCompatibilityFlags.createdAt));

      const flags = await query;
      
      // Apply filters in memory for simplicity
      let filtered = flags;
      if (status && typeof status === 'string') {
        filtered = filtered.filter(f => f.flag.status === status);
      }
      if (flagType && typeof flagType === 'string') {
        filtered = filtered.filter(f => f.flag.flagType === flagType);
      }
      
      res.json(filtered);
    } catch (error: any) {
      console.error("Error fetching compatibility flags:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get a single compatibility flag
  app.get('/api/admin/compatibility-flags/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const [result] = await db.select({
        flag: schema.profileCompatibilityFlags,
        user: {
          id: schema.users.id,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        },
        dog: {
          id: schema.dogs.id,
          name: schema.dogs.name,
          breed: schema.dogs.breed,
          photos: schema.dogs.photos,
        },
      })
        .from(schema.profileCompatibilityFlags)
        .leftJoin(schema.users, eq(schema.profileCompatibilityFlags.userId, schema.users.id))
        .leftJoin(schema.dogs, eq(schema.profileCompatibilityFlags.relatedDogId, schema.dogs.id))
        .where(eq(schema.profileCompatibilityFlags.id, id));
      
      if (!result) {
        return res.status(404).json({ message: "Flag not found" });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching compatibility flag:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update compatibility flag (add comment, change status)
  app.patch('/api/admin/compatibility-flags/:id', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status, adminComment, userNotificationMessage } = req.body;
      const adminId = req.user.id;
      
      const [existing] = await db.select()
        .from(schema.profileCompatibilityFlags)
        .where(eq(schema.profileCompatibilityFlags.id, id));
      
      if (!existing) {
        return res.status(404).json({ message: "Flag not found" });
      }
      
      const updateData: any = { updatedAt: new Date() };
      
      if (status) {
        updateData.status = status;
        if (status === 'reviewed' || status === 'dismissed' || status === 'action_taken') {
          updateData.reviewedBy = adminId;
          updateData.reviewedAt = new Date();
        }
      }
      
      if (adminComment !== undefined) {
        updateData.adminComment = adminComment;
      }

      await db.update(schema.profileCompatibilityFlags)
        .set(updateData)
        .where(eq(schema.profileCompatibilityFlags.id, id));

      const [updated] = await db.select()
        .from(schema.profileCompatibilityFlags)
        .where(eq(schema.profileCompatibilityFlags.id, id));

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating compatibility flag:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // PLUGIN WEBHOOK ROUTES
  // ============================================

  // Get all available plugins (public store)
  app.get('/api/plugins', async (req, res) => {
    try {
      const plugins = await storage.getPublicPlugins();
      res.json(plugins);
    } catch (error: any) {
      console.error("Error fetching plugins:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get shelter's installed plugins
  app.get('/api/shelter/plugins', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can manage plugins" });
      }

      const installations = await storage.getShelterPluginInstallations(user.id);
      res.json(installations);
    } catch (error: any) {
      console.error("Error fetching shelter plugins:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Install a plugin
  app.post('/api/shelter/plugins/install', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can install plugins" });
      }

      const { pluginId, config } = req.body;
      
      // Verify plugin exists
      const plugin = await storage.getPlugin(pluginId);
      if (!plugin) {
        return res.status(404).json({ message: "Plugin not found" });
      }

      // Generate webhook secret
      const webhookSecret = crypto.randomBytes(32).toString('hex');

      const installation = await storage.installPlugin({
        pluginId,
        shelterId: user.id,
        config: config || {},
        webhookSecret,
        isActive: true,
      });

      res.status(201).json(installation);
    } catch (error: any) {
      console.error("Error installing plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update plugin configuration
  app.put('/api/shelter/plugins/:id/config', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can manage plugins" });
      }

      const { id } = req.params;
      const { config } = req.body;

      // Verify ownership
      const installation = await storage.getPluginInstallation(id);
      if (!installation || installation.shelterId !== user.id) {
        return res.status(404).json({ message: "Plugin installation not found" });
      }

      const updated = await storage.updatePluginInstallation(id, { config });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating plugin config:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Uninstall a plugin
  app.delete('/api/shelter/plugins/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can manage plugins" });
      }

      const { id } = req.params;

      // Verify ownership
      const installation = await storage.getPluginInstallation(id);
      if (!installation || installation.shelterId !== user.id) {
        return res.status(404).json({ message: "Plugin installation not found" });
      }

      await storage.uninstallPlugin(id);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error uninstalling plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Incoming webhook endpoint
  app.post('/api/webhooks/:installationId', async (req, res) => {
    const startTime = Date.now();
    const { installationId } = req.params;
    
    try {
      // Get installation
      const installation = await storage.getPluginInstallation(installationId);
      if (!installation || !installation.isActive) {
        return res.status(404).json({ message: "Plugin installation not found or inactive" });
      }

      // Verify webhook signature
      const signature = req.headers['x-webhook-signature'] as string;
      const expectedSignature = crypto
        .createHmac('sha256', installation.webhookSecret!)
        .update(JSON.stringify(req.body))
        .digest('hex');
      
      const signatureValid = signature === expectedSignature;

      // Log webhook
      await storage.createWebhookLog({
        installationId,
        direction: 'incoming',
        eventType: req.body.event || 'unknown',
        requestUrl: req.url,
        requestMethod: 'POST',
        requestHeaders: req.headers as any,
        requestBody: req.body,
        signatureValid,
        status: signatureValid ? 'success' : 'failed',
        errorMessage: signatureValid ? undefined : 'Invalid signature',
        processingTimeMs: Date.now() - startTime,
      });

      if (!signatureValid) {
        return res.status(401).json({ message: "Invalid webhook signature" });
      }

      // Process webhook based on event type
      const { event, data } = req.body;
      const shelterId = installation.shelterId;
      
      try {
        switch (event) {
          case 'adoption.completed': {
            // Handle adoption completion from external system
            const { dogId, adopterId, adoptionDate, notes } = data;
            if (dogId) {
              // Update dog special needs with adoption note
              const dog = await storage.getDog(dogId);
              if (dog && dog.userId === shelterId) {
                const adoptionNote = notes || `Adopted via plugin on ${adoptionDate || new Date().toISOString()}`;
                await storage.updateDog(dogId, { 
                  specialNeeds: dog.specialNeeds ? `${dog.specialNeeds}\n\n[Adoption Note] ${adoptionNote}` : `[Adoption Note] ${adoptionNote}`
                });
                console.log(`[Webhook] Dog ${dogId} marked as adopted via plugin`);
              }
            }
            break;
          }
          
          case 'application.received': {
            // Handle new application from external platform
            const { applicantEmail, applicantName, dogId: targetDogId } = data;
            console.log(`[Webhook] New application received for dog ${targetDogId} from ${applicantName} (${applicantEmail})`);
            // Applications can be created through the shelter's application system
            break;
          }
          
          case 'dog.created': {
            // Handle dog creation from external system - log only, requires full dog data
            const { name, breed } = data;
            console.log(`[Webhook] Dog creation request received: ${name} (${breed}) - manual review required`);
            // Full dog creation requires many fields, better handled through shelter portal
            break;
          }
          
          case 'dog.updated': {
            // Handle dog update from external system
            const { dogId: updateDogId, updates } = data;
            if (updateDogId && updates) {
              // Verify dog belongs to this shelter
              const dog = await storage.getDog(updateDogId);
              if (dog && dog.userId === shelterId) {
                // Filter updates to only allowed fields
                const safeUpdates: any = {};
                const allowedFields = ['bio', 'specialNeeds', 'vaccinated', 'spayedNeutered'];
                for (const field of allowedFields) {
                  if (field in updates) {
                    safeUpdates[field] = updates[field];
                  }
                }
                if (Object.keys(safeUpdates).length > 0) {
                  await storage.updateDog(updateDogId, safeUpdates);
                  console.log(`[Webhook] Updated dog ${updateDogId} via plugin`);
                }
              }
            }
            break;
          }
          
          case 'intake.created': {
            // Handle intake record creation
            const { dogId: intakeDogId, intakeType, intakeDate, sourceInfo } = data;
            if (intakeDogId) {
              await storage.createIntakeRecord({
                dogId: intakeDogId,
                shelterId,
                intakeType: intakeType || 'owner_surrender',
                intakeDate: intakeDate ? new Date(intakeDate) : new Date(),
                sourceInfo: sourceInfo || 'Created via plugin webhook',
                pipelineStatus: 'intake',
              });
              console.log(`[Webhook] Created intake record for dog ${intakeDogId} via plugin`);
            }
            break;
          }
          
          case 'foster.assigned': {
            // Handle foster assignment
            const { dogId: fosterDogId, fostererId } = data;
            console.log(`[Webhook] Foster assignment: dog ${fosterDogId} to foster ${fostererId}`);
            // Foster assignments can be handled through the foster system
            break;
          }
          
          case 'medical.record.created': {
            // Handle medical record creation
            const { dogId: medDogId, recordType, title, description: medDescription } = data;
            if (medDogId) {
              await storage.createMedicalRecord({
                dogId: medDogId,
                shelterId,
                recordType: recordType || 'other',
                title: title || 'Record from plugin webhook',
                description: medDescription || 'Created via plugin webhook',
              });
              console.log(`[Webhook] Created medical record for dog ${medDogId} via plugin`);
            }
            break;
          }
          
          default:
            console.log(`[Webhook] Unhandled event type: ${event}`);
        }
      } catch (processingError: any) {
        console.error(`[Webhook] Error processing event ${event}:`, processingError);
        // Log processing error but don't fail the webhook receipt
      }
      
      res.json({ received: true, event, processed: true });
    } catch (error: any) {
      console.error("Webhook processing error:", error);
      
      await storage.createWebhookLog({
        installationId,
        direction: 'incoming',
        eventType: req.body?.event || 'unknown',
        requestUrl: req.url,
        requestMethod: 'POST',
        requestBody: req.body,
        status: 'failed',
        errorMessage: error.message,
        processingTimeMs: Date.now() - startTime,
      });

      res.status(500).json({ message: error.message });
    }
  });

  // Get webhook logs for an installation
  app.get('/api/shelter/plugins/:id/logs', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can view logs" });
      }

      const { id } = req.params;

      // Verify ownership
      const installation = await storage.getPluginInstallation(id);
      if (!installation || installation.shelterId !== user.id) {
        return res.status(404).json({ message: "Plugin installation not found" });
      }

      const logs = await storage.getWebhookLogs(id);
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching webhook logs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Trigger outgoing webhook (for shelter to send data to plugin)
  app.post('/api/shelter/plugins/:id/trigger', isAuthenticated, async (req: any, res) => {
    const startTime = Date.now();
    const { id } = req.params;
    
    try {
      const user = req.user as User;
      if (user.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can trigger webhooks" });
      }

      // Verify ownership
      const installation = await storage.getPluginInstallation(id);
      if (!installation || installation.shelterId !== user.id) {
        return res.status(404).json({ message: "Plugin installation not found" });
      }

      const plugin = await storage.getPlugin(installation.pluginId);
      if (!plugin || !plugin.webhookUrl) {
        return res.status(400).json({ message: "Plugin does not support webhooks" });
      }

      const { event, data } = req.body;

      // Create signature
      const signature = crypto
        .createHmac('sha256', installation.webhookSecret!)
        .update(JSON.stringify({ event, data }))
        .digest('hex');

      // Send webhook
      const response = await fetch(plugin.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Installation-Id': installation.id,
        },
        body: JSON.stringify({ event, data }),
      });

      const responseBody = await response.json();

      // Log webhook with retry state if failed
      const { calculateNextRetryTime, shouldRetry } = await import('./utils/webhook-retry');
      const isSuccess = response.ok;
      const nextRetry = !isSuccess && shouldRetry(0) ? calculateNextRetryTime(0) : null;
      
      await storage.createWebhookLog({
        installationId: id,
        direction: 'outgoing',
        eventType: event,
        requestUrl: plugin.webhookUrl,
        requestMethod: 'POST',
        requestHeaders: { 'Content-Type': 'application/json' } as any,
        requestBody: { event, data },
        responseStatus: response.status,
        responseBody,
        status: isSuccess ? 'success' : (nextRetry ? 'pending_retry' : 'failed'),
        errorMessage: isSuccess ? undefined : `HTTP ${response.status}`,
        retryCount: 0,
        nextRetryAt: nextRetry,
        processingTimeMs: Date.now() - startTime,
      });

      res.json({ success: response.ok, response: responseBody });
    } catch (error: any) {
      console.error("Error triggering webhook:", error);
      
      const { calculateNextRetryTime, shouldRetry } = await import('./utils/webhook-retry');
      const nextRetry = shouldRetry(0) ? calculateNextRetryTime(0) : null;
      
      await storage.createWebhookLog({
        installationId: id,
        direction: 'outgoing',
        eventType: req.body?.event || 'unknown',
        requestBody: req.body,
        status: nextRetry ? 'pending_retry' : 'failed',
        errorMessage: error.message,
        retryCount: 0,
        nextRetryAt: nextRetry,
        processingTimeMs: Date.now() - startTime,
      });

      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // ADMIN PLUGIN MANAGEMENT
  // ============================================

  // Get all plugins (admin - includes inactive)
  app.get('/api/admin/plugins', isAdmin, async (req, res) => {
    try {
      const plugins = await db.select().from(schema.plugins).orderBy(desc(schema.plugins.isOfficial), asc(schema.plugins.name));
      res.json(plugins);
    } catch (error: any) {
      console.error("Error fetching plugins for admin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create new plugin
  app.post('/api/admin/plugins', isAdmin, async (req: any, res) => {
    try {
      const plugin = await storage.createPlugin(req.body);
      res.status(201).json(plugin);
    } catch (error: any) {
      console.error("Error creating plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update plugin
  app.patch('/api/admin/plugins/:id', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const plugin = await storage.updatePlugin(id, req.body);
      if (!plugin) {
        return res.status(404).json({ message: "Plugin not found" });
      }
      res.json(plugin);
    } catch (error: any) {
      console.error("Error updating plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete plugin
  app.delete('/api/admin/plugins/:id', isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePlugin(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get plugin installation stats (for admin dashboard)
  app.get('/api/admin/plugins/:id/stats', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const installations = await db.select()
        .from(schema.pluginInstallations)
        .where(eq(schema.pluginInstallations.pluginId, id));
      
      const activeCount = installations.filter(i => i.isActive).length;
      const totalWebhooks = installations.reduce((sum, i) => sum + (i.totalWebhooksReceived || 0), 0);
      
      res.json({
        totalInstallations: installations.length,
        activeInstallations: activeCount,
        totalWebhooksProcessed: totalWebhooks,
      });
    } catch (error: any) {
      console.error("Error fetching plugin stats:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Process pending webhook retries (internal/admin endpoint)
  app.post('/api/admin/webhooks/process-retries', isAdmin, async (req, res) => {
    try {
      const pendingWebhooks = await storage.getPendingRetryWebhooks();
      const results: { id: string; success: boolean; error?: string }[] = [];
      
      const { calculateNextRetryTime, shouldRetry, getMaxRetries } = await import('./utils/webhook-retry');
      
      for (const webhook of pendingWebhooks) {
        const startTime = Date.now();
        const currentRetryCount = (webhook.retryCount || 0) + 1;
        
        try {
          const installation = await storage.getPluginInstallation(webhook.installationId);
          if (!installation || !installation.isActive) {
            await storage.updateWebhookLog(webhook.id, {
              status: 'failed',
              errorMessage: 'Plugin installation not found or inactive',
              nextRetryAt: null,
            });
            results.push({ id: webhook.id, success: false, error: 'Installation inactive' });
            continue;
          }
          
          const plugin = await storage.getPlugin(installation.pluginId);
          if (!plugin || !plugin.webhookUrl) {
            await storage.updateWebhookLog(webhook.id, {
              status: 'failed',
              errorMessage: 'Plugin does not support webhooks',
              nextRetryAt: null,
            });
            results.push({ id: webhook.id, success: false, error: 'No webhook URL' });
            continue;
          }
          
          // Process webhook delivery
          results.push({ id: webhook.id, success: true });
        } catch (error: any) {
          console.error(`Error processing webhook ${webhook.id}:`, error);
          results.push({ id: webhook.id, success: false, error: error.message });
        }
      }
      
      res.json({ processed: results.length, results });
    } catch (error: any) {
      console.error('Error processing webhook retries:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Create/manage plugins
  app.post('/api/admin/plugins', isAdmin, async (req, res) => {
    try {
      const plugin = await storage.createPlugin(req.body);
      res.status(201).json(plugin);
    } catch (error: any) {
      console.error("Error creating plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/admin/plugins/:id', isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const plugin = await storage.updatePlugin(id, req.body);
      res.json(plugin);
    } catch (error: any) {
      console.error("Error updating plugin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/admin/plugins', isAdmin, async (req, res) => {
    try {
      const plugins = await storage.getAllPlugins();
      res.json(plugins);
    } catch (error: any) {
      console.error("Error fetching plugins:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get compatibility flag counts for dashboard
  app.get('/api/admin/compatibility-flags/stats', isAdmin, async (req, res) => {
    try {
      const [stats] = await db.select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(*) filter (where status = 'pending')`,
        redFlags: sql<number>`count(*) filter (where flag_type = 'red' and status = 'pending')`,
        yellowFlags: sql<number>`count(*) filter (where flag_type = 'yellow' and status = 'pending')`,
      })
        .from(schema.profileCompatibilityFlags);
      
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching compatibility flag stats:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // ONBOARDING ROUTES
  // ============================================

  // Get current authenticated user info
  app.get('/api/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error: any) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update user role
  app.patch('/api/me/role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { role } = req.body;

      // Validate role
      if (!role || !['adopter', 'shelter', 'owner'].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'adopter', 'shelter', or 'owner'" });
      }

      // Update user role
      const updatedUser = await storage.updateUserRole(userId, role);

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update session
      req.user.role = role;

      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Shelter Onboarding
  app.post('/api/shelter/onboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Verify user has shelter role
      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. User must have shelter role." });
      }

      // Check if shelter profile already exists
      const existing = await storage.getShelterProfile(userId);
      if (existing) {
        return res.status(400).json({ message: "Shelter profile already exists" });
      }

      // Create shelter profile
      const shelterProfile = await storage.createShelterProfile({
        userId,
        shelterName: req.body.shelterName,
        location: req.body.location,
        email: req.body.email,
        phone: req.body.phone,
        licenseNumber: req.body.licenseNumber || null,
        description: req.body.description || null,
        isVerified: false,
      });

      res.json(shelterProfile);
    } catch (error: any) {
      console.error("Shelter onboarding error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get current user's shelter profile
  app.get('/api/shelter/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await storage.getShelterProfile(userId);

      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      res.json(shelterProfile);
    } catch (error: any) {
      console.error("Error fetching shelter profile:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update current user's shelter profile
  app.patch('/api/shelter/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await storage.getShelterProfile(userId);

      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      const updated = await storage.updateShelterProfile(shelterProfile.id, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating shelter profile:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER STAFF MANAGEMENT
  // ============================================

  // Get current user's staff permissions
  app.get('/api/shelter/staff/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If the user is a shelter owner, they have full permissions
      if (user.role === 'shelter') {
        return res.json({
          role: "owner",
          canManageDogs: true,
          canManageTasks: true,
          canViewMedical: true,
          canEditMedical: true,
          canManageStaff: true,
          canViewReports: true,
          canManageCalendar: true,
          canManageApplications: true,
          canManageFosters: true,
          canViewBehavior: true,
          canEditBehavior: true,
          canViewInbox: true,
          canSendMessages: true,
        });
      }

      // Find staff record by user ID first
      let staffRecord = null;
      const [byUserId] = await db.select()
        .from(schema.shelterStaff)
        .where(eq(schema.shelterStaff.userId, userId))
        .limit(1);
      
      if (byUserId) {
        staffRecord = byUserId;
      } else if (user.email) {
        // Fall back to looking up by email if userId not linked
        const [byEmail] = await db.select()
          .from(schema.shelterStaff)
          .where(eq(schema.shelterStaff.email, user.email))
          .limit(1);
        staffRecord = byEmail;
      }

      if (!staffRecord) {
        // Return minimal permissions for non-staff users viewing shelter pages
        return res.json({
          role: "viewer",
          canManageDogs: false,
          canManageTasks: false,
          canViewMedical: false,
          canEditMedical: false,
          canManageStaff: false,
          canViewReports: false,
          canManageCalendar: false,
          canManageApplications: false,
          canManageFosters: false,
          canViewBehavior: false,
          canEditBehavior: false,
          canViewInbox: false,
          canSendMessages: false,
        });
      }

      res.json({
        role: staffRecord.role,
        canManageDogs: staffRecord.canManageDogs,
        canManageTasks: staffRecord.canManageTasks,
        canViewMedical: staffRecord.canViewMedical,
        canEditMedical: staffRecord.canEditMedical,
        canManageStaff: staffRecord.canManageStaff,
        canViewReports: staffRecord.canViewReports,
        canManageCalendar: staffRecord.canManageCalendar,
        canManageApplications: staffRecord.canManageApplications,
        canManageFosters: staffRecord.canManageFosters,
        canViewBehavior: staffRecord.canViewBehavior,
        canEditBehavior: staffRecord.canEditBehavior,
        canViewInbox: staffRecord.canViewInbox,
        canSendMessages: staffRecord.canSendMessages,
      });
    } catch (error: any) {
      console.error("Error fetching staff permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all staff members for this shelter
  app.get('/api/shelter/staff', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const staff = await db.select()
        .from(schema.shelterStaff)
        .where(eq(schema.shelterStaff.shelterId, userId))
        .orderBy(schema.shelterStaff.createdAt);

      res.json(staff);
    } catch (error: any) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get available staff roles
  app.get('/api/shelter/staff/roles', isAuthenticated, async (req: any, res) => {
    try {
      res.json(schema.SHELTER_STAFF_ROLES);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add a new staff member
  app.post('/api/shelter/staff', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { name, email, phone, role, customTitle } = req.body;

      if (!name || !role) {
        return res.status(400).json({ message: "Name and role are required" });
      }

      // Get default permissions for the role
      const roleConfig = schema.SHELTER_STAFF_ROLES[role as schema.ShelterStaffRole];
      if (!roleConfig) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const [newStaff] = await db.insert(schema.shelterStaff)
        .values({
          shelterId: userId,
          name,
          email: email || null,
          phone: phone || null,
          role,
          customTitle: customTitle || null,
          invitedBy: userId,
          invitedAt: new Date(),
          ...roleConfig.defaultPermissions,
        })
        .returning();

      res.status(201).json(newStaff);
    } catch (error: any) {
      console.error("Error creating staff member:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update a staff member
  app.patch('/api/shelter/staff/:staffId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { staffId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify this staff member belongs to this shelter
      const [existingStaff] = await db.select()
        .from(schema.shelterStaff)
        .where(and(
          eq(schema.shelterStaff.id, staffId),
          eq(schema.shelterStaff.shelterId, userId)
        ));

      if (!existingStaff) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      // If role is being changed, apply new default permissions
      let updates = { ...req.body, updatedAt: new Date() };
      if (req.body.role && req.body.role !== existingStaff.role) {
        const roleConfig = schema.SHELTER_STAFF_ROLES[req.body.role as schema.ShelterStaffRole];
        if (roleConfig) {
          updates = { ...updates, ...roleConfig.defaultPermissions };
        }
      }

      const [updatedStaff] = await db.update(schema.shelterStaff)
        .set(updates)
        .where(eq(schema.shelterStaff.id, staffId))
        .returning();

      res.json(updatedStaff);
    } catch (error: any) {
      console.error("Error updating staff member:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a staff member
  app.delete('/api/shelter/staff/:staffId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { staffId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify this staff member belongs to this shelter
      const [existingStaff] = await db.select()
        .from(schema.shelterStaff)
        .where(and(
          eq(schema.shelterStaff.id, staffId),
          eq(schema.shelterStaff.shelterId, userId)
        ));

      if (!existingStaff) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      await db.delete(schema.shelterStaff)
        .where(eq(schema.shelterStaff.id, staffId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting staff member:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a staff invitation
  app.post('/api/shelter/staff/invite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { email, role, customTitle } = req.body;

      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" });
      }

      const roleConfig = schema.SHELTER_STAFF_ROLES[role as schema.ShelterStaffRole];
      if (!roleConfig) {
        return res.status(400).json({ message: "Invalid role" });
      }

      // Check for existing pending invitation
      const [existing] = await db.select()
        .from(schema.shelterStaffInvitations)
        .where(and(
          eq(schema.shelterStaffInvitations.shelterId, userId),
          eq(schema.shelterStaffInvitations.email, email),
          eq(schema.shelterStaffInvitations.status, 'pending')
        ));

      if (existing) {
        return res.status(400).json({ message: "An invitation for this email is already pending" });
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const [invitation] = await db.insert(schema.shelterStaffInvitations)
        .values({
          shelterId: userId,
          email,
          role,
          customTitle: customTitle || null,
          invitedBy: userId,
          token,
          expiresAt,
        })
        .returning();

      res.status(201).json(invitation);
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending invitations
  app.get('/api/shelter/staff/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const invitations = await db.select()
        .from(schema.shelterStaffInvitations)
        .where(and(
          eq(schema.shelterStaffInvitations.shelterId, userId),
          eq(schema.shelterStaffInvitations.status, 'pending')
        ))
        .orderBy(desc(schema.shelterStaffInvitations.invitedAt));

      res.json(invitations);
    } catch (error: any) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Revoke an invitation
  app.delete('/api/shelter/staff/invitations/:invitationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { invitationId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [updated] = await db.update(schema.shelterStaffInvitations)
        .set({ status: 'revoked' })
        .where(and(
          eq(schema.shelterStaffInvitations.id, invitationId),
          eq(schema.shelterStaffInvitations.shelterId, userId)
        ))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error revoking invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get shelter's dogs (authenticated - for shelter dashboard)
  app.get('/api/shelter/dogs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("[Shelter Dogs] Fetching for user:", userId);

      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        console.log("[Shelter Dogs] Access denied - role:", user?.role);
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get shelter profile to get shelter ID
      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        console.log("[Shelter Dogs] Shelter profile not found");
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Get all dogs belonging to this shelter
      const dogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId))
        .orderBy(desc(schema.dogs.createdAt));

      console.log("[Shelter Dogs] Found", dogs.length, "dogs");

      // Get intake records for these dogs
      const dogIds = dogs.map(d => d.id);
      let intakeRecords: any[] = [];
      if (dogIds.length > 0) {
        intakeRecords = await db.select()
          .from(schema.intakeRecords)
          .where(sql`${schema.intakeRecords.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }

      console.log("[Shelter Dogs] Found", intakeRecords.length, "intake records");

      // Map intake records to dogs
      const intakeMap = new Map(intakeRecords.map(ir => [ir.dogId, ir]));
      const dogsWithIntake = dogs.map(dog => ({
        ...dog,
        intake: intakeMap.get(dog.id) || null,
      }));

      // Set cache headers to prevent stale data
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      res.json(dogsWithIntake);
    } catch (error: any) {
      console.error("Error fetching shelter dogs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Shelter Dashboard Metrics
  app.get('/api/shelter/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Get dogs for this shelter
      const dogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = dogs.map(d => d.id);

      // Get intake records for pipeline status
      let intakeRecords: any[] = [];
      if (dogIds.length > 0) {
        intakeRecords = await db.select()
          .from(schema.intakeRecords)
          .where(sql`${schema.intakeRecords.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }

      const intakeMap = new Map(intakeRecords.map(ir => [ir.dogId, ir]));

      // Count by pipeline status
      let dogsInIntake = 0;
      let dogsInMedicalHold = 0;
      let dogsReady = 0;

      dogs.forEach(dog => {
        const intake = intakeMap.get(dog.id);
        const status = intake?.pipelineStatus || 'ready';
        if (status === 'intake' || status === 'stray_hold') dogsInIntake++;
        else if (status === 'medical_hold') dogsInMedicalHold++;
        else if (status === 'ready' || status === 'featured') dogsReady++;
      });

      // Get tasks for this shelter (tasks use userId as shelterId)
      const tasks = await db.select()
        .from(schema.shelterTasks)
        .where(eq(schema.shelterTasks.shelterId, userId));

      const now = new Date();
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
      const overdueTasks = tasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'
      ).length;

      // Get upcoming vaccines (medical records of type vaccine with next due date)
      let upcomingVaccines = 0;
      if (dogIds.length > 0) {
        const vaccineRecords = await db.select()
          .from(schema.medicalRecords)
          .where(sql`${schema.medicalRecords.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)}) AND ${schema.medicalRecords.recordType} = 'vaccine'`);

        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);

        upcomingVaccines = vaccineRecords.filter(v => 
          v.nextDueDate && new Date(v.nextDueDate) <= weekFromNow
        ).length;
      }

      // Get active applications (using adoption journeys)
      let activeApplications = 0;
      if (dogIds.length > 0) {
        const journeys = await db.select()
          .from(schema.adoptionJourneys)
          .where(sql`${schema.adoptionJourneys.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)}) AND ${schema.adoptionJourneys.currentStep} IN ('application', 'phone_screening', 'meet_greet')`);
        activeApplications = journeys.length;
      }

      const metrics = {
        totalDogs: dogs.length,
        dogsInIntake,
        dogsReady,
        dogsInMedicalHold,
        pendingTasks,
        overdueTasks,
        upcomingVaccines,
        activeApplications,
      };

      res.json(metrics);
    } catch (error: any) {
      console.error("Error fetching shelter dashboard:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Shelter Tasks
  app.get('/api/shelter/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Query by userId since tasks were created with userId as shelterId
      // Optionally filter by dogId if provided
      const whereConditions = dogId 
        ? and(eq(schema.shelterTasks.shelterId, userId), eq(schema.shelterTasks.dogId, dogId as string))
        : eq(schema.shelterTasks.shelterId, userId);
        
      const tasks = await db.select()
        .from(schema.shelterTasks)
        .where(whereConditions)
        .orderBy(schema.shelterTasks.dueDate);

      // Get dog info for tasks with dogId
      const dogIds = tasks.filter(t => t.dogId).map(t => t.dogId as string);
      let dogs: any[] = [];
      if (dogIds.length > 0) {
        dogs = await db.select()
          .from(schema.dogs)
          .where(sql`${schema.dogs.id} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }

      const dogMap = new Map(dogs.map(d => [d.id, d]));

      const tasksWithDogs = tasks.map(task => ({
        ...task,
        dog: task.dogId ? dogMap.get(task.dogId) || null : null,
      }));

      res.json(tasksWithDogs);
    } catch (error: any) {
      console.error("Error fetching shelter tasks:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update shelter task
  app.patch('/api/shelter/tasks/:taskId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { taskId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Verify task belongs to this shelter
      const [task] = await db.select()
        .from(schema.shelterTasks)
        .where(eq(schema.shelterTasks.id, taskId));

      if (!task || task.shelterId !== userId) {
        return res.status(404).json({ message: "Task not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.completedAt !== undefined) {
        updateData.completedAt = req.body.completedAt ? new Date(req.body.completedAt) : null;
      }
      if (req.body.dueDate !== undefined) {
        updateData.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
      }
      if (req.body.dueTime !== undefined) updateData.dueTime = req.body.dueTime;
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.assignedTo !== undefined) updateData.assignedTo = req.body.assignedTo;
      if (req.body.parentTaskId !== undefined) updateData.parentTaskId = req.body.parentTaskId;
      if (req.body.sortOrder !== undefined) updateData.sortOrder = req.body.sortOrder;

      const [updatedTask] = await db.update(schema.shelterTasks)
        .set(updateData)
        .where(eq(schema.shelterTasks.id, taskId))
        .returning();

      res.json(updatedTask);
    } catch (error: any) {
      console.error("Error updating shelter task:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create shelter task
  app.post('/api/shelter/tasks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      const { title, description, category, taskType, priority, dueDate, dueTime, dogId, assignedTo, parentTaskId, sortOrder } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Task title is required" });
      }

      const [newTask] = await db.insert(schema.shelterTasks)
        .values({
          id: crypto.randomUUID(),
          shelterId: userId,
          title,
          description: description || null,
          taskType: taskType || category || 'custom',  // Accept both taskType and category for backwards compatibility
          priority: priority || 'medium',
          dueDate: dueDate ? new Date(dueDate) : null,
          dueTime: dueTime || null,
          dogId: dogId || null,
          assignedTo: assignedTo || null,
          parentTaskId: parentTaskId || null,
          sortOrder: sortOrder ?? 0,
          status: 'pending',
          createdAt: new Date(),
        })
        .returning();

      res.json(newTask);
    } catch (error: any) {
      console.error("Error creating shelter task:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete shelter task
  app.delete('/api/shelter/tasks/:taskId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { taskId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify task belongs to this shelter
      const [task] = await db.select()
        .from(schema.shelterTasks)
        .where(eq(schema.shelterTasks.id, taskId));

      if (!task || task.shelterId !== userId) {
        return res.status(404).json({ message: "Task not found" });
      }

      await db.delete(schema.shelterTasks)
        .where(eq(schema.shelterTasks.id, taskId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting shelter task:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder shelter tasks (Google Tasks-style drag and drop)
  app.post('/api/shelter/tasks/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { orderedIds, parentTaskId } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return res.status(400).json({ message: "orderedIds must be a non-empty array" });
      }

      // First verify all tasks belong to this shelter and have matching parentTaskId
      const tasksToReorder = await db.select()
        .from(schema.shelterTasks)
        .where(and(
          eq(schema.shelterTasks.shelterId, userId),
          parentTaskId 
            ? eq(schema.shelterTasks.parentTaskId, parentTaskId)
            : isNull(schema.shelterTasks.parentTaskId)
        ));

      const validTaskIds = new Set(tasksToReorder.map(t => t.id));
      const invalidIds = orderedIds.filter((id: string) => !validTaskIds.has(id));
      
      if (invalidIds.length > 0) {
        return res.status(400).json({ 
          message: "Some task IDs are invalid or don't belong to your shelter",
          invalidIds 
        });
      }

      // Update sort order for each task atomically
      for (let i = 0; i < orderedIds.length; i++) {
        await db.update(schema.shelterTasks)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(
            eq(schema.shelterTasks.id, orderedIds[i]),
            eq(schema.shelterTasks.shelterId, userId)
          ));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering tasks:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get medical records for a specific dog
  app.get('/api/shelter/medical/dog/:dogId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const records = await db.select()
        .from(schema.medicalRecords)
        .where(eq(schema.medicalRecords.dogId, dogId))
        .orderBy(desc(schema.medicalRecords.performedAt));

      res.json(records);
    } catch (error: any) {
      console.error("Error fetching medical records:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get vaccines for a dog
  app.get('/api/shelter/medical/dog/:dogId/vaccines', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      // Get vaccine records (medical records of type vaccine)
      const records = await db.select()
        .from(schema.medicalRecords)
        .where(and(
          eq(schema.medicalRecords.dogId, dogId),
          eq(schema.medicalRecords.recordType, 'vaccine')
        ))
        .orderBy(desc(schema.medicalRecords.performedAt));

      res.json(records);
    } catch (error: any) {
      console.error("Error fetching vaccines:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create medical record
  app.post('/api/shelter/medical', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { dogId, recordType, description, recordDate, veterinarian, notes, nextDueDate, cost } = req.body;

      if (!dogId || !recordType) {
        return res.status(400).json({ message: "Dog ID and record type are required" });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const [newRecord] = await db.insert(schema.medicalRecords)
        .values({
          id: crypto.randomUUID(),
          dogId,
          shelterId: userId,
          recordType,
          title: description || recordType,
          description: description || null,
          performedAt: recordDate ? new Date(recordDate) : new Date(),
          veterinarian: veterinarian || null,
          nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
          cost: cost || null,
        })
        .returning();

      // Auto-complete related pending tasks when medical record is added
      if (recordType === 'vaccine') {
        // Find and complete pending vaccine tasks for this dog
        const pendingVaccineTasks = await db.select()
          .from(schema.shelterTasks)
          .where(and(
            eq(schema.shelterTasks.dogId, dogId),
            eq(schema.shelterTasks.shelterId, userId),
            eq(schema.shelterTasks.taskType, 'vaccine'),
            eq(schema.shelterTasks.status, 'pending')
          ));
        
        for (const task of pendingVaccineTasks) {
          // Check if task title matches the vaccine type (flexible matching)
          const taskLower = task.title.toLowerCase();
          const descLower = (description || '').toLowerCase();
          if (taskLower.includes(descLower) || descLower.includes(taskLower) || taskLower.includes('vaccine')) {
            await db.update(schema.shelterTasks)
              .set({
                status: 'completed',
                completedAt: new Date(),
                completedBy: userId,
                completionNotes: `Auto-completed: ${recordType} record added`,
                updatedAt: new Date(),
              })
              .where(eq(schema.shelterTasks.id, task.id));
            
            // Log automation run for explainability
            await db.insert(schema.automationRuns).values({
              shelterId: userId,
              triggerType: 'vaccine_added',
              triggerEvent: `Vaccine record "${description || recordType}" was added for ${dog.name}`,
              targetType: 'task',
              targetId: task.id,
              dogId: dogId,
              actionType: 'auto_complete_task',
              actionDescription: `Completed task "${task.title}" for ${dog.name}`,
              result: 'success',
            });
          }
        }
      } else if (['treatment', 'exam', 'surgery', 'medication'].includes(recordType)) {
        // Auto-complete matching medical tasks
        const pendingMedicalTasks = await db.select()
          .from(schema.shelterTasks)
          .where(and(
            eq(schema.shelterTasks.dogId, dogId),
            eq(schema.shelterTasks.shelterId, userId),
            eq(schema.shelterTasks.taskType, 'medical'),
            eq(schema.shelterTasks.status, 'pending')
          ));
        
        for (const task of pendingMedicalTasks) {
          await db.update(schema.shelterTasks)
            .set({
              status: 'completed',
              completedAt: new Date(),
              completedBy: userId,
              completionNotes: `Auto-completed: ${recordType} record added`,
              updatedAt: new Date(),
            })
            .where(eq(schema.shelterTasks.id, task.id));
          
          // Log automation run for explainability
          await db.insert(schema.automationRuns).values({
            shelterId: userId,
            triggerType: 'medical_added',
            triggerEvent: `Medical record "${description || recordType}" was added for ${dog.name}`,
            targetType: 'task',
            targetId: task.id,
            dogId: dogId,
            actionType: 'auto_complete_task',
            actionDescription: `Completed task "${task.title}" for ${dog.name}`,
            result: 'success',
          });
        }
      }

      res.json(newRecord);
    } catch (error: any) {
      console.error("Error creating medical record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete medical record
  app.delete('/api/shelter/medical/:recordId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { recordId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify record belongs to this shelter
      const [record] = await db.select()
        .from(schema.medicalRecords)
        .where(eq(schema.medicalRecords.id, recordId));

      if (!record || record.shelterId !== userId) {
        return res.status(404).json({ message: "Medical record not found" });
      }

      await db.delete(schema.medicalRecords)
        .where(eq(schema.medicalRecords.id, recordId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting medical record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete shelter dog
  app.delete('/api/shelter/dogs/:dogId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      // Delete associated intake records first
      await db.delete(schema.intakeRecords)
        .where(eq(schema.intakeRecords.dogId, dogId));

      // Delete associated medical records
      await db.delete(schema.medicalRecords)
        .where(eq(schema.medicalRecords.dogId, dogId));

      // Delete associated tasks
      await db.delete(schema.shelterTasks)
        .where(eq(schema.shelterTasks.dogId, dogId));

      // Delete the dog
      await db.delete(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting shelter dog:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get treatment plans for a specific dog
  app.get('/api/shelter/dogs/:dogId/treatment-plans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const plans = await db.select()
        .from(schema.treatmentPlans)
        .where(eq(schema.treatmentPlans.dogId, dogId))
        .orderBy(desc(schema.treatmentPlans.createdAt));

      res.json(plans);
    } catch (error: any) {
      console.error("Error fetching treatment plans for dog:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get vet referrals for a specific dog
  app.get('/api/shelter/dogs/:dogId/vet-referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const referrals = await db.select()
        .from(schema.vetReferrals)
        .where(eq(schema.vetReferrals.dogId, dogId))
        .orderBy(desc(schema.vetReferrals.createdAt));

      res.json(referrals);
    } catch (error: any) {
      console.error("Error fetching vet referrals for dog:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get dog events (timeline) for a specific dog
  app.get('/api/shelter/dogs/:dogId/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId } = req.params;
      const { limit: limitStr, eventType } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const limit = limitStr ? parseInt(limitStr as string) : 50;

      // Build query conditions
      let conditions = [eq(schema.dogEvents.dogId, dogId)];
      if (eventType) {
        conditions.push(eq(schema.dogEvents.eventType, eventType as string));
      }

      const events = await db.select()
        .from(schema.dogEvents)
        .where(and(...conditions))
        .orderBy(desc(schema.dogEvents.createdAt))
        .limit(limit);

      res.json(events);
    } catch (error: any) {
      console.error("Error fetching dog events:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get intake records for shelter
  app.get('/api/shelter/intake', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get all dogs for this shelter with their intake records
      const dogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = dogs.map(d => d.id);

      if (dogIds.length === 0) {
        return res.json([]);
      }

      const intakeRecords = await db.select()
        .from(schema.intakeRecords)
        .where(inArray(schema.intakeRecords.dogId, dogIds));

      // Attach dog info to each intake record
      const dogMap = new Map(dogs.map(d => [d.id, d]));
      const recordsWithDogs = intakeRecords.map(record => ({
        ...record,
        dog: dogMap.get(record.dogId) || null,
      }));

      res.json(recordsWithDogs);
    } catch (error: any) {
      console.error("Error fetching intake records:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single intake record by ID
  app.get('/api/shelter/intake/:intakeId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { intakeId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [record] = await db.select()
        .from(schema.intakeRecords)
        .where(eq(schema.intakeRecords.id, intakeId));

      if (!record) {
        return res.status(404).json({ message: "Intake record not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, record.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json({ ...record, dog });
    } catch (error: any) {
      console.error("Error fetching intake record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // AUTOMATION RUNS (Explainability Logs)
  // ============================================
  
  // Get automation runs for shelter
  app.get('/api/shelter/automation-runs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId, limit: limitStr } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const limit = limitStr ? parseInt(limitStr) : 50;
      
      // Build query conditions
      const conditions = [eq(schema.automationRuns.shelterId, userId)];
      if (dogId) {
        conditions.push(eq(schema.automationRuns.dogId, dogId as string));
      }

      const runs = await db.select()
        .from(schema.automationRuns)
        .where(and(...conditions))
        .orderBy(desc(schema.automationRuns.createdAt))
        .limit(limit);

      // Enrich with dog info
      const dogIds = [...new Set(runs.filter(r => r.dogId).map(r => r.dogId as string))];
      let dogs: any[] = [];
      if (dogIds.length > 0) {
        dogs = await db.select()
          .from(schema.dogs)
          .where(inArray(schema.dogs.id, dogIds));
      }
      const dogMap = new Map(dogs.map(d => [d.id, d]));

      const enrichedRuns = runs.map(run => ({
        ...run,
        dog: run.dogId ? dogMap.get(run.dogId) || null : null,
      }));

      res.json(enrichedRuns);
    } catch (error: any) {
      console.error("Error fetching automation runs:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER RESOURCES ENDPOINTS
  // ============================================

  // Get all resources for a shelter
  app.get('/api/shelter/resources', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const resources = await db.select()
        .from(schema.shelterResources)
        .where(eq(schema.shelterResources.shelterId, userId))
        .orderBy(desc(schema.shelterResources.createdAt));

      res.json(resources);
    } catch (error: any) {
      console.error("Error fetching shelter resources:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new resource
  app.post('/api/shelter/resources', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { resourceType, title, description, availability, schedule, eligibilityNotes, cost, contactPhone, contactEmail, websiteUrl, isActive } = req.body;

      if (!resourceType || !title) {
        return res.status(400).json({ message: "Resource type and title are required" });
      }

      const [newResource] = await db.insert(schema.shelterResources)
        .values({
          id: crypto.randomUUID(),
          shelterId: userId,
          resourceType,
          title,
          description: description || null,
          availability: availability || null,
          schedule: schedule || null,
          eligibilityNotes: eligibilityNotes || null,
          cost: cost || null,
          contactPhone: contactPhone || null,
          contactEmail: contactEmail || null,
          websiteUrl: websiteUrl || null,
          isActive: isActive !== undefined ? isActive : true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      res.json(newResource);
    } catch (error: any) {
      console.error("Error creating shelter resource:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update a resource
  app.patch('/api/shelter/resources/:resourceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { resourceId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify resource belongs to this shelter
      const [resource] = await db.select()
        .from(schema.shelterResources)
        .where(eq(schema.shelterResources.id, resourceId));

      if (!resource || resource.shelterId !== userId) {
        return res.status(404).json({ message: "Resource not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      const allowedFields = ['resourceType', 'title', 'description', 'availability', 'schedule', 'eligibilityNotes', 'cost', 'contactPhone', 'contactEmail', 'websiteUrl', 'isActive'];

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const [updatedResource] = await db.update(schema.shelterResources)
        .set(updateData)
        .where(eq(schema.shelterResources.id, resourceId))
        .returning();

      res.json(updatedResource);
    } catch (error: any) {
      console.error("Error updating shelter resource:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a resource
  app.delete('/api/shelter/resources/:resourceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { resourceId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify resource belongs to this shelter
      const [resource] = await db.select()
        .from(schema.shelterResources)
        .where(eq(schema.shelterResources.id, resourceId));

      if (!resource || resource.shelterId !== userId) {
        return res.status(404).json({ message: "Resource not found" });
      }

      await db.delete(schema.shelterResources)
        .where(eq(schema.shelterResources.id, resourceId));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting shelter resource:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER APPLICATION QUESTIONS ROUTES
  // ============================================

  // Get shelter application form and questions (including admin questions for reference)
  app.get('/api/shelter/application-questions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Check if shelter_application_builder feature is enabled
      const enabledFlags = await storage.getEnabledFeatureFlags();
      const isApplicationBuilderEnabled = enabledFlags.some(f => f.key === 'shelter_application_builder');

      // Get or create the shelter's application form
      let form = await storage.getShelterApplicationForm(userId);
      
      if (!form) {
        // Create a default form for this shelter
        form = await storage.createShelterApplicationForm({
          shelterId: userId,
          title: "Adoption Application",
          isDefault: true,
        });
      }

      // Get shelter's custom questions
      const shelterQuestions = await storage.getShelterApplicationQuestions(form.id);
      
      // Only return admin questions if application builder feature is enabled
      let adminQuestionsResponse: any[] = [];
      if (isApplicationBuilderEnabled) {
        const adminQuestions = await storage.getApplicationQuestions();
        const activeAdminQuestions = adminQuestions.filter(q => q.isActive);
        adminQuestionsResponse = activeAdminQuestions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          helperText: q.helperText,
          options: q.options,
          isRequired: q.isRequired,
          position: q.position,
          mode: q.mode,
          section: q.section,
          source: 'platform' as const,
        }));
      }

      res.json({ 
        form, 
        questions: shelterQuestions,
        adminQuestions: adminQuestionsResponse,
      });
    } catch (error: any) {
      console.error("Error fetching shelter application questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new question
  app.post('/api/shelter/application-questions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get or create the shelter's application form
      let form = await storage.getShelterApplicationForm(userId);
      
      if (!form) {
        form = await storage.createShelterApplicationForm({
          shelterId: userId,
          title: "Adoption Application",
          isDefault: true,
        });
      }

      // Get existing questions to determine position
      const existingQuestions = await storage.getShelterApplicationQuestions(form.id);
      const nextPosition = existingQuestions.length;

      const question = await storage.createShelterApplicationQuestion({
        formId: form.id,
        shelterId: userId,
        questionText: req.body.questionText,
        questionType: req.body.questionType || 'text',
        helperText: req.body.helperText || null,
        options: req.body.options || null,
        isRequired: req.body.isRequired ?? false,
        position: nextPosition,
        isActive: true,
      });

      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating shelter application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update a question
  app.patch('/api/shelter/application-questions/:questionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { questionId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify question belongs to this shelter
      const question = await storage.getShelterApplicationQuestion(questionId);
      if (!question || question.shelterId !== userId) {
        return res.status(404).json({ message: "Question not found" });
      }

      const updated = await storage.updateShelterApplicationQuestion(questionId, {
        questionText: req.body.questionText,
        questionType: req.body.questionType,
        helperText: req.body.helperText,
        options: req.body.options,
        isRequired: req.body.isRequired,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating shelter application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a question
  app.delete('/api/shelter/application-questions/:questionId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { questionId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify question belongs to this shelter
      const question = await storage.getShelterApplicationQuestion(questionId);
      if (!question || question.shelterId !== userId) {
        return res.status(404).json({ message: "Question not found" });
      }

      await storage.deleteShelterApplicationQuestion(questionId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting shelter application question:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reorder questions
  app.patch('/api/shelter/application-questions/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const form = await storage.getShelterApplicationForm(userId);
      if (!form) {
        return res.status(404).json({ message: "No application form found" });
      }

      const { questionIds } = req.body;
      if (!Array.isArray(questionIds)) {
        return res.status(400).json({ message: "questionIds must be an array" });
      }

      await storage.reorderShelterApplicationQuestions(form.id, questionIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering shelter application questions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER APPLICANT APPROVAL ROUTES (VAPI Phone Screening)
  // ============================================

  // Get all applications for this shelter's animals
  app.get('/api/shelter/applicants', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const status = req.query.status as string | undefined;
      const applications = await storage.getShelterApplications(userId, status);

      // Enrich with user and dog info
      const enrichedApplications = await Promise.all(applications.map(async (app) => {
        const applicant = await storage.getUser(app.userId);
        const applicantProfile = await storage.getUserProfile(app.userId);
        const dog = await storage.getDog(app.dogId);
        
        return {
          ...app,
          applicant: applicant ? {
            id: applicant.id,
            firstName: applicant.firstName,
            lastName: applicant.lastName,
            email: applicant.email,
            phone: applicantProfile?.phone,
            profileImageUrl: applicant.profileImageUrl,
          } : null,
          dog: dog ? {
            id: dog.id,
            name: dog.name,
            breed: dog.breed,
            imageUrl: dog.imageUrl,
          } : null,
        };
      }));

      res.json(enrichedApplications);
    } catch (error: any) {
      console.error("Error fetching shelter applications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get a single application with full details
  app.get('/api/shelter/applicants/:applicationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const application = await storage.getShelterApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify application is for this shelter's dog
      const dog = await storage.getDog(application.dogId);
      if (!dog || dog.shelterId !== userId) {
        return res.status(403).json({ message: "Application not found for this shelter" });
      }

      const applicant = await storage.getUser(application.userId);
      const applicantProfile = await storage.getUserProfile(application.userId);

      res.json({
        ...application,
        applicant: applicant ? {
          id: applicant.id,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          phone: applicantProfile?.phone,
          profileImageUrl: applicant.profileImageUrl,
        } : null,
        dog: dog ? {
          id: dog.id,
          name: dog.name,
          breed: dog.breed,
          imageUrl: dog.imageUrl,
          age: dog.age,
          gender: dog.gender,
        } : null,
      });
    } catch (error: any) {
      console.error("Error fetching shelter application:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve or reject an application
  app.post('/api/shelter/applicants/:applicationId/decision', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { status, notes, reason } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      if (!status || !['approved', 'rejected', 'more_info_needed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'approved', 'rejected', or 'more_info_needed'" });
      }

      const application = await storage.getShelterApplication(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify application is for this shelter's dog
      const dog = await storage.getDog(application.dogId);
      if (!dog || dog.shelterId !== userId) {
        return res.status(403).json({ message: "Application not found for this shelter" });
      }

      const updated = await storage.updateShelterApplicationStatus(applicationId, status, userId, notes, reason);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Upcoming vaccines for shelter
  app.get('/api/shelter/medical/vaccines/upcoming', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get dogs for this shelter
      const dogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = dogs.map(d => d.id);
      const dogMap = new Map(dogs.map(d => [d.id, d.name]));

      if (dogIds.length === 0) {
        return res.json([]);
      }

      // Get vaccine records with upcoming due dates
      const vaccineRecords = await db.select()
        .from(schema.medicalRecords)
        .where(sql`${schema.medicalRecords.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)}) AND ${schema.medicalRecords.recordType} = 'vaccine' AND ${schema.medicalRecords.nextDueDate} IS NOT NULL`)
        .orderBy(schema.medicalRecords.nextDueDate);

      const upcomingVaccines = vaccineRecords.map(v => ({
        id: v.id,
        dogId: v.dogId,
        dogName: dogMap.get(v.dogId) || 'Unknown',
        vaccineName: v.description || 'Vaccine',
        nextDueDate: v.nextDueDate,
      }));

      res.json(upcomingVaccines);
    } catch (error: any) {
      console.error("Error fetching upcoming vaccines:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // AI HEALTH SCREENING ENDPOINTS
  // ============================================

  // AI Health Screening - Analyze symptoms and/or images for health assessment
  app.post('/api/shelter/health-screening', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Check feature flag
      const healthScreeningFlag = await storage.getFeatureFlag('ai_health_screening');
      if (!healthScreeningFlag || !healthScreeningFlag.isEnabled) {
        return res.status(403).json({ message: "AI Health Screening feature is disabled" });
      }

      // Check plugin is enabled
      if (!isPluginEnabled()) {
        return res.status(503).json({ message: "Health screening plugin is not available" });
      }

      const { dogId, symptoms, images, screeningType, petIdentification } = req.body;

      if (!screeningType || !['symptom_check', 'image_analysis', 'full_assessment'].includes(screeningType)) {
        return res.status(400).json({ message: "Invalid screening type. Must be 'symptom_check', 'image_analysis', or 'full_assessment'" });
      }

      if (screeningType === 'symptom_check' && !symptoms) {
        return res.status(400).json({ message: "Symptoms are required for symptom check" });
      }

      if (screeningType === 'image_analysis' && (!images || images.length === 0)) {
        return res.status(400).json({ message: "At least one image is required for image analysis" });
      }

      if (screeningType === 'full_assessment' && !symptoms && (!images || images.length === 0)) {
        return res.status(400).json({ message: "Symptoms and/or images are required for full assessment" });
      }

      // Get dog info for context
      let dogContext = "";
      if (dogId) {
        const dog = await storage.getDog(dogId);
        if (dog) {
          dogContext = `
Dog Information:
- Name: ${dog.name}
- Breed: ${dog.breed}
- Age: ${dog.age} years
- Size: ${dog.size}
- Gender: ${dog.gender}
- Known conditions: ${dog.healthConditions?.join(', ') || 'None listed'}`;
        }
      }

      console.log(`[Health Screening] Running ${screeningType} analysis for dog ${dogId || 'unknown'}`);

      // Use plugin for AI analysis
      const result = await emitAnalyzeRequest({
        dogId: dogId || null,
        userId,
        screeningType,
        symptoms,
        images,
        dogContext,
        petIdentification,
      });

      // Save screening result to database
      const screeningResult = await storage.createHealthScreening({
        dogId: dogId || null,
        shelterId: userId,
        symptoms: symptoms || null,
        imageUrls: images ? images.map((_: string, i: number) => `image_${i + 1}`) : null,
        screeningType,
        severity: result.severity,
        recommendation: result.recommendation,
        aiAnalysis: result.analysis,
        conditions: result.conditions || null,
        careInstructions: result.careInstructions || null,
      });

      res.json({
        id: screeningResult.id,
        severity: result.severity,
        recommendation: result.recommendation,
        conditions: result.conditions || [],
        analysis: result.analysis,
        careInstructions: result.careInstructions,
        disclaimer: "This is an AI-powered preliminary screening. Always consult a licensed veterinarian for diagnosis and treatment.",
      });
    } catch (error: any) {
      console.error("[Health Screening] Error:", error);
      res.status(500).json({ message: "Failed to complete health screening", error: error.message });
    }
  });

  // Get health screening results for a shelter
  app.get('/api/shelter/health-screenings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { unreviewedOnly } = req.query;
      
      let results;
      if (unreviewedOnly === 'true') {
        results = await storage.getUnreviewedHealthScreenings(userId);
      } else {
        results = await storage.getHealthScreeningsByShelter(userId);
      }

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching health screenings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get health screening results for a specific dog
  app.get('/api/shelter/health-screenings/dog/:dogId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { dogId } = req.params;
      const results = await storage.getHealthScreeningsByDog(dogId);

      res.json(results);
    } catch (error: any) {
      console.error("Error fetching dog health screenings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Review a health screening result
  app.post('/api/shelter/health-screenings/:id/review', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { id } = req.params;
      const { reviewNotes, createMedicalRecord, medicalRecordData } = req.body;

      let medicalRecordId: string | undefined;

      // Optionally create a medical record from the screening
      if (createMedicalRecord && medicalRecordData) {
        const screening = await storage.getHealthScreening(id);
        if (screening && screening.dogId) {
          const medicalRecord = await storage.createMedicalRecord({
            dogId: screening.dogId,
            recordType: 'exam',
            title: 'AI Health Screening Follow-up',
            description: `AI Screening Results: ${screening.aiAnalysis}\n\nReview Notes: ${reviewNotes}`,
            veterinarian: medicalRecordData.veterinarian || null,
            performedAt: new Date(),
            ...medicalRecordData,
          });
          medicalRecordId = medicalRecord.id;
        }
      }

      const result = await storage.reviewHealthScreening(id, userId, reviewNotes, medicalRecordId);
      
      if (!result) {
        return res.status(404).json({ message: "Health screening not found" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error reviewing health screening:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Health Screening for Intake - Analyze photos during dog intake process
  app.post('/api/shelter/intake-health-screening', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("[Health Screening] Request from user:", userId);
      
      const user = await storage.getUser(userId);
      console.log("[Health Screening] User found:", user?.id, "Role:", user?.role);

      if (!user || user.role !== 'shelter') {
        console.log("[Health Screening] REJECTED: Not shelter role");
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify shelter profile exists and is approved
      const shelterProfile = await storage.getShelterProfile(userId);
      console.log("[Health Screening] Shelter profile:", shelterProfile?.id, "Status:", shelterProfile?.approvalStatus);
      
      if (!shelterProfile) {
        console.log("[Health Screening] REJECTED: No shelter profile");
        return res.status(404).json({ message: "Shelter profile not found. Please complete shelter registration." });
      }
      
      // Ensure shelter is approved before allowing AI features
      if (shelterProfile.approvalStatus !== 'approved') {
        console.log("[Health Screening] REJECTED: Shelter not approved, status:", shelterProfile.approvalStatus);
        return res.status(403).json({ message: "Shelter must be approved to use AI health screening features." });
      }

      // Check feature flag
      const healthScreeningFlag = await storage.getFeatureFlag('ai_health_screening');
      console.log("[Health Screening] Feature flag:", healthScreeningFlag?.isEnabled);
      
      if (!healthScreeningFlag || !healthScreeningFlag.isEnabled) {
        console.log("[Health Screening] REJECTED: Feature disabled");
        return res.status(403).json({ message: "AI Health Screening feature is disabled" });
      }

      const { dogId, intakeRecordId, photos, concerns } = req.body;

      if (!dogId) {
        return res.status(400).json({ message: "Dog ID is required" });
      }

      // Support both old photos object format and new concerns array format
      const capturedBodyParts: string[] = [];
      const photoEntries: { area: string; image: string; description?: string }[] = [];
      
      // New flexible concerns array format
      if (concerns && Array.isArray(concerns) && concerns.length > 0) {
        for (const concern of concerns) {
          if (concern.photo && concern.bodyArea) {
            capturedBodyParts.push(concern.bodyArea);
            photoEntries.push({ 
              area: concern.bodyArea, 
              image: concern.photo,
              description: concern.description || undefined
            });
          }
        }
      }
      // Legacy fixed photos object format (backward compatibility)
      else if (photos && typeof photos === 'object') {
        for (const [area, imageData] of Object.entries(photos)) {
          if (imageData && typeof imageData === 'string' && imageData.startsWith('data:')) {
            capturedBodyParts.push(area);
            photoEntries.push({ area, image: imageData as string });
          }
        }
      }

      if (capturedBodyParts.length === 0) {
        return res.status(400).json({ message: "At least one photo or concern is required" });
      }

      // Get dog info for context and verify ownership
      const dog = await storage.getDog(dogId);
      if (!dog) {
        return res.status(404).json({ message: "Dog not found" });
      }
      
      // Verify the dog belongs to this shelter via shelterId
      if (dog.shelterId !== shelterProfile.id) {
        return res.status(403).json({ message: "Access denied. This pet does not belong to your shelter." });
      }

      // Validate intake record belongs to this dog and shelter if provided
      if (intakeRecordId) {
        const [intakeRecord] = await db.select()
          .from(schema.intakeRecords)
          .where(eq(schema.intakeRecords.id, intakeRecordId));
        // Check shelterId matches either shelter profile ID or user ID for compatibility
        if (!intakeRecord || intakeRecord.dogId !== dogId || 
            (intakeRecord.shelterId !== shelterProfile.id && intakeRecord.shelterId !== userId)) {
          return res.status(400).json({ message: "Invalid intake record. The intake record must belong to this pet and shelter." });
        }
      }

      const dogContext = `
Dog Information:
- Name: ${dog.name}
- Breed: ${dog.breed}
- Age: ${dog.age} years
- Size: ${dog.size}
- Known conditions: ${dog.specialNeeds || 'None listed'}`;

      if (!isPluginEnabled()) {
        return res.status(503).json({ message: "Health screening plugin is not available" });
      }

      console.log(`[Intake Health Screening] Running analysis for dog ${dogId} with ${capturedBodyParts.length} photos`);

      const result = await emitAnalyzeRequest({
        dogId,
        userId,
        screeningType: 'intake_health_snapshot',
        dogContext,
        capturedBodyParts,
        photoEntries,
        intakeRecordId: intakeRecordId || undefined,
      });

      console.log(`[Intake Health Screening] Analysis complete - Severity: ${result.severity}, Recommendation: ${result.recommendation}`);

      // Save screening result to database
      const screeningResult = await storage.createHealthScreening({
        dogId,
        shelterId: userId,
        intakeRecordId: intakeRecordId || null,
        symptoms: null,
        imageUrls: capturedBodyParts.map(area => `intake_${area}`),
        screeningType: 'intake_health_snapshot',
        capturedBodyParts,
        severity: result.severity,
        recommendation: result.recommendation,
        aiAnalysis: result.analysis,
        conditions: result.conditions || null,
        careInstructions: result.careInstructions || null,
      });

      // Auto-create medical records for moderate/high/critical concerns via plugin
      const createdMedicalRecords = await getCreatedMedicalRecordsSync(
        dogId,
        userId,
        screeningResult.id,
        result
      );

      res.json({
        id: screeningResult.id,
        severity: result.severity,
        recommendation: result.recommendation,
        conditions: result.conditions || [],
        analysis: result.analysis,
        careInstructions: result.careInstructions,
        concernsByArea: result.concernsByArea || [],
        medicalRecordsCreated: createdMedicalRecords.length,
        medicalRecords: createdMedicalRecords,
        disclaimer: "This is an AI-powered preliminary screening. Always consult a licensed veterinarian for diagnosis and treatment.",
      });
    } catch (error: any) {
      console.error("[Intake Health Screening] Error:", error);
      res.status(500).json({ message: "Failed to complete intake health screening", error: error.message });
    }
  });

  // ============================================
  // TREATMENT PLANS API
  // ============================================

  // Get all treatment plans for the shelter
  app.get('/api/shelter/treatment-plans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const plans = await db.select()
        .from(schema.treatmentPlans)
        .where(eq(schema.treatmentPlans.shelterId, userId))
        .orderBy(desc(schema.treatmentPlans.createdAt));

      // Get dog info for each plan
      const dogIds = [...new Set(plans.map(p => p.dogId))];
      let dogs: any[] = [];
      if (dogIds.length > 0) {
        dogs = await db.select()
          .from(schema.dogs)
          .where(sql`${schema.dogs.id} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }
      const dogMap = new Map(dogs.map(d => [d.id, d]));

      const plansWithDogs = plans.map(plan => ({
        ...plan,
        dog: dogMap.get(plan.dogId) || null,
      }));

      res.json(plansWithDogs);
    } catch (error: any) {
      console.error("Error fetching treatment plans:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get treatment plan by ID with entries
  app.get('/api/shelter/treatment-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { id } = req.params;
      const [plan] = await db.select()
        .from(schema.treatmentPlans)
        .where(and(
          eq(schema.treatmentPlans.id, id),
          eq(schema.treatmentPlans.shelterId, userId)
        ));

      if (!plan) {
        return res.status(404).json({ message: "Treatment plan not found" });
      }

      // Get entries for this plan
      const entries = await db.select()
        .from(schema.treatmentEntries)
        .where(eq(schema.treatmentEntries.treatmentPlanId, id))
        .orderBy(schema.treatmentEntries.createdAt);

      // Get dog info
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, plan.dogId));

      res.json({
        ...plan,
        dog: dog || null,
        entries,
      });
    } catch (error: any) {
      console.error("Error fetching treatment plan:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create treatment plan
  app.post('/api/shelter/treatment-plans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { dogId, healthScreeningId, title, description, condition, goal, priority, assignedTo, startDate, targetEndDate } = req.body;

      if (!dogId || !title) {
        return res.status(400).json({ message: "Dog ID and title are required" });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const [newPlan] = await db.insert(schema.treatmentPlans)
        .values({
          dogId,
          shelterId: userId,
          healthScreeningId: healthScreeningId || null,
          title,
          description: description || null,
          condition: condition || null,
          goal: goal || null,
          priority: priority || 'normal',
          status: 'active',
          assignedTo: assignedTo || null,
          startDate: startDate ? new Date(startDate) : new Date(),
          targetEndDate: targetEndDate ? new Date(targetEndDate) : null,
          createdBy: userId,
        })
        .returning();

      res.status(201).json(newPlan);
    } catch (error: any) {
      console.error("Error creating treatment plan:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update treatment plan
  app.patch('/api/shelter/treatment-plans/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { id } = req.params;
      const [existingPlan] = await db.select()
        .from(schema.treatmentPlans)
        .where(and(
          eq(schema.treatmentPlans.id, id),
          eq(schema.treatmentPlans.shelterId, userId)
        ));

      if (!existingPlan) {
        return res.status(404).json({ message: "Treatment plan not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.condition !== undefined) updateData.condition = req.body.condition;
      if (req.body.goal !== undefined) updateData.goal = req.body.goal;
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
        if (req.body.status === 'completed') {
          updateData.completedAt = new Date();
        }
      }
      if (req.body.assignedTo !== undefined) updateData.assignedTo = req.body.assignedTo;
      if (req.body.targetEndDate !== undefined) updateData.targetEndDate = req.body.targetEndDate ? new Date(req.body.targetEndDate) : null;

      const [updatedPlan] = await db.update(schema.treatmentPlans)
        .set(updateData)
        .where(eq(schema.treatmentPlans.id, id))
        .returning();

      res.json(updatedPlan);
    } catch (error: any) {
      console.error("Error updating treatment plan:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add treatment entry
  app.post('/api/shelter/treatment-plans/:planId/entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { planId } = req.params;
      const [plan] = await db.select()
        .from(schema.treatmentPlans)
        .where(and(
          eq(schema.treatmentPlans.id, planId),
          eq(schema.treatmentPlans.shelterId, userId)
        ));

      if (!plan) {
        return res.status(404).json({ message: "Treatment plan not found" });
      }

      const { entryType, title, description, medicationName, dosage, frequency, scheduledDate, dueDate, cost } = req.body;

      if (!entryType || !title) {
        return res.status(400).json({ message: "Entry type and title are required" });
      }

      const [newEntry] = await db.insert(schema.treatmentEntries)
        .values({
          treatmentPlanId: planId,
          entryType,
          title,
          description: description || null,
          medicationName: medicationName || null,
          dosage: dosage || null,
          frequency: frequency || null,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
          dueDate: dueDate ? new Date(dueDate) : null,
          cost: cost || null,
          status: 'pending',
          createdBy: userId,
        })
        .returning();

      res.status(201).json(newEntry);
    } catch (error: any) {
      console.error("Error creating treatment entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Complete treatment entry
  app.patch('/api/shelter/treatment-entries/:entryId/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { entryId } = req.params;
      const { completionNotes } = req.body;

      // Verify entry belongs to shelter's plan
      const [entry] = await db.select()
        .from(schema.treatmentEntries)
        .where(eq(schema.treatmentEntries.id, entryId));

      if (!entry) {
        return res.status(404).json({ message: "Treatment entry not found" });
      }

      const [plan] = await db.select()
        .from(schema.treatmentPlans)
        .where(and(
          eq(schema.treatmentPlans.id, entry.treatmentPlanId),
          eq(schema.treatmentPlans.shelterId, userId)
        ));

      if (!plan) {
        return res.status(404).json({ message: "Treatment plan not found" });
      }

      const [updatedEntry] = await db.update(schema.treatmentEntries)
        .set({
          status: 'completed',
          completedAt: new Date(),
          completedBy: userId,
          completionNotes: completionNotes || null,
        })
        .where(eq(schema.treatmentEntries.id, entryId))
        .returning();

      res.json(updatedEntry);
    } catch (error: any) {
      console.error("Error completing treatment entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // VET REFERRALS API
  // ============================================

  // Get all vet referrals for the shelter
  app.get('/api/shelter/vet-referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const referrals = await db.select()
        .from(schema.vetReferrals)
        .where(eq(schema.vetReferrals.shelterId, userId))
        .orderBy(desc(schema.vetReferrals.createdAt));

      // Get dog info for each referral
      const dogIds = [...new Set(referrals.map(r => r.dogId))];
      let dogs: any[] = [];
      if (dogIds.length > 0) {
        dogs = await db.select()
          .from(schema.dogs)
          .where(sql`${schema.dogs.id} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`);
      }
      const dogMap = new Map(dogs.map(d => [d.id, d]));

      const referralsWithDogs = referrals.map(referral => ({
        ...referral,
        dog: dogMap.get(referral.dogId) || null,
      }));

      res.json(referralsWithDogs);
    } catch (error: any) {
      console.error("Error fetching vet referrals:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create vet referral
  app.post('/api/shelter/vet-referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { 
        dogId, healthScreeningId, treatmentPlanId, 
        reason, urgency, symptoms, aiAnalysisSummary,
        vetClinicName, vetName, vetPhone, vetEmail, vetAddress,
        appointmentDate, appointmentNotes
      } = req.body;

      if (!dogId || !reason) {
        return res.status(400).json({ message: "Dog ID and reason are required" });
      }

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      const [newReferral] = await db.insert(schema.vetReferrals)
        .values({
          dogId,
          shelterId: userId,
          healthScreeningId: healthScreeningId || null,
          treatmentPlanId: treatmentPlanId || null,
          reason,
          urgency: urgency || 'routine',
          symptoms: symptoms || null,
          aiAnalysisSummary: aiAnalysisSummary || null,
          vetClinicName: vetClinicName || null,
          vetName: vetName || null,
          vetPhone: vetPhone || null,
          vetEmail: vetEmail || null,
          vetAddress: vetAddress || null,
          appointmentDate: appointmentDate ? new Date(appointmentDate) : null,
          appointmentNotes: appointmentNotes || null,
          status: appointmentDate ? 'scheduled' : 'pending',
          createdBy: userId,
        })
        .returning();

      res.status(201).json(newReferral);
    } catch (error: any) {
      console.error("Error creating vet referral:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update vet referral
  app.patch('/api/shelter/vet-referrals/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const { id } = req.params;
      const [existingReferral] = await db.select()
        .from(schema.vetReferrals)
        .where(and(
          eq(schema.vetReferrals.id, id),
          eq(schema.vetReferrals.shelterId, userId)
        ));

      if (!existingReferral) {
        return res.status(404).json({ message: "Vet referral not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      
      // Status and scheduling
      if (req.body.status !== undefined) {
        updateData.status = req.body.status;
        if (req.body.status === 'completed') {
          updateData.completedAt = new Date();
        }
      }
      if (req.body.appointmentDate !== undefined) updateData.appointmentDate = req.body.appointmentDate ? new Date(req.body.appointmentDate) : null;
      if (req.body.appointmentNotes !== undefined) updateData.appointmentNotes = req.body.appointmentNotes;
      
      // Vet info
      if (req.body.vetClinicName !== undefined) updateData.vetClinicName = req.body.vetClinicName;
      if (req.body.vetName !== undefined) updateData.vetName = req.body.vetName;
      if (req.body.vetPhone !== undefined) updateData.vetPhone = req.body.vetPhone;
      if (req.body.vetEmail !== undefined) updateData.vetEmail = req.body.vetEmail;
      if (req.body.vetAddress !== undefined) updateData.vetAddress = req.body.vetAddress;
      
      // Outcome
      if (req.body.diagnosisFromVet !== undefined) updateData.diagnosisFromVet = req.body.diagnosisFromVet;
      if (req.body.treatmentFromVet !== undefined) updateData.treatmentFromVet = req.body.treatmentFromVet;
      if (req.body.followUpRequired !== undefined) updateData.followUpRequired = req.body.followUpRequired;
      if (req.body.followUpNotes !== undefined) updateData.followUpNotes = req.body.followUpNotes;
      if (req.body.cost !== undefined) updateData.cost = req.body.cost;

      const [updatedReferral] = await db.update(schema.vetReferrals)
        .set(updateData)
        .where(eq(schema.vetReferrals.id, id))
        .returning();

      res.json(updatedReferral);
    } catch (error: any) {
      console.error("Error updating vet referral:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create intake record for a dog
  app.post('/api/shelter/intake', isAuthenticated, async (req: any, res) => {
    console.log("[Shelter Intake] POST /api/shelter/intake called with body:", JSON.stringify(req.body));
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      const { 
        dogId, 
        pipelineStatus,
        intakeType,
        intakeReason,
        sourceInfo,
        initialCondition,
        initialWeight,
        initialNotes,
        holdType,
        holdExpiresAt,
        holdNotes
      } = req.body;

      // Verify dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(404).json({ message: "Dog not found" });
      }

      // Check if intake record already exists
      const [existingIntake] = await db.select()
        .from(schema.intakeRecords)
        .where(eq(schema.intakeRecords.dogId, dogId));

      if (existingIntake) {
        // Update existing record with all provided fields
        const updateData: any = {};
        if (pipelineStatus !== undefined) updateData.pipelineStatus = pipelineStatus;
        if (intakeType !== undefined) updateData.intakeType = intakeType;
        if (intakeReason !== undefined) updateData.intakeReason = intakeReason;
        if (sourceInfo !== undefined) updateData.sourceInfo = sourceInfo;
        if (initialCondition !== undefined) updateData.initialCondition = initialCondition;
        if (initialWeight !== undefined) updateData.initialWeight = initialWeight;
        if (initialNotes !== undefined) updateData.initialNotes = initialNotes;
        if (holdType !== undefined) updateData.holdType = holdType;
        if (holdExpiresAt !== undefined) updateData.holdExpiresAt = new Date(holdExpiresAt);
        if (holdNotes !== undefined) updateData.holdNotes = holdNotes;

        const [updatedIntake] = await db.update(schema.intakeRecords)
          .set(updateData)
          .where(eq(schema.intakeRecords.id, existingIntake.id))
          .returning();

        // Sync hold status to dog profile
        const dogUpdateData: any = {};
        if (holdType !== undefined) dogUpdateData.holdType = holdType || null;
        if (holdExpiresAt !== undefined) dogUpdateData.holdExpiresAt = holdExpiresAt ? new Date(holdExpiresAt) : null;
        if (holdNotes !== undefined) dogUpdateData.holdNotes = holdNotes || null;

        if (Object.keys(dogUpdateData).length > 0) {
          await db.update(schema.dogs)
            .set(dogUpdateData)
            .where(eq(schema.dogs.id, dogId));
          console.log(`[Intake] Synced hold status to dog ${dogId}:`, dogUpdateData);
        }

        return res.json(updatedIntake);
      }

      // Create new intake record with all provided fields
      const [newIntake] = await db.insert(schema.intakeRecords)
        .values({
          dogId,
          shelterId: shelterProfile.id,
          intakeDate: new Date(),
          intakeType: intakeType || 'owner_surrender',
          intakeReason: intakeReason || null,
          sourceInfo: sourceInfo || null,
          initialCondition: initialCondition || 'good',
          initialWeight: initialWeight ? parseInt(initialWeight) : null,
          initialNotes: initialNotes || null,
          pipelineStatus: pipelineStatus || 'intake',
          holdType: holdType || null,
          holdExpiresAt: holdExpiresAt ? new Date(holdExpiresAt) : null,
          holdNotes: holdNotes || null,
        })
        .returning();

      // Sync hold status to dog profile on new intake creation
      if (holdType || holdExpiresAt || holdNotes) {
        await db.update(schema.dogs)
          .set({
            holdType: holdType || null,
            holdExpiresAt: holdExpiresAt ? new Date(holdExpiresAt) : null,
            holdNotes: holdNotes || null,
          })
          .where(eq(schema.dogs.id, dogId));
        console.log(`[Intake] Synced initial hold status to dog ${dogId}`);
      }

      // Emit intake created event for automations
      eventBus.emit('dog.intake_created', {
        dogId,
        shelterId: shelterProfile.id,
        intakeRecordId: newIntake.id,
        pipelineStatus: newIntake.pipelineStatus || 'intake',
      });

      res.json(newIntake);
    } catch (error: any) {
      console.error("Error creating intake record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update intake record (for pipeline status changes)
  app.patch('/api/shelter/intake/:intakeId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { intakeId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const shelterProfile = await storage.getShelterProfile(userId);
      if (!shelterProfile) {
        return res.status(404).json({ message: "Shelter profile not found" });
      }

      // Get the intake record
      const [intake] = await db.select()
        .from(schema.intakeRecords)
        .where(eq(schema.intakeRecords.id, intakeId));

      if (!intake) {
        return res.status(404).json({ message: "Intake record not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, intake.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Update the intake record
      const updateData: any = {};
      if (req.body.pipelineStatus !== undefined) updateData.pipelineStatus = req.body.pipelineStatus;
      if (req.body.intakeType !== undefined) updateData.intakeType = req.body.intakeType;
      if (req.body.intakeNotes !== undefined) updateData.intakeNotes = req.body.intakeNotes;
      if (req.body.strayHoldEndDate !== undefined) updateData.strayHoldEndDate = req.body.strayHoldEndDate;
      if (req.body.holdType !== undefined) updateData.holdType = req.body.holdType;
      if (req.body.holdExpiresAt !== undefined) updateData.holdExpiresAt = req.body.holdExpiresAt ? new Date(req.body.holdExpiresAt) : null;
      if (req.body.holdNotes !== undefined) updateData.holdNotes = req.body.holdNotes;

      const previousStatus = intake.pipelineStatus;
      
      const [updatedIntake] = await db.update(schema.intakeRecords)
        .set(updateData)
        .where(eq(schema.intakeRecords.id, intakeId))
        .returning();

      // Emit status change event for automations if status changed
      if (req.body.pipelineStatus !== undefined && req.body.pipelineStatus !== previousStatus) {
        const shelterProfile = await storage.getShelterProfile(userId);
        if (shelterProfile) {
          eventBus.emit('dog.status_changed', {
            dogId: intake.dogId,
            shelterId: shelterProfile.id,
            previousStatus: previousStatus || 'intake',
            newStatus: req.body.pipelineStatus,
          });
        }
        
        // Auto-complete stage-related tasks when pipeline moves
        // Find pending tasks related to the previous stage and mark them complete
        const stageTaskTypes: Record<string, string[]> = {
          'intake': ['admin', 'custom'],
          'stray_hold': ['admin', 'custom'],
          'medical_hold': ['medical', 'vaccine'],
          'behavior_eval': ['behavior_eval'],
          'pre_adoption_hold': ['admin', 'custom'],
        };
        
        const taskTypesToComplete = stageTaskTypes[previousStatus || ''] || [];
        if (taskTypesToComplete.length > 0) {
          // Complete tasks related to the stage we're leaving
          const pendingStageTasks = await db.select()
            .from(schema.shelterTasks)
            .where(and(
              eq(schema.shelterTasks.dogId, intake.dogId),
              eq(schema.shelterTasks.shelterId, userId),
              eq(schema.shelterTasks.status, 'pending'),
              inArray(schema.shelterTasks.taskType, taskTypesToComplete)
            ));
          
          for (const task of pendingStageTasks) {
            await db.update(schema.shelterTasks)
              .set({
                status: 'completed',
                completedAt: new Date(),
                completedBy: userId,
                completionNotes: `Auto-completed: Pipeline moved from ${previousStatus} to ${req.body.pipelineStatus}`,
                updatedAt: new Date(),
              })
              .where(eq(schema.shelterTasks.id, task.id));
            
            // Log automation run for explainability
            await db.insert(schema.automationRuns).values({
              shelterId: userId,
              triggerType: 'pipeline_moved',
              triggerEvent: `${dog.name} moved from ${previousStatus} to ${req.body.pipelineStatus}`,
              targetType: 'task',
              targetId: task.id,
              dogId: intake.dogId,
              actionType: 'auto_complete_task',
              actionDescription: `Completed task "${task.title}" for ${dog.name}`,
              result: 'success',
            });
          }
        }
        
        // Log dog event for timeline
        await db.insert(schema.dogEvents).values({
          dogId: intake.dogId,
          shelterId: userId,
          eventType: 'PIPELINE_MOVED',
          description: `Moved from ${previousStatus || 'intake'} to ${req.body.pipelineStatus}`,
          payload: {
            previousStatus: previousStatus || 'intake',
            newStatus: req.body.pipelineStatus,
          },
          actorType: 'user',
          actorId: userId,
        });
      }

      // Sync hold status to dog profile
      const dogUpdateData: any = {};
      if (req.body.holdType !== undefined) dogUpdateData.holdType = req.body.holdType || null;
      if (req.body.holdExpiresAt !== undefined) dogUpdateData.holdExpiresAt = req.body.holdExpiresAt ? new Date(req.body.holdExpiresAt) : null;
      if (req.body.holdNotes !== undefined) dogUpdateData.holdNotes = req.body.holdNotes || null;

      if (Object.keys(dogUpdateData).length > 0) {
        await db.update(schema.dogs)
          .set(dogUpdateData)
          .where(eq(schema.dogs.id, intake.dogId));
        console.log(`[Intake] Synced hold status to dog ${intake.dogId}:`, dogUpdateData);
      }

      // Log hold changes to dog events
      if (req.body.holdType !== undefined && req.body.holdType !== intake.holdType) {
        const holdEventType = req.body.holdType ? 'HOLD_STARTED' : 'HOLD_ENDED';
        await db.insert(schema.dogEvents).values({
          dogId: intake.dogId,
          shelterId: userId,
          eventType: holdEventType,
          description: req.body.holdType 
            ? `Hold started: ${req.body.holdType}${req.body.holdNotes ? ` - ${req.body.holdNotes}` : ''}`
            : `Hold ended (was: ${intake.holdType})`,
          payload: {
            previousHoldType: intake.holdType,
            newHoldType: req.body.holdType,
            holdNotes: req.body.holdNotes,
          },
          actorType: 'user',
          actorId: userId,
        });
      }

      // Auto-advance pipeline when hold is explicitly cleared (transition from active → cleared)
      const wasOnHold = intake.holdType !== null && intake.holdType !== '';
      const isNowCleared = req.body.holdType === null || req.body.holdType === '';
      
      if (wasOnHold && isNowCleared) {
        // Hold is being lifted - check if we should auto-advance to next stage
        const currentStatus = updatedIntake.pipelineStatus;
        if (currentStatus === 'medical_hold' || currentStatus === 'intake') {
          // Auto-advance to behavior_eval if hold is lifted
          await db.update(schema.intakeRecords)
            .set({ pipelineStatus: 'behavior_eval', pipelineStatusChangedAt: new Date() })
            .where(eq(schema.intakeRecords.id, intakeId));
          console.log(`[Intake] Auto-advanced dog ${intake.dogId} from ${currentStatus} to behavior_eval after hold cleared`);
        }
      }

      res.json(updatedIntake);
    } catch (error: any) {
      console.error("Error updating intake record:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER INBOX ROUTES (Conversations & Applications)
  // ============================================

  // Unified inbox endpoint - merges applications and conversations
  app.get('/api/shelter/inbox', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type, status: filterStatus, limit: limitStr } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const limit = limitStr ? parseInt(limitStr as string) : 50;
      const inboxItems: any[] = [];

      // Get all dogs belonging to this shelter
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);
      const dogMap = new Map(shelterDogs.map(d => [d.id, d]));

      if (dogIds.length === 0) {
        return res.json([]);
      }

      // 1. Get applications (adoption journeys)
      if (!type || type === 'application') {
        const journeys = await db.select()
          .from(schema.adoptionJourneys)
          .where(inArray(schema.adoptionJourneys.dogId, dogIds));

        for (const journey of journeys) {
          // Filter by status if requested
          if (filterStatus && journey.status !== filterStatus) continue;

          const dog = dogMap.get(journey.dogId);
          const [applicant] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.id, journey.userId));

          inboxItems.push({
            id: journey.id,
            type: 'application',
            dogId: journey.dogId,
            dogName: dog?.name || 'Unknown',
            dogPhoto: dog?.photos?.[0] || null,
            applicantId: journey.userId,
            applicantName: applicant ? `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() : 'Unknown',
            applicantEmail: applicant?.email || null,
            status: journey.status,
            currentStep: journey.currentStep,
            priority: journey.status === 'pending' ? 'high' : 'normal',
            unreadCount: 0, // Applications don't have unread per se
            snippet: `${journey.currentStep} - ${journey.status}`,
            lastActivityAt: journey.updatedAt || journey.createdAt,
            createdAt: journey.createdAt,
          });
        }
      }

      // 2. Get conversations
      if (!type || type === 'conversation') {
        const conversations = await db.select()
          .from(schema.conversations)
          .where(inArray(schema.conversations.dogId, dogIds));

        for (const conv of conversations) {
          const dog = dogMap.get(conv.dogId);
          const [adopter] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.id, conv.userId));

          const messages = await storage.getConversationMessages(conv.id);
          const lastMessage = messages[messages.length - 1];
          const unreadCount = messages.filter(m => m.senderId !== userId && !m.isRead).length;

          // Filter by status if requested (for conversations, use unread as 'pending')
          if (filterStatus === 'pending' && unreadCount === 0) continue;
          if (filterStatus === 'read' && unreadCount > 0) continue;

          inboxItems.push({
            id: conv.id,
            type: 'conversation',
            dogId: conv.dogId,
            dogName: dog?.name || 'Unknown',
            dogPhoto: dog?.photos?.[0] || null,
            applicantId: conv.userId,
            applicantName: adopter ? `${adopter.firstName || ''} ${adopter.lastName || ''}`.trim() : 'Unknown',
            applicantEmail: adopter?.email || null,
            status: unreadCount > 0 ? 'unread' : 'read',
            priority: unreadCount > 0 ? 'high' : 'normal',
            unreadCount,
            snippet: lastMessage?.content?.substring(0, 100) || 'No messages yet',
            lastActivityAt: lastMessage?.timestamp || conv.createdAt,
            createdAt: conv.createdAt,
          });
        }
      }

      // 3. Get automation runs as system notifications (last 10)
      if (!type || type === 'system') {
        const recentAutomations = await db.select()
          .from(schema.automationRuns)
          .where(eq(schema.automationRuns.shelterId, userId))
          .orderBy(desc(schema.automationRuns.createdAt))
          .limit(10);

        for (const run of recentAutomations) {
          const dog = run.dogId ? dogMap.get(run.dogId) : null;

          inboxItems.push({
            id: run.id,
            type: 'system',
            dogId: run.dogId || null,
            dogName: dog?.name || null,
            dogPhoto: dog?.photos?.[0] || null,
            applicantId: null,
            applicantName: 'System',
            applicantEmail: null,
            status: run.result,
            priority: run.result === 'failed' ? 'high' : 'low',
            unreadCount: 0,
            snippet: run.actionDescription,
            lastActivityAt: run.createdAt,
            createdAt: run.createdAt,
          });
        }
      }

      // Sort by lastActivityAt descending
      inboxItems.sort((a, b) => {
        const dateA = new Date(a.lastActivityAt || a.createdAt).getTime();
        const dateB = new Date(b.lastActivityAt || b.createdAt).getTime();
        return dateB - dateA;
      });

      res.json(inboxItems.slice(0, limit));
    } catch (error: any) {
      console.error("Error fetching unified inbox:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all conversations for a shelter
  app.get('/api/shelter/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get all dogs belonging to this shelter
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);
      const dogMap = new Map(shelterDogs.map(d => [d.id, d]));

      if (dogIds.length === 0) {
        return res.json([]);
      }

      // Get all conversations for these dogs
      const conversations = await db.select()
        .from(schema.conversations)
        .where(inArray(schema.conversations.dogId, dogIds));

      // Enrich with dog details and last message
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const dog = dogMap.get(conv.dogId);
          const messages = await storage.getConversationMessages(conv.id);
          const lastMessage = messages[messages.length - 1];

          // Get adopter user info
          const [adopter] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.id, conv.userId));

          // Count unread messages for shelter
          const unreadCount = messages.filter(m => 
            m.senderId !== userId && !m.isRead
          ).length;

          return {
            ...conv,
            dog: dog || null,
            applicant: adopter || null,
            lastMessage: lastMessage?.content || null,
            unreadCount,
          };
        })
      );

      res.json(enrichedConversations);
    } catch (error: any) {
      console.error("Error fetching shelter conversations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get unread count for shelter conversations
  app.get('/api/shelter/conversations/unread/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.json({ count: 0 });
      }

      // Get all dogs belonging to this shelter
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);

      if (dogIds.length === 0) {
        return res.json({ count: 0 });
      }

      // Get all conversations for these dogs
      const conversations = await db.select()
        .from(schema.conversations)
        .where(inArray(schema.conversations.dogId, dogIds));

      // Count unread messages across all conversations
      let totalUnread = 0;
      for (const conv of conversations) {
        const messages = await storage.getConversationMessages(conv.id);
        totalUnread += messages.filter(m => 
          m.senderId !== userId && !m.isRead
        ).length;
      }

      res.json({ count: totalUnread });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.json({ count: 0 });
    }
  });

  // Get pending applications count for shelter
  app.get('/api/shelter/applications/pending/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.json({ count: 0 });
      }

      // Get all dogs belonging to this shelter
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);

      if (dogIds.length === 0) {
        return res.json({ count: 0 });
      }

      // Count pending applications (journeys in early stages - application and phone_screening)
      const [result] = await db.select({
        count: sql<number>`count(*)`
      })
        .from(schema.adoptionJourneys)
        .where(and(
          inArray(schema.adoptionJourneys.dogId, dogIds),
          inArray(schema.adoptionJourneys.currentStep, ['application', 'phone_screening']),
          eq(schema.adoptionJourneys.status, 'active')
        ));

      res.json({ count: result?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching pending applications count:", error);
      res.json({ count: 0 });
    }
  });

  // Get pending tasks count for shelter
  app.get('/api/shelter/tasks/pending/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.json({ count: 0 });
      }

      const [result] = await db.select({
        count: sql<number>`count(*)`
      })
        .from(schema.shelterTasks)
        .where(and(
          eq(schema.shelterTasks.shelterId, userId),
          eq(schema.shelterTasks.status, 'pending')
        ));

      res.json({ count: result?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching pending tasks count:", error);
      res.json({ count: 0 });
    }
  });

  // Get urgent dogs count for shelter
  app.get('/api/shelter/dogs/urgent/count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.json({ count: 0 });
      }

      const [result] = await db.select({
        count: sql<number>`count(*)`
      })
        .from(schema.dogs)
        .where(and(
          eq(schema.dogs.userId, userId),
          inArray(schema.dogs.urgencyLevel, ['urgent', 'critical'])
        ));

      res.json({ count: result?.count || 0 });
    } catch (error: any) {
      console.error("Error fetching urgent dogs count:", error);
      res.json({ count: 0 });
    }
  });

  // Get all applications for a shelter's dogs
  app.get('/api/shelter/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dogId: filterDogId } = req.query; // Optional filter by specific dog
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get all dogs belonging to this shelter (or just the specific dog if filtering)
      const shelterDogs = await db.select()
        .from(schema.dogs)
        .where(filterDogId 
          ? and(eq(schema.dogs.userId, userId), eq(schema.dogs.id, filterDogId as string))
          : eq(schema.dogs.userId, userId));

      const dogIds = shelterDogs.map(d => d.id);
      const dogMap = new Map(shelterDogs.map(d => [d.id, d]));

      if (dogIds.length === 0) {
        return res.json([]);
      }

      // Get all adoption journeys for these dogs
      // Show all applications for the shelter's dogs (regardless of eligibility status)
      const journeys = await db.select()
        .from(schema.adoptionJourneys)
        .where(inArray(schema.adoptionJourneys.dogId, dogIds));

      // Enrich with dog and user details
      const enrichedJourneys = await Promise.all(
        journeys.map(async (journey) => {
          const dog = dogMap.get(journey.dogId);

          // Get applicant user info
          const [applicant] = await db.select()
            .from(schema.users)
            .where(eq(schema.users.id, journey.userId));

          // Get user profile
          const [profile] = await db.select()
            .from(schema.userProfiles)
            .where(eq(schema.userProfiles.userId, journey.userId));

          // Get family members
          const familyMembers = await db.select()
            .from(schema.familyMembers)
            .where(eq(schema.familyMembers.userId, journey.userId));

          // Get household pets
          const householdPets = await db.select()
            .from(schema.householdPets)
            .where(eq(schema.householdPets.userId, journey.userId));

          return {
            ...journey,
            dog: dog || null,
            user: applicant ? { 
              id: applicant.id, 
              firstName: applicant.firstName, 
              lastName: applicant.lastName, 
              email: applicant.email 
            } : null,
            userProfile: profile || null,
            familyMembers: familyMembers || [],
            householdPets: householdPets || [],
          };
        })
      );

      res.json(enrichedJourneys);
    } catch (error: any) {
      console.error("Error fetching shelter applications:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update application status with proper journey flow management
  app.patch('/api/shelter/applications/:applicationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { status, advanceStep } = req.body; // advanceStep: optional boolean to also advance the journey
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get the journey
      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Build update object based on status and current step
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      // Journey step progression logic
      // The journey flow: application → phone_screening → meet_greet → adoption → completed
      const stepOrder = ['application', 'phone_screening', 'meet_greet', 'adoption'];
      const currentStepIndex = stepOrder.indexOf(journey.currentStep);

      // If shelter explicitly requests to advance the step, or if completing certain milestones
      if (advanceStep && currentStepIndex < stepOrder.length - 1) {
        const nextStep = stepOrder[currentStepIndex + 1];
        updateData.currentStep = nextStep;

        // Mark the current step as completed based on what step we're moving from
        if (journey.currentStep === 'application') {
          updateData.applicationSubmittedAt = journey.applicationSubmittedAt || new Date();
        } else if (journey.currentStep === 'phone_screening') {
          updateData.phoneScreeningStatus = 'completed';
          updateData.phoneScreeningCompletedAt = new Date();
        } else if (journey.currentStep === 'meet_greet') {
          updateData.meetGreetCompletedAt = new Date();
        } else if (journey.currentStep === 'adoption') {
          updateData.completedAt = new Date();
          updateData.status = 'completed';
        }
      }

      // If status is 'completed', ensure all final fields are set
      if (status === 'completed') {
        updateData.completedAt = new Date();
        updateData.currentStep = 'adoption'; // Set to final step
        // Ensure all step completion fields are set for the adopter to see the success screen
        if (!updateData.applicationSubmittedAt && !journey.applicationSubmittedAt) {
          updateData.applicationSubmittedAt = new Date();
        }
        if (!updateData.phoneScreeningCompletedAt && !journey.phoneScreeningCompletedAt) {
          updateData.phoneScreeningCompletedAt = new Date();
          updateData.phoneScreeningStatus = 'completed';
        }
        if (!updateData.meetGreetCompletedAt && !journey.meetGreetCompletedAt) {
          updateData.meetGreetCompletedAt = new Date();
        }
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set(updateData)
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      console.log(`[Journey] Updated ${applicationId}: status=${updated.status}, step=${updated.currentStep}`);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating application status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Approve an application (shelter decision)
  app.patch('/api/shelter/applications/:applicationId/approve', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { notes } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || (dog.userId !== userId && dog.shelterId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if phone screening feature is enabled
      const enabledFlags = await storage.getEnabledFeatureFlags();
      const isPhoneScreeningEnabled = enabledFlags.some(f => f.key === 'shelter_phone_screening');

      let [updated] = await db.update(schema.adoptionJourneys)
        .set({
          shelterApprovalStatus: 'approved',
          shelterApprovedAt: new Date(),
          shelterApprovedBy: userId,
          shelterNotes: notes || null,
          // Clear rejection fields when approving
          shelterRejectedAt: null,
          shelterRejectedBy: null,
          shelterRejectionReason: null,
          status: 'active',
          currentStep: isPhoneScreeningEnabled ? 'phone_screening' : 'meet_greet',
          phoneScreeningStatus: isPhoneScreeningEnabled ? 'pending' : null,
          applicationSubmittedAt: journey.applicationSubmittedAt || new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      // If phone screening is enabled, try to initiate the call automatically
      if (isPhoneScreeningEnabled) {
        const applicantProfile = await storage.getUserProfile(journey.userId);
        const phoneNumber = applicantProfile?.phoneNumber;
        
        if (phoneNumber) {
          try {
            const result = await initiatePhoneScreening(applicationId, phoneNumber);
            if (result.success) {
              console.log(`[VAPI] Phone screening initiated for journey ${applicationId}, callId: ${result.callId}`);
              // Update phoneScreeningStatus to scheduled
              [updated] = await db.update(schema.adoptionJourneys)
                .set({
                  phoneScreeningStatus: 'scheduled',
                  phoneScreeningScheduledAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(schema.adoptionJourneys.id, applicationId))
                .returning();
            } else {
              console.warn(`[VAPI] Failed to initiate phone screening for journey ${applicationId}: ${result.error}`);
              // Mark phone screening as failed
              [updated] = await db.update(schema.adoptionJourneys)
                .set({
                  phoneScreeningStatus: 'failed',
                  phoneScreeningNotes: JSON.stringify({ error: result.error }),
                  updatedAt: new Date(),
                })
                .where(eq(schema.adoptionJourneys.id, applicationId))
                .returning();
            }
          } catch (vapiError: any) {
            console.error(`[VAPI] Error initiating phone screening:`, vapiError);
            [updated] = await db.update(schema.adoptionJourneys)
              .set({
                phoneScreeningStatus: 'failed',
                phoneScreeningNotes: JSON.stringify({ error: vapiError.message }),
                updatedAt: new Date(),
              })
              .where(eq(schema.adoptionJourneys.id, applicationId))
              .returning();
          }
        } else {
          // No phone number, mark as needing phone number
          [updated] = await db.update(schema.adoptionJourneys)
            .set({
              phoneScreeningStatus: 'pending',
              phoneScreeningNotes: JSON.stringify({ warning: 'No phone number on file' }),
              updatedAt: new Date(),
            })
            .where(eq(schema.adoptionJourneys.id, applicationId))
            .returning();
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Error approving application:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reject an application (shelter decision)
  app.patch('/api/shelter/applications/:applicationId/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { reason, notes } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || (dog.userId !== userId && dog.shelterId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          shelterApprovalStatus: 'rejected',
          shelterRejectedAt: new Date(),
          shelterRejectedBy: userId,
          shelterRejectionReason: reason || null,
          shelterNotes: notes || null,
          // Clear approval fields when rejecting
          shelterApprovedAt: null,
          shelterApprovedBy: null,
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: userId,
          rejectionReason: reason || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error rejecting application:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Complete adoption
  app.post('/api/shelter/applications/:applicationId/complete-adoption', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { adoptionFee, notes } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || (dog.userId !== userId && dog.shelterId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          status: 'completed',
          currentStep: 'adoption',
          completedAt: new Date(),
          adoptionDate: new Date(),
          shelterApprovalStatus: 'approved',
          shelterNotes: notes ? `${journey.shelterNotes || ''}${notes}` : journey.shelterNotes,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error completing adoption:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Schedule meet & greet
  app.post('/api/shelter/applications/:applicationId/schedule-meet-greet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { scheduledAt } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || (dog.userId !== userId && dog.shelterId !== userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          meetGreetScheduledAt: new Date(scheduledAt),
          currentStep: 'meet_greet',
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, applicationId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error scheduling meet & greet:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // SHELTER AVAILABILITY MANAGEMENT
  // ============================================

  // Get shelter's availability slots
  app.get('/api/shelter/availability', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const availability = await db.select()
        .from(schema.shelterAvailability)
        .where(eq(schema.shelterAvailability.shelterId, userId))
        .orderBy(schema.shelterAvailability.dayOfWeek, schema.shelterAvailability.startTime);

      res.json(availability);
    } catch (error: any) {
      console.error("Error fetching shelter availability:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create availability slot
  app.post('/api/shelter/availability', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { dayOfWeek, startTime, endTime, slotDuration } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Validate time format
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ message: "Invalid time format. Use HH:MM (24-hour)." });
      }

      if (dayOfWeek < 0 || dayOfWeek > 6) {
        return res.status(400).json({ message: "Invalid day of week. Use 0-6 (Sunday-Saturday)." });
      }

      const [created] = await db.insert(schema.shelterAvailability)
        .values({
          shelterId: userId,
          dayOfWeek,
          startTime,
          endTime,
          slotDuration: slotDuration || 60,
        })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      console.error("Error creating availability slot:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update availability slot
  app.patch('/api/shelter/availability/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { dayOfWeek, startTime, endTime, slotDuration, isActive } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify ownership
      const [existing] = await db.select()
        .from(schema.shelterAvailability)
        .where(and(
          eq(schema.shelterAvailability.id, id),
          eq(schema.shelterAvailability.shelterId, userId)
        ));

      if (!existing) {
        return res.status(404).json({ message: "Availability slot not found" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
      if (startTime !== undefined) updateData.startTime = startTime;
      if (endTime !== undefined) updateData.endTime = endTime;
      if (slotDuration !== undefined) updateData.slotDuration = slotDuration;
      if (isActive !== undefined) updateData.isActive = isActive;

      const [updated] = await db.update(schema.shelterAvailability)
        .set(updateData)
        .where(eq(schema.shelterAvailability.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating availability slot:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete availability slot
  app.delete('/api/shelter/availability/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify ownership
      const [existing] = await db.select()
        .from(schema.shelterAvailability)
        .where(and(
          eq(schema.shelterAvailability.id, id),
          eq(schema.shelterAvailability.shelterId, userId)
        ));

      if (!existing) {
        return res.status(404).json({ message: "Availability slot not found" });
      }

      await db.delete(schema.shelterAvailability)
        .where(eq(schema.shelterAvailability.id, id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting availability slot:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get shelter's blocked dates
  app.get('/api/shelter/blocked-dates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const blockedDates = await db.select()
        .from(schema.shelterBlockedDates)
        .where(eq(schema.shelterBlockedDates.shelterId, userId))
        .orderBy(schema.shelterBlockedDates.blockedDate);

      res.json(blockedDates);
    } catch (error: any) {
      console.error("Error fetching blocked dates:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create blocked date
  app.post('/api/shelter/blocked-dates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { blockedDate, reason, allDay, startTime, endTime } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      const [created] = await db.insert(schema.shelterBlockedDates)
        .values({
          shelterId: userId,
          blockedDate: new Date(blockedDate),
          reason,
          allDay: allDay ?? true,
          startTime,
          endTime,
        })
        .returning();

      res.status(201).json(created);
    } catch (error: any) {
      console.error("Error creating blocked date:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Delete blocked date
  app.delete('/api/shelter/blocked-dates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Verify ownership
      const [existing] = await db.select()
        .from(schema.shelterBlockedDates)
        .where(and(
          eq(schema.shelterBlockedDates.id, id),
          eq(schema.shelterBlockedDates.shelterId, userId)
        ));

      if (!existing) {
        return res.status(404).json({ message: "Blocked date not found" });
      }

      await db.delete(schema.shelterBlockedDates)
        .where(eq(schema.shelterBlockedDates.id, id));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting blocked date:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get available slots for a specific shelter (for adopters to book)
  app.get('/api/shelters/:shelterId/available-slots', isAuthenticated, async (req: any, res) => {
    try {
      const { shelterId } = req.params;
      const { startDate, endDate } = req.query;

      // Default to next 2 weeks if not specified
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      // Get shelter's availability
      const availability = await db.select()
        .from(schema.shelterAvailability)
        .where(and(
          eq(schema.shelterAvailability.shelterId, shelterId),
          eq(schema.shelterAvailability.isActive, true)
        ));

      if (availability.length === 0) {
        return res.json([]);
      }

      // Get blocked dates in range
      const blockedDates = await db.select()
        .from(schema.shelterBlockedDates)
        .where(and(
          eq(schema.shelterBlockedDates.shelterId, shelterId),
          gte(schema.shelterBlockedDates.blockedDate, start),
          lte(schema.shelterBlockedDates.blockedDate, end)
        ));

      // Get already booked slots (meet & greet scheduled at times)
      const bookedSlots = await db.select({
        scheduledAt: schema.adoptionJourneys.meetGreetScheduledAt
      })
        .from(schema.adoptionJourneys)
        .innerJoin(schema.dogs, eq(schema.dogs.id, schema.adoptionJourneys.dogId))
        .where(and(
          or(
            eq(schema.dogs.userId, shelterId),
            eq(schema.dogs.shelterId, shelterId)
          ),
          isNotNull(schema.adoptionJourneys.meetGreetScheduledAt),
          gte(schema.adoptionJourneys.meetGreetScheduledAt, start),
          lte(schema.adoptionJourneys.meetGreetScheduledAt, end)
        ));

      // Generate available slots
      const slots: { date: string; time: string; datetime: Date }[] = [];
      const current = new Date(start);
      current.setHours(0, 0, 0, 0);

      while (current <= end) {
        const dayOfWeek = current.getDay();
        const dateStr = current.toISOString().split('T')[0];

        // Check if this day is blocked
        const isBlocked = blockedDates.some(bd => {
          const blockedDateStr = new Date(bd.blockedDate).toISOString().split('T')[0];
          return blockedDateStr === dateStr && bd.allDay;
        });

        if (!isBlocked) {
          // Find availability for this day of week
          const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);

          for (const avail of dayAvailability) {
            // Generate individual time slots based on slot duration
            const [startHour, startMin] = avail.startTime.split(':').map(Number);
            const [endHour, endMin] = avail.endTime.split(':').map(Number);
            const slotDuration = avail.slotDuration;

            let slotStart = startHour * 60 + startMin;
            const slotEnd = endHour * 60 + endMin;

            while (slotStart + slotDuration <= slotEnd) {
              const slotTime = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
              const slotDateTime = new Date(current);
              slotDateTime.setHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0);

              // Check if slot is already booked
              const isBooked = bookedSlots.some(bs => {
                if (!bs.scheduledAt) return false;
                const bookedTime = new Date(bs.scheduledAt);
                return Math.abs(bookedTime.getTime() - slotDateTime.getTime()) < slotDuration * 60 * 1000;
              });

              // Check if slot is in the past
              const isPast = slotDateTime < new Date();

              // Check if this specific time is blocked
              const isTimeBlocked = blockedDates.some(bd => {
                const blockedDateStr = new Date(bd.blockedDate).toISOString().split('T')[0];
                if (blockedDateStr !== dateStr || bd.allDay) return false;
                if (!bd.startTime || !bd.endTime) return false;
                const [blockStartH, blockStartM] = bd.startTime.split(':').map(Number);
                const [blockEndH, blockEndM] = bd.endTime.split(':').map(Number);
                const blockStart = blockStartH * 60 + blockStartM;
                const blockEnd = blockEndH * 60 + blockEndM;
                return slotStart >= blockStart && slotStart < blockEnd;
              });

              if (!isBooked && !isPast && !isTimeBlocked) {
                slots.push({
                  date: dateStr,
                  time: slotTime,
                  datetime: slotDateTime
                });
              }

              slotStart += slotDuration;
            }
          }
        }

        current.setDate(current.getDate() + 1);
      }

      res.json(slots);
    } catch (error: any) {
      console.error("Error fetching available slots:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Book a meet & greet slot (for adopters)
  app.post('/api/adoption-journeys/:journeyId/book-meet-greet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { journeyId } = req.params;
      const { datetime } = req.body;

      // Get the journey and verify ownership
      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(and(
          eq(schema.adoptionJourneys.id, journeyId),
          eq(schema.adoptionJourneys.userId, userId)
        ));

      if (!journey) {
        return res.status(404).json({ message: "Adoption journey not found" });
      }

      // Update the journey with the scheduled time
      const [updated] = await db.update(schema.adoptionJourneys)
        .set({
          meetGreetScheduledAt: new Date(datetime),
          currentStep: 'meet_greet',
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionJourneys.id, journeyId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error booking meet & greet:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // CONSOLIDATED SHELTER CALENDAR
  // ============================================
  
  // Get all calendar events for shelter (availability, blocked dates, meet & greets, tasks)
  app.get('/api/shelter/calendar', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Validate date params - if provided, must be valid ISO strings
      let start: Date, end: Date;
      if (startDate) {
        const parsed = new Date(startDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Invalid startDate format. Use ISO date string (YYYY-MM-DD or full ISO)." });
        }
        start = parsed;
      } else {
        start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      }
      
      if (endDate) {
        const parsed = new Date(endDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Invalid endDate format. Use ISO date string (YYYY-MM-DD or full ISO)." });
        }
        end = parsed;
      } else {
        end = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);
      }

      const events: any[] = [];

      // 1. Get availability windows (expand to actual dates within range)
      const availability = await db.select()
        .from(schema.shelterAvailability)
        .where(and(
          eq(schema.shelterAvailability.shelterId, userId),
          eq(schema.shelterAvailability.isActive, true)
        ));

      // Expand availability to specific dates
      const current = new Date(start);
      while (current <= end) {
        const dayOfWeek = current.getDay();
        const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);
        
        for (const avail of dayAvailability) {
          const [startH, startM] = avail.startTime.split(':').map(Number);
          const [endH, endM] = avail.endTime.split(':').map(Number);
          
          const eventStart = new Date(current);
          eventStart.setHours(startH, startM, 0, 0);
          
          const eventEnd = new Date(current);
          eventEnd.setHours(endH, endM, 0, 0);
          
          events.push({
            id: `avail-${avail.id}-${current.toISOString().split('T')[0]}`,
            title: 'Available for visits',
            start: eventStart.toISOString(),
            end: eventEnd.toISOString(),
            type: 'availability',
            color: '#22c55e', // green
            slotDuration: avail.slotDuration,
          });
        }
        current.setDate(current.getDate() + 1);
      }

      // 2. Get blocked dates
      const blockedDates = await db.select()
        .from(schema.shelterBlockedDates)
        .where(and(
          eq(schema.shelterBlockedDates.shelterId, userId),
          gte(schema.shelterBlockedDates.blockedDate, start),
          lte(schema.shelterBlockedDates.blockedDate, end)
        ));

      for (const blocked of blockedDates) {
        const blockDate = new Date(blocked.blockedDate);
        let eventStart: Date, eventEnd: Date;
        
        if (blocked.allDay) {
          eventStart = new Date(blockDate);
          eventStart.setHours(0, 0, 0, 0);
          eventEnd = new Date(blockDate);
          eventEnd.setHours(23, 59, 59, 999);
        } else if (blocked.startTime && blocked.endTime) {
          const [startH, startM] = blocked.startTime.split(':').map(Number);
          const [endH, endM] = blocked.endTime.split(':').map(Number);
          eventStart = new Date(blockDate);
          eventStart.setHours(startH, startM, 0, 0);
          eventEnd = new Date(blockDate);
          eventEnd.setHours(endH, endM, 0, 0);
        } else {
          continue;
        }

        events.push({
          id: `blocked-${blocked.id}`,
          title: blocked.reason || 'Blocked',
          start: eventStart.toISOString(),
          end: eventEnd.toISOString(),
          type: 'blocked',
          color: '#ef4444', // red
          allDay: blocked.allDay,
        });
      }

      // 3. Get scheduled meet & greets
      const meetGreets = await db.select({
        id: schema.adoptionJourneys.id,
        scheduledAt: schema.adoptionJourneys.meetGreetScheduledAt,
        dogName: schema.dogs.name,
        adopterFirstName: schema.users.firstName,
        adopterLastName: schema.users.lastName,
      })
        .from(schema.adoptionJourneys)
        .innerJoin(schema.dogs, eq(schema.dogs.id, schema.adoptionJourneys.dogId))
        .innerJoin(schema.users, eq(schema.users.id, schema.adoptionJourneys.userId))
        .where(and(
          or(
            eq(schema.dogs.userId, userId),
            eq(schema.dogs.shelterId, userId)
          ),
          isNotNull(schema.adoptionJourneys.meetGreetScheduledAt),
          gte(schema.adoptionJourneys.meetGreetScheduledAt, start),
          lte(schema.adoptionJourneys.meetGreetScheduledAt, end)
        ));

      for (const mg of meetGreets) {
        if (!mg.scheduledAt) continue;
        const eventStart = new Date(mg.scheduledAt);
        const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000); // 1 hour duration
        const adopterName = [mg.adopterFirstName, mg.adopterLastName].filter(Boolean).join(' ') || 'Adopter';

        events.push({
          id: `meetgreet-${mg.id}`,
          title: `Meet & Greet: ${mg.dogName}`,
          start: eventStart.toISOString(),
          end: eventEnd.toISOString(),
          type: 'meetgreet',
          color: '#3b82f6', // blue
          dogName: mg.dogName,
          adopterName: adopterName,
        });
      }

      // 4. Get shelter tasks with due dates
      const tasks = await db.select()
        .from(schema.shelterTasks)
        .where(and(
          eq(schema.shelterTasks.shelterId, userId),
          isNotNull(schema.shelterTasks.dueDate),
          gte(schema.shelterTasks.dueDate, start),
          lte(schema.shelterTasks.dueDate, end),
          not(eq(schema.shelterTasks.status, 'completed'))
        ));

      for (const task of tasks) {
        if (!task.dueDate) continue;
        const taskDate = new Date(task.dueDate);
        
        events.push({
          id: `task-${task.id}`,
          title: task.title,
          start: taskDate.toISOString(),
          end: taskDate.toISOString(),
          type: 'task',
          color: task.priority === 'urgent' ? '#f97316' : '#8b5cf6', // orange for urgent, purple otherwise
          priority: task.priority,
          taskType: task.taskType,
          allDay: true,
        });
      }

      // 5. Get upcoming vaccines
      const vaccines = await db.select({
        id: schema.medicalRecords.id,
        title: schema.medicalRecords.title,
        vaccineName: schema.medicalRecords.vaccineName,
        nextDueDate: schema.medicalRecords.nextDueDate,
        dogName: schema.dogs.name,
      })
        .from(schema.medicalRecords)
        .innerJoin(schema.dogs, eq(schema.dogs.id, schema.medicalRecords.dogId))
        .where(and(
          or(
            eq(schema.dogs.userId, userId),
            eq(schema.dogs.shelterId, userId)
          ),
          isNotNull(schema.medicalRecords.nextDueDate),
          gte(schema.medicalRecords.nextDueDate, start),
          lte(schema.medicalRecords.nextDueDate, end)
        ));

      for (const vaccine of vaccines) {
        if (!vaccine.nextDueDate) continue;
        
        events.push({
          id: `vaccine-${vaccine.id}`,
          title: `${vaccine.vaccineName || vaccine.title || 'Vaccine'} - ${vaccine.dogName}`,
          start: new Date(vaccine.nextDueDate).toISOString(),
          end: new Date(vaccine.nextDueDate).toISOString(),
          type: 'vaccine',
          color: '#06b6d4', // cyan
          dogName: vaccine.dogName,
          allDay: true,
        });
      }

      res.json(events);
    } catch (error: any) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Send message on application
  app.post('/api/shelter/applications/:applicationId/message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const { content } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get the journey
      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, journey.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Find or create conversation for this application
      let [conversation] = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.userId, journey.userId),
          eq(schema.conversations.dogId, journey.dogId)
        ));

      if (!conversation) {
        // Get shelter profile for the name
        const shelterProfile = await storage.getShelterProfile(userId);
        const shelterName = shelterProfile?.name || 'Shelter';

        [conversation] = await db.insert(schema.conversations)
          .values({
            userId: journey.userId,
            dogId: journey.dogId,
            shelterId: userId,
            shelterName,
          })
          .returning();
      }

      // Create message
      const [message] = await db.insert(schema.messages)
        .values({
          conversationId: conversation.id,
          senderId: userId,
          senderType: 'shelter_staff',
          messageType: 'text',
          content,
        })
        .returning();

      res.json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get messages for an application
  app.get('/api/shelter/applications/:applicationId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { applicationId } = req.params;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get the journey
      const [journey] = await db.select()
        .from(schema.adoptionJourneys)
        .where(eq(schema.adoptionJourneys.id, applicationId));

      if (!journey) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Find conversation for this application
      const [conversation] = await db.select()
        .from(schema.conversations)
        .where(and(
          eq(schema.conversations.userId, journey.userId),
          eq(schema.conversations.dogId, journey.dogId)
        ));

      if (!conversation) {
        return res.json([]);
      }

      const messages = await storage.getConversationMessages(conversation.id);
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Send message in shelter conversation
  app.post('/api/shelter/conversations/:conversationId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { conversationId } = req.params;
      const { content } = req.body;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'shelter') {
        return res.status(403).json({ message: "Access denied. Shelter role required." });
      }

      // Get the conversation
      const conversation = await storage.getConversation(conversationId);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Verify the dog belongs to this shelter
      const [dog] = await db.select()
        .from(schema.dogs)
        .where(eq(schema.dogs.id, conversation.dogId));

      if (!dog || dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create message
      const [message] = await db.insert(schema.messages)
        .values({
          conversationId,
          senderId: userId,
          senderType: 'shelter_staff',
          messageType: 'text',
          content,
        })
        .returning();

      res.json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get Owner Profile (now returns unified user_profile with mode='rehome')
  app.get('/api/owner/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userProfile = await storage.getUserProfile(userId);

      if (!userProfile || userProfile.mode !== 'rehome') {
        return res.status(404).json({ message: "Rehomer profile not found" });
      }

      res.json(userProfile);
    } catch (error: any) {
      console.error("Error fetching owner profile:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Owner Onboarding (now saves to unified user_profiles with mode='rehome')
  app.post('/api/owner/onboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }

      // Check if user profile already exists
      const existing = await storage.getUserProfile(userId);
      if (existing) {
        return res.status(400).json({ message: "User profile already exists" });
      }

      // Parse location to extract city and state
      const location = req.body.location || "";
      const [city, state] = location.split(",").map((s: string) => s.trim());

      // For rehomers, we need lat/long. For now, use a default or require them to provide it
      // In production, you'd geocode the city/state to get coordinates
      const latitude = req.body.latitude || 30.2672; // Default: Austin, TX
      const longitude = req.body.longitude || -97.7431;

      // Create user profile with rehome mode
      const userProfile = await storage.createUserProfile({
        userId,
        mode: 'rehome',
        phoneNumber: req.body.phone,
        reasonForRehoming: req.body.reason || null,
        city: city || null,
        state: state || null,
        latitude,
        longitude,
        searchRadius: 25,
        // Optional fields for adopters (null for rehomers)
        homeType: null,
        hasYard: null,
        otherPetsType: null,
        activityLevel: null,
        workSchedule: null,
        exerciseCommitment: null,
        experienceLevel: null,
        preferredSize: [],
        preferredAge: [],
        preferredEnergy: [],
        profileImage: null,
      });

      res.json(userProfile);
    } catch (error: any) {
      console.error("Owner onboarding error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update current user's owner profile (now updates unified user_profile)
  app.patch('/api/owner/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userProfile = await storage.getUserProfile(userId);

      if (!userProfile || userProfile.mode !== 'rehome') {
        return res.status(404).json({ message: "Rehomer profile not found" });
      }

      // Update user profile with rehome-specific fields
      const updated = await storage.updateUserProfile(userId, {
        phoneNumber: req.body.phoneNumber,
        reasonForRehoming: req.body.reasonForRehoming,
        city: req.body.city,
        state: req.body.state,
      });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating owner profile:", error);
      res.status(500).json({ message: error.message });
    }
  });

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

  // Dog Routes
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

  // Create a new dog (shelters and owners only)
  app.post("/api/dogs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Verify user has shelter role OR is an adopter in rehome mode
      const userProfile = await storage.getUserProfile(userId);
      const isRehomer = userProfile && userProfile.mode === 'rehome';

      if (!user || (user.role !== 'shelter' && !isRehomer)) {
        return res.status(403).json({ message: "Access denied. Only shelters and rehomers can post dogs." });
      }

      // Get the user's profile to populate shelter/rehomer information
      let shelterName: string;
      let shelterAddress: string;
      let shelterPhone: string;
      let latitude: number;
      let longitude: number;

      let shelterProfileId: string | null = null;
      
      if (user.role === 'shelter') {
        const shelterProfile = await storage.getShelterProfile(userId);
        if (!shelterProfile) {
          return res.status(400).json({ message: "Shelter profile not found. Complete onboarding first." });
        }
        shelterProfileId = shelterProfile.id;
        shelterName = shelterProfile.shelterName;
        shelterAddress = shelterProfile.location;
        shelterPhone = shelterProfile.phone;
        // Use provided coordinates or fallback to San Francisco
        latitude = req.body.latitude || 37.7749;
        longitude = req.body.longitude || -122.4194;
      } else {
        // Rehomer (adopter in rehome mode)
        if (!userProfile || !userProfile.phoneNumber || !userProfile.city || !userProfile.state) {
          return res.status(400).json({ message: "Rehomer profile incomplete. Complete your profile first." });
        }
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous';
        shelterName = `${fullName} (Rehoming)`;
        shelterAddress = `${userProfile.city}, ${userProfile.state}`;
        shelterPhone = userProfile.phoneNumber;
        // Use user's profile location or provided coordinates
        latitude = req.body.latitude || userProfile.latitude || 37.7749;
        longitude = req.body.longitude || userProfile.longitude || -122.4194;
      }

      // Generate placeholder photos (use static images from attached_assets)
      const staticDogPhotos = [
        "/attached_assets/generated_images/Friendly_rescue_beagle_portrait_112fadd6.png",
        "/attached_assets/generated_images/Playful_chocolate_lab_action_shot_83731287.png",
        "/attached_assets/generated_images/Small_terrier_mix_portrait_c4f97286.png",
        "/attached_assets/generated_images/German_shepherd_mix_resting_897ecb63.png",
        "/attached_assets/generated_images/Senior_corgi_portrait_e324e761.png",
        "/attached_assets/stock_images/cute_dog_portrait_lo_0051dd44.jpg",
        "/attached_assets/stock_images/cute_dog_portrait_lo_344cbb65.jpg",
        "/attached_assets/stock_images/cute_dog_portrait_lo_cd8cda53.jpg",
      ];

      // Use dog ID to generate consistent photos for this dog
      let hash = 0;
      for (let i = 0; i < userId.length; i++) { // Use userId to seed hash for consistency
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash = hash & hash;
      }
      const startIndex = Math.abs(hash) % (staticDogPhotos.length - 2);
      const placeholderPhotos = [
        staticDogPhotos[startIndex],
        staticDogPhotos[startIndex + 1],
        staticDogPhotos[startIndex + 2],
      ];

      // Create the dog - use uploaded photos if provided, otherwise use placeholders
      const photosToUse = (req.body.photos && req.body.photos.length > 0) 
        ? req.body.photos 
        : placeholderPhotos;

      const newDog = await storage.createDog({
        userId,
        name: req.body.name,
        breed: req.body.breed,
        age: req.body.age,
        ageCategory: req.body.ageCategory,
        size: req.body.size,
        weight: req.body.weight,
        energyLevel: req.body.energyLevel,
        temperament: req.body.temperament,
        goodWithKids: req.body.goodWithKids,
        goodWithDogs: req.body.goodWithDogs,
        goodWithCats: req.body.goodWithCats,
        bio: req.body.bio,
        specialNeeds: req.body.specialNeeds || null,
        photos: photosToUse,
        shelterId: shelterProfileId || userId, // Use shelter profile ID if available, otherwise user ID
        shelterName,
        shelterAddress,
        shelterPhone,
        latitude,
        longitude,
        address: req.body.address || null,
        city: req.body.city || null,
        state: req.body.state || null,
        zipCode: req.body.zipCode || null,
        isPublic: req.body.isPublic || false,
        vaccinated: req.body.vaccinated,
        spayedNeutered: req.body.spayedNeutered,
      });

      // Invalidate dogs cache
      cache.delete(CACHE_KEYS.ALL_DOGS);
      cache.invalidatePattern('dogs:');
      cache.invalidatePattern('discover:');

      res.json(newDog);
    } catch (error: any) {
      console.error("Error creating dog:", error);
      res.status(500).json({ message: error.message || "Failed to create dog" });
    }
  });

  // Update a dog (owner verification)
  app.patch("/api/dogs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const dogId = req.params.id;

      const dog = await storage.getDog(dogId);
      if (!dog) {
        return res.status(404).json({ message: "Dog not found" });
      }

      // Verify ownership
      if (dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied. You can only update your own dogs." });
      }

      const updatedDog = await storage.updateDog(dogId, req.body);

      // Invalidate dogs cache
      cache.delete(CACHE_KEYS.ALL_DOGS);
      cache.invalidatePattern('dogs:');
      cache.invalidatePattern('discover:');

      res.json(updatedDog);
    } catch (error: any) {
      console.error("Error updating dog:", error);
      res.status(500).json({ message: error.message || "Failed to update dog" });
    }
  });

  // Delete a dog (owner verification)
  app.delete("/api/dogs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const dogId = req.params.id;

      const dog = await storage.getDog(dogId);
      if (!dog) {
        return res.status(404).json({ message: "Dog not found" });
      }

      // Verify ownership
      if (dog.userId !== userId) {
        return res.status(403).json({ message: "Access denied. You can only delete your own dogs." });
      }

      await storage.deleteDog(dogId);

      // Invalidate dogs cache
      cache.delete(CACHE_KEYS.ALL_DOGS);
      cache.invalidatePattern('dogs:');
      cache.invalidatePattern('discover:');

      res.json({ message: "Dog deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting dog:", error);
      res.status(500).json({ message: error.message || "Failed to delete dog" });
    }
  });

  // Get dogs posted by a specific user (shelters and owners only)
  app.get("/api/dogs/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const dogs = await storage.getUserDogs(userId);
      res.json(dogs);
    } catch (error: any) {
      console.error("Error fetching user dogs:", error);
      res.status(500).json({ message: error.message || "Failed to fetch dogs" });
    }
  });

  // Dog Discovery Routes with AI Compatibility
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

  // Virtual Tours API - Placeholder (future implementation)
  app.post("/api/virtual-tours", async (req: any, res) => {
    res.status(501).json({ message: "Virtual tours not yet implemented" });
  });

  app.get("/api/virtual-tours", async (req: any, res) => {
    res.status(501).json({ message: "Virtual tours not yet implemented" });
  });

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

  // Get Scout AI approval recommendation for adoption journey
  app.get("/api/adoption-journeys/:id/scout-approval", isAuthenticated, async (req: any, res) => {
    try {
      const journeyId = req.params.id;
      // Get adoption journey from database
      const adoptionJourneys = await db.query.adoptionJourneys.findFirst({
        where: eq(schema.adoptionJourneys.id, journeyId),
      });

      if (!adoptionJourneys) {
        return res.status(404).json({ error: "Adoption journey not found" });
      }

      if (adoptionJourneys.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const dog = await storage.getDog(adoptionJourneys.dogId);
      const userProfile = await storage.getUserProfile(req.user.id);

      if (!dog || !userProfile) {
        return res.status(404).json({ error: "Dog or user profile not found" });
      }

      // Generate Scout AI approval recommendation based on:
      // 1. Conversation history and learned preferences
      // 2. Dog compatibility score (start with default)
      // 3. User's adoption readiness signals
      let approvalScore = 75;
      const approvalReasons: string[] = [];

      // Check user's experience level
      if (userProfile.experienceLevel === 'very_experienced') {
        approvalScore += 5;
        approvalReasons.push("Extensive dog experience increases adoption readiness");
      }

      // Check if user has prepared home
      if (userProfile.hasYard && dog.energyLevel === 'high' || dog.energyLevel === 'very_high') {
        approvalScore += 5;
        approvalReasons.push("Your home setup matches this dog's energy needs");
      }

      // Check lifestyle fit
      if (userProfile.workSchedule === 'home_all_day' && !dog.specialNeeds) {
        approvalScore += 3;
        approvalReasons.push("Your schedule allows for proper dog care");
      }

      // Cap at 95 for approval recommendations (leave room for manual review)
      approvalScore = Math.min(95, approvalScore);

      const recommendation = approvalScore >= 80 ? 'approve' : approvalScore >= 60 ? 'review' : 'request_more_info';

      res.json({
        approvalScore: Math.round(approvalScore),
        recommendation,
        reasons: approvalReasons,
        summary: `Based on Scout AI analysis: ${recommendation === 'approve' ? 'Strong match - ready for next steps!' : recommendation === 'review' ? 'Good match - manual review recommended' : 'Request more information about your experience'}`
      });
    } catch (error) {
      console.error("Error generating Scout approval:", error);
      res.status(500).json({ error: "Failed to generate Scout approval recommendation" });
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

  // ============================================
  // DOGS NEEDING FOSTER (for foster volunteers to discover dogs needing help)
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

  // Swipe Routes
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
        import("./ai/scout-insights").then(({ analyzeSwipePatterns }) => {
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

  // ============================================
  // BULK OPERATIONS API
  // ============================================

  // Get CSV template for dog import
  app.get('/api/shelter/bulk/templates/dogs', isAuthenticated, (req: any, res) => {
    const csvTemplate = `name,breed,age,ageCategory,size,weight,energyLevel,temperament,goodWithKids,goodWithDogs,goodWithCats,bio,specialNeeds,vaccinated,spayedNeutered,listingType,urgencyLevel
Max,Golden Retriever,3,adult,large,65,moderate,"friendly,playful,loyal",true,true,true,Friendly family dog,none,true,true,adoption,normal
Bella,Beagle,2,young,medium,25,high,"curious,active,gentle",true,true,false,Active and curious pup,,true,false,adoption,urgent`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=dog_import_template.csv');
    res.send(csvTemplate);
  });

  // Get CSV template for medical records import
  app.get('/api/shelter/bulk/templates/medical', isAuthenticated, (req: any, res) => {
    const csvTemplate = `dogName,recordType,title,description,veterinarian,vaccineName,performedAt,nextDueDate,cost
Max,vaccine,Rabies Vaccine,Annual rabies vaccination,Dr. Smith,rabies,2024-01-15,2025-01-15,35
Bella,exam,Wellness Check,Routine wellness examination,Dr. Johnson,,2024-02-01,,50`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=medical_import_template.csv');
    res.send(csvTemplate);
  });

  // Bulk import dogs from CSV
  app.post('/api/shelter/bulk/import/dogs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can import dogs" });
      }

      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const { rows, fileName } = req.body;
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      const shelter = shelterProfile[0];
      const results: { success: number; errors: any[] } = { success: 0, errors: [] };

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const validated = schema.csvDogImportSchema.parse(row);

          // Determine age category from age if not provided
          let ageCategory = validated.ageCategory;
          if (!ageCategory) {
            if (validated.age < 1) ageCategory = 'puppy';
            else if (validated.age < 3) ageCategory = 'young';
            else if (validated.age < 8) ageCategory = 'adult';
            else ageCategory = 'senior';
          }

          // Parse temperament
          const temperament = validated.temperament 
            ? validated.temperament.split(',').map(t => t.trim())
            : ['friendly'];

          await db.insert(schema.dogs).values({
            userId: userId,
            name: validated.name,
            breed: validated.breed,
            age: validated.age,
            ageCategory: ageCategory,
            size: validated.size,
            weight: validated.weight,
            energyLevel: validated.energyLevel,
            temperament: temperament,
            goodWithKids: validated.goodWithKids ?? false,
            goodWithDogs: validated.goodWithDogs ?? false,
            goodWithCats: validated.goodWithCats ?? false,
            bio: validated.bio || `Meet ${validated.name}!`,
            specialNeeds: validated.specialNeeds || null,
            vaccinated: validated.vaccinated ?? false,
            spayedNeutered: validated.spayedNeutered ?? false,
            listingType: validated.listingType || 'adoption',
            urgencyLevel: validated.urgencyLevel || 'normal',
            photos: [],
            shelterId: shelter.id,
            shelterName: shelter.shelterName,
            shelterAddress: shelter.address || shelter.location,
            shelterPhone: shelter.phone,
            latitude: shelter.latitude,
            longitude: shelter.longitude,
            approvalStatus: 'approved',
          });
          results.success++;
        } catch (error: any) {
          results.errors.push({ row: i + 1, error: error.message });
        }
      }

      // Log the import
      await db.insert(schema.bulkImportLogs).values({
        shelterId: shelter.id,
        importedBy: userId,
        importType: 'dogs',
        fileName: fileName || 'csv_upload',
        totalRows: rows.length,
        successCount: results.success,
        errorCount: results.errors.length,
        errors: results.errors,
        status: 'completed',
        completedAt: new Date(),
      });

      res.json({
        message: `Imported ${results.success} of ${rows.length} dogs`,
        success: results.success,
        errors: results.errors,
      });
    } catch (error: any) {
      console.error("Error importing dogs:", error);
      res.status(500).json({ message: error.message || "Import failed" });
    }
  });

  // Bulk import medical records from CSV
  app.post('/api/shelter/bulk/import/medical', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can import medical records" });
      }

      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const { rows, fileName } = req.body;
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      const shelter = shelterProfile[0];

      // Get all shelter dogs for matching by name
      const shelterDogs = await db.select().from(schema.dogs)
        .where(eq(schema.dogs.userId, userId));

      const dogsByName = new Map(shelterDogs.map(d => [d.name.toLowerCase(), d]));

      const results: { success: number; errors: any[] } = { success: 0, errors: [] };

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const validated = schema.csvMedicalImportSchema.parse(row);

          const dog = dogsByName.get(validated.dogName.toLowerCase());
          if (!dog) {
            results.errors.push({ row: i + 1, error: `Dog "${validated.dogName}" not found` });
            continue;
          }

          await db.insert(schema.medicalRecords).values({
            dogId: dog.id,
            shelterId: shelter.id,
            recordType: validated.recordType,
            title: validated.title,
            description: validated.description || null,
            veterinarian: validated.veterinarian || null,
            vaccineName: validated.vaccineName || null,
            performedAt: validated.performedAt ? new Date(validated.performedAt) : new Date(),
            nextDueDate: validated.nextDueDate ? new Date(validated.nextDueDate) : null,
            cost: validated.cost || null,
            status: 'completed',
          });
          results.success++;
        } catch (error: any) {
          results.errors.push({ row: i + 1, error: error.message });
        }
      }

      // Log the import
      await db.insert(schema.bulkImportLogs).values({
        shelterId: shelter.id,
        importedBy: userId,
        importType: 'medical_records',
        fileName: fileName || 'csv_upload',
        totalRows: rows.length,
        successCount: results.success,
        errorCount: results.errors.length,
        errors: results.errors,
        status: 'completed',
        completedAt: new Date(),
      });

      res.json({
        message: `Imported ${results.success} of ${rows.length} medical records`,
        success: results.success,
        errors: results.errors,
      });
    } catch (error: any) {
      console.error("Error importing medical records:", error);
      res.status(500).json({ message: error.message || "Import failed" });
    }
  });

  // Batch update dogs status
  app.patch('/api/shelter/bulk/dogs/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can update dogs" });
      }

      const { dogIds, updates } = req.body;
      if (!dogIds || !Array.isArray(dogIds) || dogIds.length === 0) {
        return res.status(400).json({ message: "No dogs selected" });
      }

      const validUpdates: any = {};
      if (updates.listingType) validUpdates.listingType = updates.listingType;
      if (updates.urgencyLevel) validUpdates.urgencyLevel = updates.urgencyLevel;
      if (updates.approvalStatus) validUpdates.approvalStatus = updates.approvalStatus;
      if (typeof updates.isPublic === 'boolean') validUpdates.isPublic = updates.isPublic;

      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }

      await db.update(schema.dogs)
        .set(validUpdates)
        .where(and(
          inArray(schema.dogs.id, dogIds),
          eq(schema.dogs.userId, userId)
        ));

      res.json({ message: `Updated ${dogIds.length} dogs`, count: dogIds.length });
    } catch (error: any) {
      console.error("Error batch updating dogs:", error);
      res.status(500).json({ message: error.message || "Update failed" });
    }
  });

  // Bulk update intake records
  app.patch('/api/shelter/bulk/intake/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can update intake records" });
      }

      const { intakeIds, updates } = req.body;
      if (!intakeIds || !Array.isArray(intakeIds) || intakeIds.length === 0) {
        return res.status(400).json({ message: "No intake records selected" });
      }

      const validUpdates: any = {};
      if (updates.pipelineStatus) validUpdates.pipelineStatus = updates.pipelineStatus;
      if (updates.holdType !== undefined) validUpdates.holdType = updates.holdType;
      if (updates.initialCondition) validUpdates.initialCondition = updates.initialCondition;

      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({ message: "No valid updates provided" });
      }

      await db.update(schema.intakeRecords)
        .set(validUpdates)
        .where(inArray(schema.intakeRecords.id, intakeIds));

      // Sync hold status to dog profiles if holdType was updated
      if (updates.holdType !== undefined) {
        // Get all intake records to find their dogIds
        const intakes = await db.select()
          .from(schema.intakeRecords)
          .where(inArray(schema.intakeRecords.id, intakeIds));
        
        const dogIds = intakes.map(i => i.dogId);
        if (dogIds.length > 0) {
          await db.update(schema.dogs)
            .set({ holdType: updates.holdType || null })
            .where(inArray(schema.dogs.id, dogIds));
          console.log(`[Bulk Intake] Synced hold status to ${dogIds.length} dogs`);
        }
      }

      res.json({ message: `Updated ${intakeIds.length} intake records`, count: intakeIds.length });
    } catch (error: any) {
      console.error("Error batch updating intake records:", error);
      res.status(500).json({ message: error.message || "Update failed" });
    }
  });

  // Bulk delete intake records
  app.delete('/api/shelter/bulk/intake', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can delete intake records" });
      }

      const { intakeIds } = req.body;
      if (!intakeIds || !Array.isArray(intakeIds) || intakeIds.length === 0) {
        return res.status(400).json({ message: "No intake records selected" });
      }

      // Delete intake records
      await db.delete(schema.intakeRecords)
        .where(inArray(schema.intakeRecords.id, intakeIds));

      res.json({ message: `Deleted ${intakeIds.length} intake records`, count: intakeIds.length });
    } catch (error: any) {
      console.error("Error batch deleting intake records:", error);
      res.status(500).json({ message: error.message || "Delete failed" });
    }
  });

  // Bulk delete dogs/pets
  app.delete('/api/shelter/bulk/dogs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can delete pets" });
      }

      const { dogIds } = req.body;
      if (!dogIds || !Array.isArray(dogIds) || dogIds.length === 0) {
        return res.status(400).json({ message: "No pets selected" });
      }

      // First delete associated intake records
      await db.delete(schema.intakeRecords)
        .where(sql`${schema.intakeRecords.dogId} = ANY(${dogIds})`);

      // Then delete the dogs
      await db.delete(schema.dogs)
        .where(sql`${schema.dogs.id} = ANY(${dogIds}) AND ${schema.dogs.userId} = ${userId}`);

      res.json({ message: `Deleted ${dogIds.length} pets`, count: dogIds.length });
    } catch (error: any) {
      console.error("Error batch deleting pets:", error);
      res.status(500).json({ message: error.message || "Delete failed" });
    }
  });

  // Bulk upload photos
  app.post('/api/shelter/bulk/photos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can upload photos" });
      }

      const { assignments } = req.body; // Array of { dogId, photos: [base64...] }
      if (!assignments || !Array.isArray(assignments)) {
        return res.status(400).json({ message: "Invalid data format" });
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadsDir = path.join(process.cwd(), 'attached_assets', 'dog_photos');

      try {
        await fs.mkdir(uploadsDir, { recursive: true });
      } catch (err) {}

      let totalPhotos = 0;

      for (const assignment of assignments) {
        const { dogId, photos } = assignment;
        if (!dogId || !photos?.length) continue;

        // Verify dog belongs to this shelter
        const [dog] = await db.select().from(schema.dogs)
          .where(and(eq(schema.dogs.id, dogId), eq(schema.dogs.userId, userId)))
          .limit(1);

        if (!dog) continue;

        const newPhotos: string[] = [...(dog.photos || [])];

        for (const base64Data of photos) {
          const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
          const imageData = base64Match ? base64Match[2] : base64Data;
          const ext = base64Match ? base64Match[1] : 'jpg';

          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(7);
          const filename = `dog_photo_${timestamp}_${randomId}.${ext}`;
          const filePath = path.join(uploadsDir, filename);

          await fs.writeFile(filePath, imageData, 'base64');
          newPhotos.push(`/attached_assets/dog_photos/${filename}`);
          totalPhotos++;
        }

        await db.update(schema.dogs)
          .set({ photos: newPhotos })
          .where(eq(schema.dogs.id, dogId));
      }

      res.json({ message: `Uploaded ${totalPhotos} photos`, count: totalPhotos });
    } catch (error: any) {
      console.error("Error bulk uploading photos:", error);
      res.status(500).json({ message: error.message || "Upload failed" });
    }
  });

  // Message Templates CRUD
  app.get('/api/shelter/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const templates = await db.select().from(schema.messageTemplates)
        .where(eq(schema.messageTemplates.shelterId, shelterProfile[0].id))
        .orderBy(desc(schema.messageTemplates.updatedAt));

      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/shelter/templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const { name, subject, content, category, variables } = req.body;

      const [template] = await db.insert(schema.messageTemplates)
        .values({
          shelterId: shelterProfile[0].id,
          name,
          subject,
          content,
          category: category || 'general',
          variables: variables || [],
        })
        .returning();

      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk messaging
  app.post('/api/shelter/bulk/message', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (user?.role !== 'shelter') {
        return res.status(403).json({ message: "Only shelters can send bulk messages" });
      }

      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const { recipientType, recipientIds, subject, content, templateId } = req.body;

      if (!content || !recipientIds?.length) {
        return res.status(400).json({ message: "Content and recipients required" });
      }

      const shelter = shelterProfile[0];
      let sentCount = 0;

      // Create messages in conversations
      for (const recipientId of recipientIds) {
        try {
          // Find or create conversation
          let [conversation] = await db.select().from(schema.conversations)
            .where(and(
              eq(schema.conversations.shelterId, shelter.id),
              eq(schema.conversations.userId, recipientId)
            ))
            .limit(1);

          if (!conversation) {
            // Get recipient's first dog conversation or create general one
            const [recipientDog] = await db.select().from(schema.dogs)
              .where(eq(schema.dogs.userId, recipientId))
              .limit(1);

            [conversation] = await db.insert(schema.conversations)
              .values({
                userId: recipientId,
                dogId: recipientDog?.id || 'general',
                shelterName: shelter.shelterName,
                shelterId: shelter.id,
                status: 'open',
              })
              .returning();
          }

          // Send message
          await db.insert(schema.messages).values({
            conversationId: conversation.id,
            senderId: userId,
            senderType: 'shelter_staff',
            messageType: 'text',
            content: content,
          });

          // Update conversation
          await db.update(schema.conversations)
            .set({
              lastMessageAt: new Date(),
              userUnreadCount: sql`${schema.conversations.userUnreadCount} + 1`,
            })
            .where(eq(schema.conversations.id, conversation.id));

          sentCount++;
        } catch (e) {
          console.error(`Failed to send to ${recipientId}:`, e);
        }
      }

      // Log bulk message
      await db.insert(schema.bulkMessageLogs).values({
        shelterId: shelter.id,
        sentBy: userId,
        templateId: templateId || null,
        subject: subject || null,
        content,
        recipientType: recipientType || 'custom',
        recipientCount: recipientIds.length,
        sentCount,
        failedCount: recipientIds.length - sentCount,
        status: 'completed',
        completedAt: new Date(),
      });

      res.json({ 
        message: `Sent to ${sentCount} of ${recipientIds.length} recipients`,
        sentCount,
        failedCount: recipientIds.length - sentCount,
      });
    } catch (error: any) {
      console.error("Error sending bulk messages:", error);
      res.status(500).json({ message: error.message || "Failed to send messages" });
    }
  });

  // Get potential message recipients
  app.get('/api/shelter/bulk/recipients', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type } = req.query; // "applicants", "adopters", "fosters"

      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const shelter = shelterProfile[0];
      let recipients: any[] = [];

      if (type === 'applicants') {
        // Get users who have active applications for this shelter's dogs
        const shelterDogIds = await db.select({ id: schema.dogs.id })
          .from(schema.dogs)
          .where(eq(schema.dogs.userId, userId));

        const dogIds = shelterDogIds.map(d => d.id);

        if (dogIds.length > 0) {
          const applications = await db.select({
            userId: schema.adoptionJourneys.userId,
            user: schema.users,
          })
          .from(schema.adoptionJourneys)
          .innerJoin(schema.users, eq(schema.adoptionJourneys.userId, schema.users.id))
          .where(sql`${schema.adoptionJourneys.dogId} = ANY(${dogIds})`);

          recipients = applications.map(a => ({
            id: a.userId,
            name: `${a.user.firstName || ''} ${a.user.lastName || ''}`.trim() || a.user.email,
            email: a.user.email,
            type: 'applicant',
          }));
        }
      } else {
        // Get all users who have conversations with this shelter
        const convos = await db.select({
          userId: schema.conversations.userId,
          user: schema.users,
        })
        .from(schema.conversations)
        .innerJoin(schema.users, eq(schema.conversations.userId, schema.users.id))
        .where(eq(schema.conversations.shelterId, shelter.id));

        recipients = convos.map(c => ({
          id: c.userId,
          name: `${c.user.firstName || ''} ${c.user.lastName || ''}`.trim() || c.user.email,
          email: c.user.email,
          type: 'contact',
        }));
      }

      // Dedupe
      const seen = new Set();
      recipients = recipients.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });

      res.json(recipients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get import history
  app.get('/api/shelter/bulk/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const shelterProfile = await db.select().from(schema.shelterProfiles)
        .where(eq(schema.shelterProfiles.userId, userId))
        .limit(1);

      if (!shelterProfile.length) {
        return res.status(400).json({ message: "Shelter profile not found" });
      }

      const imports = await db.select().from(schema.bulkImportLogs)
        .where(eq(schema.bulkImportLogs.shelterId, shelterProfile[0].id))
        .orderBy(desc(schema.bulkImportLogs.createdAt))
        .limit(20);

      res.json(imports);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create and return the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}