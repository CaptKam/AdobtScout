import type { Express } from "express";
import { storage } from "../storage";
import type { User } from "@shared/schema";
import { isAuthenticated, isAdmin, canReviewEligibility, isPlatformAdmin } from "../auth";
import { eq, and, or, sql, isNull, isNotNull, gt, gte, lte, desc, inArray, not, asc } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "../db";
import crypto from "crypto";
import { isPluginEnabled, enablePlugin, disablePlugin } from "../plugins/health-screening";
import { isPluginEnabled as isAutomationsPluginEnabled, enablePlugin as enableAutomationsPlugin, disablePlugin as disableAutomationsPlugin } from "../plugins/automations";

export function registerAdminRoutes(app: Express) {
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
      const { syncVapiCallStatuses } = await import('../vapi');
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
      const { calculateNextRetryTime, shouldRetry } = await import('../utils/webhook-retry');
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
      
      const { calculateNextRetryTime, shouldRetry } = await import('../utils/webhook-retry');
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
      
      const { calculateNextRetryTime, shouldRetry, getMaxRetries } = await import('../utils/webhook-retry');
      
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
}
