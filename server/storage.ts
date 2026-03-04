import {
  type User,
  type UpsertUser,
  type UserProfile,
  type InsertUserProfile,
  type ShelterProfile,
  type InsertShelterProfile,
  type OwnerProfile,
  type InsertOwnerProfile,
  type Dog,
  type InsertDog,
  type Swipe,
  type InsertSwipe,
  type ChatMessage,
  type InsertChatMessage,
  type DogWithCompatibility,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  type ApplicationQuestion,
  type InsertApplicationQuestion,
  type PhoneScreeningQuestion,
  type InsertPhoneScreeningQuestion,
  type VapiKnowledgeBaseEntry,
  type InsertVapiKnowledgeBaseEntry,
  type IntakeRecord,
  type InsertIntakeRecord,
  type ShelterTask,
  type InsertShelterTask,
  type MedicalRecord,
  type InsertMedicalRecord,
  type BehaviorAssessment,
  type InsertBehaviorAssessment,
  type ShelterStaff,
  type InsertShelterStaff,
  type ShelterApplicationForm,
  type InsertShelterApplicationForm,
  type ShelterApplicationQuestion,
  type InsertShelterApplicationQuestion,
  type Advertiser,
  type InsertAdvertiser,
  type AdvertiserLocation,
  type InsertAdvertiserLocation,
  type AdvertiserLocationWithBusiness,
  type AdoptionRequirements,
  type AdoptionJourney,
  type HealthScreeningResult,
  type InsertHealthScreeningResult,
  type Plugin,
  type InsertPlugin,
  type PluginInstallation,
  type InsertPluginInstallation,
  type WebhookLog,
  type InsertWebhookLog,
  type TaskRule,
  plugins,
  pluginInstallations,
  webhookLogs,
  users,
  userProfiles,
  dogs,
  swipes,
  chatMessages,
  conversations,
  messages,
  adoptionJourneys,
  adoptionDocuments,
  householdPets,
  familyMembers,
  shelterProfiles,
  ownerProfiles,
  virtualTours,
  adminActivityLogs,
  fosterRequests,
  adopterVerifications,
  adoptionRequirements,
  applicationQuestions,
  phoneScreeningQuestions,
  vapiKnowledgeBase,
  shelterApplicationForms,
  shelterApplicationQuestions,
  scoutInsights,
  intakeRecords,
  shelterTasks,
  medicalRecords,
  healthScreeningResults,
  behaviorAssessments,
  shelterStaff,
  adoptionCheckouts,
  taskRules,
  medicalTemplates,
  fosterAssignments,
  animalTransfers,
  formTemplates,
  reportDefinitions,
  shelterAnalytics,
  shelterPaymentSettings,
  fundraisingCampaigns,
  donations,
  shelterResources,
  advertisers,
  advertiserLocations,
  scanMetadata,
  platformSettings,
  featureFlags,
  type FeatureFlag,
  FEATURE_FLAG_KEYS,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { eq, and, sql, asc, desc } from "drizzle-orm"; // Added desc import

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(userData: { email: string; password: string | null; firstName: string; lastName: string; role: 'adopter' | 'shelter' | 'owner'; profileImageUrl?: string | null }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(id: string, role: 'adopter' | 'shelter' | 'owner'): Promise<User | undefined>;

  // User Profile (Adopters)
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  getAllUserProfiles(): Promise<UserProfile[]>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile | undefined>;

  // Shelter Profile
  getShelterProfile(userId: string): Promise<ShelterProfile | undefined>;
  getShelterProfileById(id: string): Promise<ShelterProfile | undefined>;
  getAllShelterProfiles(): Promise<ShelterProfile[]>;
  createShelterProfile(profile: Omit<InsertShelterProfile, 'id'>): Promise<ShelterProfile>;
  updateShelterProfile(id: string, profile: Partial<InsertShelterProfile>): Promise<ShelterProfile | undefined>;

  // Owner Profile
  getOwnerProfile(userId: string): Promise<OwnerProfile | undefined>;
  createOwnerProfile(profile: Omit<InsertOwnerProfile, 'id'>): Promise<OwnerProfile>;
  updateOwnerProfile(id: string, profile: Partial<InsertOwnerProfile>): Promise<OwnerProfile | undefined>;

  // Dogs
  getDog(id: string): Promise<Dog | undefined>;
  getAllDogs(): Promise<Dog[]>;
  getUserDogs(userId: string): Promise<Dog[]>;
  createDog(dog: InsertDog): Promise<Dog>;
  updateDog(id: string, dogData: Partial<InsertDog>): Promise<Dog | undefined>; // Added for update/delete
  deleteDog(id: string): Promise<void>; // Added for delete

  // Swipes
  getUserSwipes(userId: string): Promise<Swipe[]>;
  createSwipe(swipe: InsertSwipe): Promise<Swipe>;
  getLikedDogs(userId: string): Promise<Array<{ dogId: string; likedAt: Date }>>; // Returns array of dog IDs with timestamps
  getLikedDogsWithDetails(userId: string): Promise<Array<Swipe & { dog: Dog }>>; // Returns liked swipes with full dog details
  deleteUserSwipes(userId: string): Promise<void>; // Added for cleanup

  // Chat
  getUserChatMessages(userId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Conversations
  getConversation(conversationId: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  getConversationByDog(userId: string, dogId: string): Promise<Conversation | undefined>;
  createConversation(data: InsertConversation): Promise<Conversation>;
  updateConversation(conversationId: string, data: Partial<InsertConversation>): Promise<Conversation | undefined>;
  updateConversationTimestamp(conversationId: string): Promise<void>;
  deleteConversation(conversationId: string): Promise<void>;

  // Messages
  getConversationMessages(conversationId: string): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  markMessagesAsRead(conversationId: string, userId: string): Promise<void>; // Added for read receipts
  getUnreadCount(conversationId: string, userId: string): Promise<number>; // Added for read receipts

  // Admin Operations
  updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined>;
  updateUserActiveStatus(userId: string, isActive: boolean): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getDashboardMetrics(): Promise<{
    totalUsers: number;
    totalAdopters: number;
    totalShelters: number;
    totalDogs: number;
    pendingShelters: number;
    pendingDogs: number;
    totalApplications: number;
    recentActivity: number;
  }>;
  approveShelter(shelterId: string, adminId: string): Promise<ShelterProfile | undefined>;
  rejectShelter(shelterId: string, adminId: string, reason: string): Promise<ShelterProfile | undefined>;
  approveDog(dogId: string, adminId: string): Promise<Dog | undefined>;
  rejectDog(dogId: string, adminId: string, reason: string): Promise<Dog | undefined>;
  getPendingShelters(): Promise<ShelterProfile[]>;
  getPendingDogs(): Promise<Dog[]>;

  // Adoption Requirements
  getAdoptionRequirements(): Promise<AdoptionRequirements | undefined>; // Changed return type
  updateAdoptionRequirements(requirements: Partial<AdoptionRequirements>): Promise<void>; // Changed return type and parameter

  // Application Questions
  getApplicationQuestions(mode?: string): Promise<ApplicationQuestion[]>;
  getApplicationQuestion(id: string): Promise<ApplicationQuestion | undefined>;
  createApplicationQuestion(question: InsertApplicationQuestion): Promise<ApplicationQuestion>;
  updateApplicationQuestion(id: string, question: Partial<InsertApplicationQuestion>): Promise<ApplicationQuestion | undefined>;
  deleteApplicationQuestion(id: string): Promise<void>;
  reorderApplicationQuestions(questionIds: string[]): Promise<void>;

  // Phone Screening Questions
  getPhoneScreeningQuestions(scenario?: string): Promise<PhoneScreeningQuestion[]>;
  getPhoneScreeningQuestion(id: string): Promise<PhoneScreeningQuestion | undefined>;
  createPhoneScreeningQuestion(question: InsertPhoneScreeningQuestion): Promise<PhoneScreeningQuestion>;
  updatePhoneScreeningQuestion(id: string, question: Partial<InsertPhoneScreeningQuestion>): Promise<PhoneScreeningQuestion | undefined>;
  deletePhoneScreeningQuestion(id: string): Promise<void>;
  reorderPhoneScreeningQuestions(questionIds: string[]): Promise<void>;

  // Vapi Knowledge Base
  getVapiKnowledgeBaseEntries(category?: string, publishedOnly?: boolean): Promise<VapiKnowledgeBaseEntry[]>;
  getVapiKnowledgeBaseEntry(id: string): Promise<VapiKnowledgeBaseEntry | undefined>;
  createVapiKnowledgeBaseEntry(entry: InsertVapiKnowledgeBaseEntry): Promise<VapiKnowledgeBaseEntry>;
  updateVapiKnowledgeBaseEntry(id: string, entry: Partial<InsertVapiKnowledgeBaseEntry>): Promise<VapiKnowledgeBaseEntry | undefined>;
  deleteVapiKnowledgeBaseEntry(id: string): Promise<void>;
  publishVapiKnowledgeBaseEntry(id: string, publish: boolean): Promise<VapiKnowledgeBaseEntry | undefined>;

  // Vapi Dashboard
  getVapiCallLogs(options: { type?: string; status?: string; limit: number; offset: number }): Promise<{
    calls: Array<{
      id: string;
      type: 'phone_screening' | 'consultation';
      status: string;
      userId: string;
      userName?: string;
      dogId?: string;
      dogName?: string;
      vapiCallId?: string;
      transcript?: string;
      summary?: string;
      analytics?: any;
      createdAt: Date;
      completedAt?: Date;
    }>;
    total: number;
  }>;
  getVapiDashboardStats(): Promise<{
    totalCalls: number;
    completedCalls: number;
    averageSentiment: number;
    callsByType: { type: string; count: number }[];
    recentCalls: number;
    topConcerns: string[];
  }>;

  // Animal Types Management
  getEnabledAnimalTypes(): Promise<{ id: string; label: string }[]>;
  getAllAnimalTypes(): Promise<{ id: string; enabled: boolean }[]>;
  updateAnimalTypes(types: { id: string; enabled: boolean }[]): Promise<void>;


  // ============================================
  // SHELTER CRM OPERATIONS
  // ============================================

  // Intake Records
  getIntakeRecords(shelterId: string): Promise<IntakeRecord[]>;
  getIntakeRecord(id: string): Promise<IntakeRecord | undefined>;
  getIntakeRecordByDog(dogId: string): Promise<IntakeRecord | undefined>;
  createIntakeRecord(record: InsertIntakeRecord): Promise<IntakeRecord>;
  updateIntakeRecord(id: string, record: Partial<InsertIntakeRecord>): Promise<IntakeRecord | undefined>;

  // Shelter Tasks
  getShelterTasks(shelterId: string, status?: string): Promise<ShelterTask[]>;
  getDogTasks(dogId: string): Promise<ShelterTask[]>;
  getShelterTask(id: string): Promise<ShelterTask | undefined>;
  createShelterTask(task: InsertShelterTask): Promise<ShelterTask>;
  updateShelterTask(id: string, task: Partial<InsertShelterTask>): Promise<ShelterTask | undefined>;
  deleteShelterTask(id: string): Promise<void>;
  completeShelterTask(id: string, userId: string, notes?: string): Promise<ShelterTask | undefined>;

  // Medical Records
  getMedicalRecords(dogId: string): Promise<MedicalRecord[]>;
  getShelterMedicalRecords(shelterId: string): Promise<MedicalRecord[]>;
  getMedicalRecord(id: string): Promise<MedicalRecord | undefined>;
  createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord>;
  updateMedicalRecord(id: string, record: Partial<InsertMedicalRecord>): Promise<MedicalRecord | undefined>;
  deleteMedicalRecord(id: string): Promise<void>;
  getUpcomingVaccines(shelterId: string, days: number): Promise<MedicalRecord[]>;

  // Behavior Assessments
  getBehaviorAssessments(dogId: string): Promise<BehaviorAssessment[]>;
  getBehaviorAssessment(id: string): Promise<BehaviorAssessment | undefined>;
  getLatestBehaviorAssessment(dogId: string): Promise<BehaviorAssessment | undefined>;
  createBehaviorAssessment(assessment: InsertBehaviorAssessment): Promise<BehaviorAssessment>;
  updateBehaviorAssessment(id: string, assessment: Partial<InsertBehaviorAssessment>): Promise<BehaviorAssessment | undefined>;
  deleteBehaviorAssessment(id: string): Promise<void>;

  // Shelter Staff
  getShelterStaff(shelterId: string): Promise<ShelterStaff[]>;
  getShelterStaffMember(id: string): Promise<ShelterStaff | undefined>;
  createShelterStaff(staff: InsertShelterStaff): Promise<ShelterStaff>;
  updateShelterStaff(id: string, staff: Partial<InsertShelterStaff>): Promise<ShelterStaff | undefined>;
  deleteShelterStaff(id: string): Promise<void>;

  // Shelter Application Questions
  getShelterApplicationForm(shelterId: string): Promise<ShelterApplicationForm | undefined>;
  getShelterApplicationFormById(formId: string): Promise<ShelterApplicationForm | undefined>;
  createShelterApplicationForm(form: InsertShelterApplicationForm): Promise<ShelterApplicationForm>;
  updateShelterApplicationForm(id: string, form: Partial<InsertShelterApplicationForm>): Promise<ShelterApplicationForm | undefined>;
  getShelterApplicationQuestions(formId: string): Promise<ShelterApplicationQuestion[]>;
  getShelterApplicationQuestionsByShelterId(shelterId: string): Promise<ShelterApplicationQuestion[]>;
  getShelterApplicationQuestion(id: string): Promise<ShelterApplicationQuestion | undefined>;
  createShelterApplicationQuestion(question: InsertShelterApplicationQuestion): Promise<ShelterApplicationQuestion>;
  updateShelterApplicationQuestion(id: string, question: Partial<InsertShelterApplicationQuestion>): Promise<ShelterApplicationQuestion | undefined>;
  deleteShelterApplicationQuestion(id: string): Promise<void>;
  reorderShelterApplicationQuestions(formId: string, questionIds: string[]): Promise<void>;

  // Shelter Applicant Management (VAPI Phone Screening Approval)
  getShelterApplications(shelterId: string, status?: string): Promise<AdoptionJourney[]>;
  getShelterApplication(id: string): Promise<AdoptionJourney | undefined>;
  updateShelterApplicationStatus(id: string, status: string, reviewerId: string, notes?: string, reason?: string): Promise<AdoptionJourney | undefined>;

  // Shelter Dashboard Metrics
  getShelterDashboardMetrics(shelterId: string): Promise<{
    totalDogs: number;
    dogsInIntake: number;
    dogsReady: number;
    dogsInMedicalHold: number;
    pendingTasks: number;
    overdueTasks: number;
    upcomingVaccines: number;
    activeApplications: number;
  }>;

  // Shelter Communications (CRM)
  getShelterConversations(shelterId: string, status?: string): Promise<Conversation[]>;
  getShelterConversationWithDetails(conversationId: string): Promise<{
    conversation: Conversation;
    dog: Dog;
    adopter: { id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null };
    messages: Message[];
  } | undefined>;
  updateConversationStatus(conversationId: string, status: string, closedBy?: string): Promise<Conversation | undefined>;
  updateConversationPriority(conversationId: string, priority: string): Promise<Conversation | undefined>;
  assignConversation(conversationId: string, staffId: string | null): Promise<Conversation | undefined>;
  getShelterUnreadCount(shelterId: string): Promise<number>;
  markShelterMessagesAsRead(conversationId: string): Promise<void>;

  // ============================================
  // MARKETING / ADVERTISERS
  // ============================================

  // Advertisers
  getAllAdvertisers(): Promise<Advertiser[]>;
  getAdvertiser(id: string): Promise<Advertiser | undefined>;
  getActiveAdvertisers(): Promise<Advertiser[]>;
  createAdvertiser(advertiser: InsertAdvertiser): Promise<Advertiser>;
  updateAdvertiser(id: string, advertiser: Partial<InsertAdvertiser>): Promise<Advertiser | undefined>;
  deleteAdvertiser(id: string): Promise<void>;

  // Advertiser Locations
  getAdvertiserLocations(advertiserId: string): Promise<AdvertiserLocation[]>;
  getAllActiveAdvertiserLocations(): Promise<AdvertiserLocationWithBusiness[]>;
  getAdvertiserLocation(id: string): Promise<AdvertiserLocation | undefined>;
  createAdvertiserLocation(location: InsertAdvertiserLocation): Promise<AdvertiserLocation>;
  updateAdvertiserLocation(id: string, location: Partial<InsertAdvertiserLocation>): Promise<AdvertiserLocation | undefined>;
  deleteAdvertiserLocation(id: string): Promise<void>;

  // ============================================
  // AI SCAN METADATA (ML Improvement Pipeline)
  // ============================================
  createScanMetadata(metadata: {
    userId?: string | null;
    species: string;
    breed: string;
    breedConfidence: string;
    temperamentData?: any;
    bodyLanguageData?: any;
    scanTimestamp: Date;
  }): Promise<void>;

  // ============================================
  // FEATURE FLAGS
  // ============================================
  getAllFeatureFlags(): Promise<FeatureFlag[]>;
  getFeatureFlag(key: string): Promise<FeatureFlag | undefined>;
  getEnabledFeatureFlags(): Promise<FeatureFlag[]>;
  updateFeatureFlag(key: string, isEnabled: boolean, updatedBy?: string): Promise<FeatureFlag | undefined>;
  seedFeatureFlags(): Promise<void>;

  // ============================================
  // HEALTH SCREENING (AI-powered health analysis)
  // ============================================
  createHealthScreening(screening: InsertHealthScreeningResult): Promise<HealthScreeningResult>;
  getHealthScreening(id: string): Promise<HealthScreeningResult | undefined>;
  getHealthScreeningsByDog(dogId: string): Promise<HealthScreeningResult[]>;
  getHealthScreeningsByShelter(shelterId: string): Promise<HealthScreeningResult[]>;
  getUnreviewedHealthScreenings(shelterId: string): Promise<HealthScreeningResult[]>;
  reviewHealthScreening(id: string, reviewedBy: string, reviewNotes: string, medicalRecordId?: string): Promise<HealthScreeningResult | undefined>;

  // ============================================
  // PLUGINS
  // ============================================
  getAllPlugins(): Promise<Plugin[]>;
  getPublicPlugins(): Promise<Plugin[]>;
  getPlugin(id: string): Promise<Plugin | undefined>;
  getPluginBySlug(slug: string): Promise<Plugin | undefined>;
  createPlugin(plugin: InsertPlugin): Promise<Plugin>;
  updatePlugin(id: string, plugin: Partial<InsertPlugin>): Promise<Plugin | undefined>;
  deletePlugin(id: string): Promise<void>;
  seedPlugins(): Promise<void>;

  // ============================================
  // TASK RULES (Automations)
  // ============================================
  getActiveTaskRulesByTrigger(triggerType: string, shelterId: string): Promise<TaskRule[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (Required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    // Explicitly select all columns including admin fields
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        password: schema.users.password,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        profileImageUrl: schema.users.profileImageUrl,
        role: schema.users.role,
        isAdmin: schema.users.isAdmin,
        isActive: schema.users.isActive,
        adminRole: schema.users.adminRole,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    // Explicitly select all columns including admin fields
    const [user] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        password: schema.users.password,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        profileImageUrl: schema.users.profileImageUrl,
        role: schema.users.role,
        isAdmin: schema.users.isAdmin,
        isActive: schema.users.isActive,
        adminRole: schema.users.adminRole,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    return user;
  }

  async createUser(userData: { email: string; password: string | null; firstName: string; lastName: string; role: 'adopter' | 'shelter' | 'owner'; profileImageUrl?: string | null }): Promise<User> {
    const [user] = await db
      .insert(schema.users)
      .values({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl ?? null,
        role: userData.role,
        isAdmin: false,
        isActive: true,
      })
      .returning();
    return user;
  }

  async upsertUser(userData: {
    id: string;
    email: string;
    password?: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    role?: "adopter" | "shelter" | "owner";
  }) {
    const valuesToInsert = {
      id: userData.id,
      email: userData.email,
      password: userData.password || null,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      role: userData.role || "adopter",
    };

    const [user] = await db
      .insert(schema.users)
      .values(valuesToInsert)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          email: userData.email,
          password: userData.password || null,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();

    return user;
  }

  async updateUserRole(id: string, role: 'adopter' | 'shelter' | 'owner'): Promise<User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return user;
  }

  // User Profile Methods
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const result = await db.query.userProfiles.findFirst({
      where: eq(schema.userProfiles.userId, userId)
    });
    return result as UserProfile | undefined;
  }

  async getAllUserProfiles(): Promise<UserProfile[]> {
    const result = await db.query.userProfiles.findMany();
    return result as UserProfile[];
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [userProfile] = await db.insert(schema.userProfiles)
      .values(profile)
      .returning();
    return userProfile as UserProfile;
  }

  async updateUserProfile(userId: string, profile: Partial<InsertUserProfile>): Promise<UserProfile | undefined> {
    const [updated] = await db.update(schema.userProfiles)
      .set(profile)
      .where(eq(schema.userProfiles.userId, userId))
      .returning();
    return updated as UserProfile | undefined;
  }

  // Shelter Profile Methods
  async getShelterProfile(userId: string): Promise<ShelterProfile | undefined> {
    return db.query.shelterProfiles.findFirst({
      where: eq(schema.shelterProfiles.userId, userId),
    });
  }

  async getShelterProfileById(id: string): Promise<ShelterProfile | undefined> {
    return db.query.shelterProfiles.findFirst({
      where: eq(schema.shelterProfiles.id, id),
    });
  }

  async getAllShelterProfiles(): Promise<ShelterProfile[]> {
    return db.query.shelterProfiles.findMany();
  }

  async createShelterProfile(profile: Omit<InsertShelterProfile, 'id'>): Promise<ShelterProfile> {
    const [shelterProfile] = await db.insert(schema.shelterProfiles)
      .values(profile)
      .returning();
    return shelterProfile;
  }

  async updateShelterProfile(id: string, profile: Partial<InsertShelterProfile>): Promise<ShelterProfile | undefined> {
    const [updated] = await db.update(schema.shelterProfiles)
      .set(profile)
      .where(eq(schema.shelterProfiles.id, id))
      .returning();
    return updated;
  }

  // Owner Profile Methods
  async getOwnerProfile(userId: string): Promise<OwnerProfile | undefined> {
    const result = await db.query.ownerProfiles.findFirst({
      where: eq(schema.ownerProfiles.userId, userId)
    });
    return result;
  }

  async createOwnerProfile(profile: Omit<InsertOwnerProfile, 'id'>): Promise<OwnerProfile> {
    const [ownerProfile] = await db.insert(schema.ownerProfiles)
      .values(profile)
      .returning();
    return ownerProfile;
  }

  async updateOwnerProfile(id: string, profile: Partial<InsertOwnerProfile>): Promise<OwnerProfile | undefined> {
    const [updated] = await db.update(schema.ownerProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(schema.ownerProfiles.id, id))
      .returning();
    return updated;
  }

  // Dog Methods
  async getDog(id: string): Promise<Dog | undefined> {
    const result = await db.query.dogs.findFirst({
      where: eq(schema.dogs.id, id)
    });
    return result as Dog | undefined;
  }

  async getAllDogs(): Promise<Dog[]> {
    const result = await db.query.dogs.findMany();
    return result as Dog[];
  }

  async getUserDogs(userId: string): Promise<Dog[]> {
    const result = await db.query.dogs.findMany({
      where: eq(schema.dogs.userId, userId)
    });
    return result as Dog[];
  }

  async createDog(dog: InsertDog): Promise<Dog> {
    const [newDog] = await db.insert(schema.dogs)
      .values(dog)
      .returning();
    return newDog as Dog;
  }

  async updateDog(id: string, dogData: Partial<InsertDog>): Promise<Dog | undefined> {
    const [updatedDog] = await db.update(schema.dogs)
      .set(dogData)
      .where(eq(schema.dogs.id, id))
      .returning();
    return updatedDog as Dog | undefined;
  }

  async deleteDog(id: string): Promise<void> {
    await db.delete(schema.dogs)
      .where(eq(schema.dogs.id, id));
  }

  // Swipe Methods
  async getUserSwipes(userId: string): Promise<Swipe[]> {
    return await db.query.swipes.findMany({
      where: eq(schema.swipes.userId, userId)
    });
  }

  async createSwipe(swipe: InsertSwipe): Promise<Swipe> {
    const [newSwipe] = await db.insert(schema.swipes)
      .values(swipe)
      .returning();
    return newSwipe;
  }

  async getLikedDogs(userId: string): Promise<Array<{ dogId: string; likedAt: Date }>> {
    const swipes = await db.query.swipes.findMany({
      where: eq(schema.swipes.userId, userId)
    });
    return swipes
      .filter((swipe) => swipe.direction === "right")
      .map((swipe) => ({ dogId: swipe.dogId, likedAt: swipe.timestamp }));
  }

  async getLikedDogsWithDetails(userId: string): Promise<Array<Swipe & { dog: Dog }>> {
    const swipes = await db.query.swipes.findMany({
      where: and(
        eq(schema.swipes.userId, userId),
        eq(schema.swipes.direction, "right")
      ),
      orderBy: (swipes, { desc }) => [desc(swipes.timestamp)]
    });

    if (swipes.length === 0) return [];

    // Batch fetch all dogs in a single query to avoid N+1 issue
    const dogIds = swipes.map(s => s.dogId);
    const dogsResult = await db.query.dogs.findMany({
      where: sql`${schema.dogs.id} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`
    });
    const dogs = dogsResult as Dog[];

    // Create a Map for O(1) lookup
    const dogMap = new Map(dogs.map(dog => [dog.id, dog]));

    // Combine swipes with their dogs
    return swipes
      .filter(swipe => dogMap.has(swipe.dogId))
      .map(swipe => ({ ...swipe, dog: dogMap.get(swipe.dogId)! }));
  }

  async deleteUserSwipes(userId: string): Promise<void> {
    await db.delete(schema.swipes)
      .where(eq(schema.swipes.userId, userId));
  }

  // Chat Methods
  async getUserChatMessages(userId: string): Promise<ChatMessage[]> {
    return await db.query.chatMessages.findMany({
      where: eq(schema.chatMessages.userId, userId),
      orderBy: (chatMessages, { asc }) => [asc(chatMessages.timestamp)]
    });
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(schema.chatMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  // Conversation Methods
  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    const result = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, conversationId),
    });
    return result;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return await db.query.conversations.findMany({
      where: eq(schema.conversations.userId, userId),
      orderBy: (conversations, { desc }) => [desc(conversations.lastMessageAt)],
    });
  }

  async getConversationByDog(userId: string, dogId: string): Promise<Conversation | undefined> {
    const result = await db.query.conversations.findFirst({
      where: (conversations, { and, eq }) =>
        and(eq(conversations.userId, userId), eq(conversations.dogId, dogId)),
    });
    return result;
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db.insert(schema.conversations)
      .values(data)
      .returning();
    return newConversation;
  }

  async updateConversation(conversationId: string, data: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [updated] = await db.update(schema.conversations)
      .set(data)
      .where(eq(schema.conversations.id, conversationId))
      .returning();
    return updated;
  }

  async updateConversationTimestamp(conversationId: string): Promise<void> {
    await db.update(schema.conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(schema.conversations.id, conversationId));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    // Delete all messages in the conversation first
    await db.delete(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId));
    // Then delete the conversation
    await db.delete(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));
  }

  // Message Methods
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return await db.query.messages.findMany({
      where: eq(schema.messages.conversationId, conversationId),
      orderBy: (messages, { asc }) => [asc(messages.timestamp)],
    });
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(schema.messages)
      .values(data)
      .returning();
    await this.updateConversationTimestamp(data.conversationId);
    return newMessage;
  }

  async markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
    // Only mark messages as read that were sent TO the user (not by the user)
    await db.update(schema.messages)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.messages.conversationId, conversationId),
          eq(schema.messages.isRead, false),
          eq(schema.messages.senderType, "shelter") // Only shelter messages should be marked as read
        )
      );
  }

  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    // Only count unread messages sent TO the user (by the shelter)
    const result = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.conversationId, conversationId),
          eq(schema.messages.isRead, false),
          eq(schema.messages.senderType, "shelter")
        )
      );
    return result[0]?.count || 0;
  }

  // Admin Operations
  async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [updated] = await db.update(schema.users)
      .set({ isAdmin })
      .where(eq(schema.users.id, userId))
      .returning();
    return updated;
  }

  async updateUserActiveStatus(userId: string, isActive: boolean): Promise<User | undefined> {
    const [updated] = await db.update(schema.users)
      .set({ isActive })
      .where(eq(schema.users.id, userId))
      .returning();
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.query.users.findMany();
  }

  async getDashboardMetrics(): Promise<{
    totalUsers: number;
    totalAdopters: number;
    totalShelters: number;
    totalDogs: number;
    pendingShelters: number;
    pendingDogs: number;
    totalApplications: number;
    recentActivity: number;
  }> {
    const [userCount] = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.users);

    const [adopterCount] = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.users)
      .where(eq(schema.users.role, "adopter"));

    const [shelterCount] = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.users)
      .where(eq(schema.users.role, "shelter"));

    const [dogCount] = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.dogs);

    const [pendingShelterCount] = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.shelterProfiles)
      .where(eq(schema.shelterProfiles.approvalStatus, "pending"));

    const [pendingDogCount] = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.dogs)
      .where(eq(schema.dogs.approvalStatus, "pending"));

    // For now, use swipes as a proxy for recent activity
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentSwipes] = await db.select({ count: sql<number>`cast(count(*) as int)` })
      .from(schema.swipes)
      .where(sql`${schema.swipes.timestamp} > ${oneDayAgo}`);

    return {
      totalUsers: userCount?.count || 0,
      totalAdopters: adopterCount?.count || 0,
      totalShelters: shelterCount?.count || 0,
      totalDogs: dogCount?.count || 0,
      pendingShelters: pendingShelterCount?.count || 0,
      pendingDogs: pendingDogCount?.count || 0,
      totalApplications: 0, // TODO: Add adoption_journeys count
      recentActivity: recentSwipes?.count || 0,
    };
  }

  async approveShelter(shelterId: string, adminId: string): Promise<ShelterProfile | undefined> {
    const [updated] = await db.update(schema.shelterProfiles)
      .set({
        approvalStatus: "approved",
        approvedBy: adminId,
        approvedAt: new Date(),
      })
      .where(eq(schema.shelterProfiles.id, shelterId))
      .returning();
    return updated;
  }

  async rejectShelter(shelterId: string, adminId: string, reason: string): Promise<ShelterProfile | undefined> {
    const [updated] = await db.update(schema.shelterProfiles)
      .set({
        approvalStatus: "rejected",
        approvedBy: adminId,
        approvedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(schema.shelterProfiles.id, shelterId))
      .returning();
    return updated;
  }

  async approveDog(dogId: string, adminId: string): Promise<Dog | undefined> {
    const [updated] = await db.update(schema.dogs)
      .set({
        approvalStatus: "approved",
        approvedBy: adminId,
        approvedAt: new Date(),
      })
      .where(eq(schema.dogs.id, dogId))
      .returning();
    return updated as Dog | undefined;
  }

  async rejectDog(dogId: string, adminId: string, reason: string): Promise<Dog | undefined> {
    const [updated] = await db.update(schema.dogs)
      .set({
        approvalStatus: "rejected",
        approvedBy: adminId,
        approvedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(schema.dogs.id, dogId))
      .returning();
    return updated as Dog | undefined;
  }

  async getPendingShelters(): Promise<ShelterProfile[]> {
    return await db.query.shelterProfiles.findMany({
      where: eq(schema.shelterProfiles.approvalStatus, "pending"),
    });
  }

  async getPendingDogs(): Promise<Dog[]> {
    const result = await db.query.dogs.findMany({
      where: eq(schema.dogs.approvalStatus, "pending"),
    });
    return result as Dog[];
  }

  async getAdoptionRequirements(): Promise<AdoptionRequirements | undefined> {
    const requirements = await db.query.adoptionRequirements.findFirst();
    return requirements as AdoptionRequirements | undefined;
  }

  async updateAdoptionRequirements(requirements: Partial<AdoptionRequirements>): Promise<void> {
    const existing = await this.getAdoptionRequirements();

    if (existing) {
      await db.update(schema.adoptionRequirements)
        .set({
          ...requirements,
          updatedAt: new Date(),
        })
        .where(eq(schema.adoptionRequirements.id, existing.id));
    } else {
      await db.insert(schema.adoptionRequirements).values({
        id: randomUUID(),
        ...requirements,
      } as any);
    }
  }

  // Application Questions Methods
  async getApplicationQuestions(mode?: string): Promise<ApplicationQuestion[]> {
    if (mode && mode !== 'all') {
      return await db.select()
        .from(schema.applicationQuestions)
        .where(and(
          eq(schema.applicationQuestions.isActive, true),
          sql`(${schema.applicationQuestions.mode} = ${mode} OR ${schema.applicationQuestions.mode} = 'all')`
        ))
        .orderBy(asc(schema.applicationQuestions.position));
    }
    return await db.select()
      .from(schema.applicationQuestions)
      .orderBy(asc(schema.applicationQuestions.position));
  }

  async getApplicationQuestion(id: string): Promise<ApplicationQuestion | undefined> {
    const [question] = await db.select()
      .from(schema.applicationQuestions)
      .where(eq(schema.applicationQuestions.id, id));
    return question;
  }

  async createApplicationQuestion(question: InsertApplicationQuestion): Promise<ApplicationQuestion> {
    // Get highest position for this section
    const maxPos = await db.select({ maxPosition: sql<number>`COALESCE(MAX(position), 0)` })
      .from(schema.applicationQuestions);

    const [created] = await db.insert(schema.applicationQuestions)
      .values({
        ...question,
        position: (maxPos[0]?.maxPosition || 0) + 1,
      })
      .returning();
    return created;
  }

  async updateApplicationQuestion(id: string, question: Partial<InsertApplicationQuestion>): Promise<ApplicationQuestion | undefined> {
    const [updated] = await db.update(schema.applicationQuestions)
      .set({
        ...question,
        updatedAt: new Date(),
      })
      .where(eq(schema.applicationQuestions.id, id))
      .returning();
    return updated;
  }

  async deleteApplicationQuestion(id: string): Promise<void> {
    await db.delete(schema.applicationQuestions)
      .where(eq(schema.applicationQuestions.id, id));
  }

  async reorderApplicationQuestions(questionIds: string[]): Promise<void> {
    for (let i = 0; i < questionIds.length; i++) {
      await db.update(schema.applicationQuestions)
        .set({ position: i })
        .where(eq(schema.applicationQuestions.id, questionIds[i]));
    }
  }

  // Phone Screening Questions Methods
  async getPhoneScreeningQuestions(scenario?: string): Promise<PhoneScreeningQuestion[]> {
    if (scenario) {
      return await db.query.phoneScreeningQuestions.findMany({
        where: and(
          eq(schema.phoneScreeningQuestions.isActive, true),
          eq(schema.phoneScreeningQuestions.scenario, scenario)
        ),
        orderBy: (questions, { asc }) => [asc(questions.position)],
      });
    }
    return await db.query.phoneScreeningQuestions.findMany({
      orderBy: (questions, { asc }) => [asc(questions.position)],
    });
  }

  async getPhoneScreeningQuestion(id: string): Promise<PhoneScreeningQuestion | undefined> {
    return await db.query.phoneScreeningQuestions.findFirst({
      where: eq(schema.phoneScreeningQuestions.id, id),
    });
  }

  async createPhoneScreeningQuestion(question: InsertPhoneScreeningQuestion): Promise<PhoneScreeningQuestion> {
    const maxPos = await db.select({ maxPosition: sql<number>`COALESCE(MAX(position), 0)` })
      .from(schema.phoneScreeningQuestions);

    const [created] = await db.insert(schema.phoneScreeningQuestions)
      .values({
        ...question,
        position: (maxPos[0]?.maxPosition || 0) + 1,
      })
      .returning();
    return created;
  }

  async updatePhoneScreeningQuestion(id: string, question: Partial<InsertPhoneScreeningQuestion>): Promise<PhoneScreeningQuestion | undefined> {
    const [updated] = await db.update(schema.phoneScreeningQuestions)
      .set({
        ...question,
        updatedAt: new Date(),
      })
      .where(eq(schema.phoneScreeningQuestions.id, id))
      .returning();
    return updated;
  }

  async deletePhoneScreeningQuestion(id: string): Promise<void> {
    await db.delete(schema.phoneScreeningQuestions)
      .where(eq(schema.phoneScreeningQuestions.id, id));
  }

  async reorderPhoneScreeningQuestions(questionIds: string[]): Promise<void> {
    for (let i = 0; i < questionIds.length; i++) {
      await db.update(schema.phoneScreeningQuestions)
        .set({ position: i })
        .where(eq(schema.phoneScreeningQuestions.id, questionIds[i]));
    }
  }

  // Vapi Knowledge Base Methods
  async getVapiKnowledgeBaseEntries(category?: string, publishedOnly?: boolean): Promise<VapiKnowledgeBaseEntry[]> {
    let conditions = [];
    if (category) {
      conditions.push(eq(schema.vapiKnowledgeBase.category, category));
    }
    if (publishedOnly) {
      conditions.push(eq(schema.vapiKnowledgeBase.isPublished, true));
    }

    if (conditions.length > 0) {
      return await db.query.vapiKnowledgeBase.findMany({
        where: conditions.length === 1 ? conditions[0] : and(...conditions),
        orderBy: (entries, { desc }) => [desc(entries.priority), desc(entries.updatedAt)],
      });
    }
    return await db.query.vapiKnowledgeBase.findMany({
      orderBy: (entries, { desc }) => [desc(entries.priority), desc(entries.updatedAt)],
    });
  }

  async getVapiKnowledgeBaseEntry(id: string): Promise<VapiKnowledgeBaseEntry | undefined> {
    return await db.query.vapiKnowledgeBase.findFirst({
      where: eq(schema.vapiKnowledgeBase.id, id),
    });
  }

  async createVapiKnowledgeBaseEntry(entry: InsertVapiKnowledgeBaseEntry): Promise<VapiKnowledgeBaseEntry> {
    const [created] = await db.insert(schema.vapiKnowledgeBase)
      .values(entry)
      .returning();
    return created;
  }

  async updateVapiKnowledgeBaseEntry(id: string, entry: Partial<InsertVapiKnowledgeBaseEntry>): Promise<VapiKnowledgeBaseEntry | undefined> {
    const [updated] = await db.update(schema.vapiKnowledgeBase)
      .set({
        ...entry,
        updatedAt: new Date(),
      })
      .where(eq(schema.vapiKnowledgeBase.id, id))
      .returning();
    return updated;
  }

  async deleteVapiKnowledgeBaseEntry(id: string): Promise<void> {
    await db.delete(schema.vapiKnowledgeBase)
      .where(eq(schema.vapiKnowledgeBase.id, id));
  }

  async publishVapiKnowledgeBaseEntry(id: string, publish: boolean): Promise<VapiKnowledgeBaseEntry | undefined> {
    const [updated] = await db.update(schema.vapiKnowledgeBase)
      .set({
        isPublished: publish,
        updatedAt: new Date(),
      })
      .where(eq(schema.vapiKnowledgeBase.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // VAPI DASHBOARD METHODS
  // ============================================

  async getVapiCallLogs(options: { type?: string; status?: string; limit: number; offset: number }): Promise<{
    calls: Array<{
      id: string;
      type: 'phone_screening' | 'consultation';
      status: string;
      userId: string;
      userName?: string;
      dogId?: string;
      dogName?: string;
      vapiCallId?: string;
      transcript?: string;
      summary?: string;
      analytics?: any;
      createdAt: Date;
      completedAt?: Date;
    }>;
    total: number;
  }> {
    const calls: Array<any> = [];
    
    // Get phone screening calls from adoption journeys
    // Note: consultationCalls table was removed - now only using adoptionJourneys
    if (!options.type || options.type === 'phone_screening' || options.type === 'all') {
      const phoneScreeningCalls = await db.select({
        id: schema.adoptionJourneys.id,
        userId: schema.adoptionJourneys.userId,
        dogId: schema.adoptionJourneys.dogId,
        vapiCallId: schema.adoptionJourneys.vapiCallId,
        status: schema.adoptionJourneys.phoneScreeningStatus,
        transcript: schema.adoptionJourneys.phoneScreeningTranscript,
        summary: schema.adoptionJourneys.phoneScreeningSummary,
        analytics: schema.adoptionJourneys.phoneScreeningNotes,
        createdAt: schema.adoptionJourneys.phoneScreeningScheduledAt,
        completedAt: schema.adoptionJourneys.phoneScreeningCompletedAt,
        userName: schema.users.firstName,
        userLastName: schema.users.lastName,
        dogName: schema.dogs.name,
      })
      .from(schema.adoptionJourneys)
      .leftJoin(schema.users, eq(schema.adoptionJourneys.userId, schema.users.id))
      .leftJoin(schema.dogs, eq(schema.adoptionJourneys.dogId, schema.dogs.id))
      .where(
        options.status 
          ? and(
              sql`${schema.adoptionJourneys.vapiCallId} IS NOT NULL`,
              eq(schema.adoptionJourneys.phoneScreeningStatus, options.status)
            )
          : sql`${schema.adoptionJourneys.vapiCallId} IS NOT NULL`
      )
      .orderBy(desc(schema.adoptionJourneys.phoneScreeningScheduledAt));
      
      for (const call of phoneScreeningCalls) {
        let parsedAnalytics = undefined;
        if (call.analytics) {
          try {
            parsedAnalytics = JSON.parse(call.analytics);
          } catch (e) {
            parsedAnalytics = undefined;
          }
        }
        calls.push({
          id: call.id,
          type: 'phone_screening' as const,
          status: call.status || 'pending',
          userId: call.userId,
          userName: call.userName && call.userLastName ? `${call.userName} ${call.userLastName}` : call.userName || undefined,
          dogId: call.dogId,
          dogName: call.dogName || undefined,
          vapiCallId: call.vapiCallId || undefined,
          transcript: call.transcript || undefined,
          summary: call.summary || undefined,
          analytics: parsedAnalytics,
          createdAt: call.createdAt || new Date(),
          completedAt: call.completedAt || undefined,
        });
      }
    }
    
    // Sort by createdAt descending
    calls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const total = calls.length;
    const paginatedCalls = calls.slice(options.offset, options.offset + options.limit);
    
    return { calls: paginatedCalls, total };
  }

  async getVapiDashboardStats(): Promise<{
    totalCalls: number;
    completedCalls: number;
    averageSentiment: number;
    callsByType: { type: string; count: number }[];
    recentCalls: number;
    topConcerns: string[];
  }> {
    // Get all phone screening calls with Vapi IDs
    const phoneScreeningCalls = await db.select({
      status: schema.adoptionJourneys.phoneScreeningStatus,
      analytics: schema.adoptionJourneys.phoneScreeningNotes,
      scheduledAt: schema.adoptionJourneys.phoneScreeningScheduledAt,
    })
    .from(schema.adoptionJourneys)
    .where(sql`${schema.adoptionJourneys.vapiCallId} IS NOT NULL`);
    
    const totalCalls = phoneScreeningCalls.length;
    const completedCalls = phoneScreeningCalls.filter(c => c.status === 'completed').length;
    
    // Calculate average sentiment
    let totalSentiment = 0;
    let sentimentCount = 0;
    const allConcerns: string[] = [];
    
    for (const call of phoneScreeningCalls) {
      if (call.analytics) {
        try {
          const analytics = JSON.parse(call.analytics);
          if (analytics.sentiment) {
            // Convert sentiment string to number
            const sentimentMap: Record<string, number> = { 'negative': 1, 'neutral': 3, 'positive': 5 };
            totalSentiment += sentimentMap[analytics.sentiment] || 3;
            sentimentCount++;
          }
          if (analytics.concerns && Array.isArray(analytics.concerns)) {
            allConcerns.push(...analytics.concerns);
          }
        } catch (e) {}
      }
    }
    
    const averageSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 3;
    
    // Count concerns
    const concernCounts: Record<string, number> = {};
    for (const concern of allConcerns) {
      concernCounts[concern] = (concernCounts[concern] || 0) + 1;
    }
    const topConcerns = Object.entries(concernCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([concern]) => concern);
    
    // Recent calls (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentCalls = phoneScreeningCalls.filter(c => 
      c.scheduledAt && new Date(c.scheduledAt) >= sevenDaysAgo
    ).length;
    
    return {
      totalCalls,
      completedCalls,
      averageSentiment,
      callsByType: [
        { type: 'Phone Screening', count: phoneScreeningCalls.length },
      ],
      recentCalls,
      topConcerns,
    };
  }

  // ============================================
  // SHELTER CRM METHODS
  // ============================================

  // Intake Records
  async getIntakeRecords(shelterId: string): Promise<IntakeRecord[]> {
    return await db.select()
      .from(schema.intakeRecords)
      .where(eq(schema.intakeRecords.shelterId, shelterId))
      .orderBy(desc(schema.intakeRecords.intakeDate));
  }

  async getIntakeRecord(id: string): Promise<IntakeRecord | undefined> {
    const [record] = await db.select()
      .from(schema.intakeRecords)
      .where(eq(schema.intakeRecords.id, id))
      .limit(1);
    return record;
  }

  async getIntakeRecordByDog(dogId: string): Promise<IntakeRecord | undefined> {
    const [record] = await db.select()
      .from(schema.intakeRecords)
      .where(eq(schema.intakeRecords.dogId, dogId))
      .limit(1);
    return record;
  }

  async createIntakeRecord(record: InsertIntakeRecord): Promise<IntakeRecord> {
    const [created] = await db.insert(schema.intakeRecords)
      .values(record)
      .returning();
    return created;
  }

  async updateIntakeRecord(id: string, record: Partial<InsertIntakeRecord>): Promise<IntakeRecord | undefined> {
    const [updated] = await db.update(schema.intakeRecords)
      .set({
        ...record,
        updatedAt: new Date(),
      })
      .where(eq(schema.intakeRecords.id, id))
      .returning();
    return updated;
  }

  // Shelter Tasks
  async getShelterTasks(shelterId: string, status?: string): Promise<ShelterTask[]> {
    let conditions = [eq(schema.shelterTasks.shelterId, shelterId)];
    if (status) {
      conditions.push(eq(schema.shelterTasks.status, status));
    }
    return await db.query.shelterTasks.findMany({
      where: conditions.length === 1 ? conditions[0] : and(...conditions),
      orderBy: (tasks, { asc, desc }) => [
        asc(tasks.status),
        asc(tasks.dueDate),
      ],
    });
  }

  async getDogTasks(dogId: string): Promise<ShelterTask[]> {
    return await db.query.shelterTasks.findMany({
      where: eq(schema.shelterTasks.dogId, dogId),
      orderBy: (tasks, { asc }) => [asc(tasks.dueDate)],
    });
  }

  async getShelterTask(id: string): Promise<ShelterTask | undefined> {
    return await db.query.shelterTasks.findFirst({
      where: eq(schema.shelterTasks.id, id),
    });
  }

  async createShelterTask(task: InsertShelterTask): Promise<ShelterTask> {
    const [created] = await db.insert(schema.shelterTasks)
      .values(task)
      .returning();
    return created;
  }

  async updateShelterTask(id: string, task: Partial<InsertShelterTask>): Promise<ShelterTask | undefined> {
    const [updated] = await db.update(schema.shelterTasks)
      .set({
        ...task,
        updatedAt: new Date(),
      })
      .where(eq(schema.shelterTasks.id, id))
      .returning();
    return updated;
  }

  async deleteShelterTask(id: string): Promise<void> {
    await db.delete(schema.shelterTasks)
      .where(eq(schema.shelterTasks.id, id));
  }

  async completeShelterTask(id: string, userId: string, notes?: string): Promise<ShelterTask | undefined> {
    const [updated] = await db.update(schema.shelterTasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy: userId,
        completionNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.shelterTasks.id, id))
      .returning();
    return updated;
  }

  // Medical Records
  async getMedicalRecords(dogId: string): Promise<MedicalRecord[]> {
    return await db.query.medicalRecords.findMany({
      where: eq(schema.medicalRecords.dogId, dogId),
      orderBy: (records, { desc }) => [desc(records.performedAt)],
    });
  }

  async getShelterMedicalRecords(shelterId: string): Promise<MedicalRecord[]> {
    return await db.query.medicalRecords.findMany({
      where: eq(schema.medicalRecords.shelterId, shelterId),
      orderBy: (records, { desc }) => [desc(records.performedAt)],
    });
  }

  async getMedicalRecord(id: string): Promise<MedicalRecord | undefined> {
    return await db.query.medicalRecords.findFirst({
      where: eq(schema.medicalRecords.id, id),
    });
  }

  async createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord> {
    const [created] = await db.insert(schema.medicalRecords)
      .values(record)
      .returning();
    return created;
  }

  async updateMedicalRecord(id: string, record: Partial<InsertMedicalRecord>): Promise<MedicalRecord | undefined> {
    const [updated] = await db.update(schema.medicalRecords)
      .set({
        ...record,
        updatedAt: new Date(),
      })
      .where(eq(schema.medicalRecords.id, id))
      .returning();
    return updated;
  }

  async deleteMedicalRecord(id: string): Promise<void> {
    await db.delete(schema.medicalRecords)
      .where(eq(schema.medicalRecords.id, id));
  }

  async getUpcomingVaccines(shelterId: string, days: number): Promise<MedicalRecord[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await db.query.medicalRecords.findMany({
      where: and(
        eq(schema.medicalRecords.shelterId, shelterId),
        eq(schema.medicalRecords.recordType, 'vaccine'),
        sql`${schema.medicalRecords.nextDueDate} IS NOT NULL AND ${schema.medicalRecords.nextDueDate} <= ${futureDate}`
      ),
      orderBy: (records, { asc }) => [asc(records.nextDueDate)],
    });
  }

  // Behavior Assessments
  async getBehaviorAssessments(dogId: string): Promise<BehaviorAssessment[]> {
    return await db.query.behaviorAssessments.findMany({
      where: eq(schema.behaviorAssessments.dogId, dogId),
      orderBy: (assessments, { desc }) => [desc(assessments.assessmentDate)],
    });
  }

  async getBehaviorAssessment(id: string): Promise<BehaviorAssessment | undefined> {
    return await db.query.behaviorAssessments.findFirst({
      where: eq(schema.behaviorAssessments.id, id),
    });
  }

  async getLatestBehaviorAssessment(dogId: string): Promise<BehaviorAssessment | undefined> {
    return await db.query.behaviorAssessments.findFirst({
      where: eq(schema.behaviorAssessments.dogId, dogId),
      orderBy: (assessments, { desc }) => [desc(assessments.assessmentDate)],
    });
  }

  async createBehaviorAssessment(assessment: InsertBehaviorAssessment): Promise<BehaviorAssessment> {
    const [created] = await db.insert(schema.behaviorAssessments)
      .values(assessment)
      .returning();
    return created;
  }

  async updateBehaviorAssessment(id: string, assessment: Partial<InsertBehaviorAssessment>): Promise<BehaviorAssessment | undefined> {
    const [updated] = await db.update(schema.behaviorAssessments)
      .set({
        ...assessment,
        updatedAt: new Date(),
      })
      .where(eq(schema.behaviorAssessments.id, id))
      .returning();
    return updated;
  }

  async deleteBehaviorAssessment(id: string): Promise<void> {
    await db.delete(schema.behaviorAssessments)
      .where(eq(schema.behaviorAssessments.id, id));
  }

  // Shelter Staff
  async getShelterStaff(shelterId: string): Promise<ShelterStaff[]> {
    return await db.query.shelterStaff.findMany({
      where: eq(schema.shelterStaff.shelterId, shelterId),
    });
  }

  async getShelterStaffMember(id: string): Promise<ShelterStaff | undefined> {
    return await db.query.shelterStaff.findFirst({
      where: eq(schema.shelterStaff.id, id),
    });
  }

  async createShelterStaff(staff: InsertShelterStaff): Promise<ShelterStaff> {
    const [created] = await db.insert(schema.shelterStaff)
      .values(staff)
      .returning();
    return created;
  }

  async updateShelterStaff(id: string, staff: Partial<InsertShelterStaff>): Promise<ShelterStaff | undefined> {
    const [updated] = await db.update(schema.shelterStaff)
      .set({
        ...staff,
        updatedAt: new Date(),
      })
      .where(eq(schema.shelterStaff.id, id))
      .returning();
    return updated;
  }

  async deleteShelterStaff(id: string): Promise<void> {
    await db.delete(schema.shelterStaff)
      .where(eq(schema.shelterStaff.id, id));
  }

  // Shelter Application Questions
  async getShelterApplicationForm(shelterId: string): Promise<ShelterApplicationForm | undefined> {
    return await db.query.shelterApplicationForms.findFirst({
      where: and(
        eq(schema.shelterApplicationForms.shelterId, shelterId),
        eq(schema.shelterApplicationForms.isDefault, true)
      ),
    });
  }

  async getShelterApplicationFormById(formId: string): Promise<ShelterApplicationForm | undefined> {
    return await db.query.shelterApplicationForms.findFirst({
      where: eq(schema.shelterApplicationForms.id, formId),
    });
  }

  async createShelterApplicationForm(form: InsertShelterApplicationForm): Promise<ShelterApplicationForm> {
    const [created] = await db.insert(schema.shelterApplicationForms)
      .values(form)
      .returning();
    return created;
  }

  async updateShelterApplicationForm(id: string, form: Partial<InsertShelterApplicationForm>): Promise<ShelterApplicationForm | undefined> {
    const [updated] = await db.update(schema.shelterApplicationForms)
      .set({
        ...form,
        updatedAt: new Date(),
      })
      .where(eq(schema.shelterApplicationForms.id, id))
      .returning();
    return updated;
  }

  async getShelterApplicationQuestions(formId: string): Promise<ShelterApplicationQuestion[]> {
    return await db.query.shelterApplicationQuestions.findMany({
      where: and(
        eq(schema.shelterApplicationQuestions.formId, formId),
        eq(schema.shelterApplicationQuestions.isActive, true)
      ),
      orderBy: asc(schema.shelterApplicationQuestions.position),
    });
  }

  async getShelterApplicationQuestionsByShelterId(shelterId: string): Promise<ShelterApplicationQuestion[]> {
    return await db.query.shelterApplicationQuestions.findMany({
      where: and(
        eq(schema.shelterApplicationQuestions.shelterId, shelterId),
        eq(schema.shelterApplicationQuestions.isActive, true)
      ),
      orderBy: asc(schema.shelterApplicationQuestions.position),
    });
  }

  async getShelterApplicationQuestion(id: string): Promise<ShelterApplicationQuestion | undefined> {
    return await db.query.shelterApplicationQuestions.findFirst({
      where: eq(schema.shelterApplicationQuestions.id, id),
    });
  }

  async createShelterApplicationQuestion(question: InsertShelterApplicationQuestion): Promise<ShelterApplicationQuestion> {
    const [created] = await db.insert(schema.shelterApplicationQuestions)
      .values(question)
      .returning();
    return created;
  }

  async updateShelterApplicationQuestion(id: string, question: Partial<InsertShelterApplicationQuestion>): Promise<ShelterApplicationQuestion | undefined> {
    const [updated] = await db.update(schema.shelterApplicationQuestions)
      .set({
        ...question,
        updatedAt: new Date(),
      })
      .where(eq(schema.shelterApplicationQuestions.id, id))
      .returning();
    return updated;
  }

  async deleteShelterApplicationQuestion(id: string): Promise<void> {
    // Soft delete by setting isActive to false
    await db.update(schema.shelterApplicationQuestions)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.shelterApplicationQuestions.id, id));
  }

  async reorderShelterApplicationQuestions(formId: string, questionIds: string[]): Promise<void> {
    // Update position for each question
    await Promise.all(questionIds.map((id, index) =>
      db.update(schema.shelterApplicationQuestions)
        .set({ position: index, updatedAt: new Date() })
        .where(and(
          eq(schema.shelterApplicationQuestions.id, id),
          eq(schema.shelterApplicationQuestions.formId, formId)
        ))
    ));
  }

  // Shelter Applicant Management (VAPI Phone Screening Approval)
  async getShelterApplications(shelterId: string, status?: string): Promise<AdoptionJourney[]> {
    // Get all dogs for this shelter first
    const shelterDogs = await db.query.dogs.findMany({
      where: eq(schema.dogs.shelterId, shelterId),
    });
    const dogIds = shelterDogs.map(d => d.id);
    
    if (dogIds.length === 0) return [];

    // Build conditions for journeys linked to shelter's dogs
    let conditions = [
      sql`${schema.adoptionJourneys.dogId} IN (${sql.join(dogIds.map(id => sql`${id}`), sql`, `)})`
    ];
    
    if (status) {
      conditions.push(eq(schema.adoptionJourneys.shelterApprovalStatus, status));
    }
    
    return await db.query.adoptionJourneys.findMany({
      where: and(...conditions),
      orderBy: (journeys, { desc }) => [desc(journeys.createdAt)],
    });
  }

  async getShelterApplication(id: string): Promise<AdoptionJourney | undefined> {
    return await db.query.adoptionJourneys.findFirst({
      where: eq(schema.adoptionJourneys.id, id),
    });
  }

  async updateShelterApplicationStatus(id: string, status: string, reviewerId: string, notes?: string, reason?: string): Promise<AdoptionJourney | undefined> {
    const updates: any = {
      shelterApprovalStatus: status,
      shelterNotes: notes || null,
      updatedAt: new Date(),
    };
    
    if (status === 'approved') {
      updates.shelterApprovedAt = new Date();
      updates.shelterApprovedBy = reviewerId;
    } else if (status === 'rejected') {
      updates.shelterRejectedAt = new Date();
      updates.shelterRejectedBy = reviewerId;
      updates.shelterRejectionReason = reason || null;
    }
    
    const [updated] = await db.update(schema.adoptionJourneys)
      .set(updates)
      .where(eq(schema.adoptionJourneys.id, id))
      .returning();
    return updated;
  }

  // Shelter Dashboard Metrics
  async getShelterDashboardMetrics(shelterId: string): Promise<{
    totalDogs: number;
    dogsInIntake: number;
    dogsReady: number;
    dogsInMedicalHold: number;
    pendingTasks: number;
    overdueTasks: number;
    upcomingVaccines: number;
    activeApplications: number;
  }> {
    // Get all dogs for this shelter
    const dogs = await db.query.dogs.findMany({
      where: eq(schema.dogs.userId, shelterId),
    });

    // Get intake records for pipeline status
    const intakeRecords = await this.getIntakeRecords(shelterId);
    const intakeByDog = new Map(intakeRecords.map(r => [r.dogId, r]));

    // Count dogs by pipeline status
    let dogsInIntake = 0;
    let dogsReady = 0;
    let dogsInMedicalHold = 0;

    for (const dog of dogs) {
      const intake = intakeByDog.get(dog.id);
      if (intake) {
        switch (intake.pipelineStatus) {
          case 'intake':
          case 'behavior_eval':
            dogsInIntake++;
            break;
          case 'ready':
            dogsReady++;
            break;
          case 'medical_hold':
            dogsInMedicalHold++;
            break;
        }
      } else {
        // No intake record, consider as ready
        dogsReady++;
      }
    }

    // Get tasks
    const tasks = await this.getShelterTasks(shelterId);
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    const now = new Date();
    const overdueTasks = tasks.filter(t =>
      (t.status === 'pending' || t.status === 'in_progress') &&
      t.dueDate &&
      new Date(t.dueDate) < now
    ).length;

    // Get upcoming vaccines (next 30 days)
    const upcomingVaccines = (await this.getUpcomingVaccines(shelterId, 30)).length;

    // Get active applications (journeys)
    const journeys = await db.query.adoptionJourneys.findMany({
      where: and(
        sql`${schema.adoptionJourneys.dogId} IN (SELECT id FROM dogs WHERE user_id = ${shelterId})`,
        eq(schema.adoptionJourneys.status, 'active')
      ),
    });

    return {
      totalDogs: dogs.length,
      dogsInIntake,
      dogsReady,
      dogsInMedicalHold,
      pendingTasks,
      overdueTasks,
      upcomingVaccines,
      activeApplications: journeys.length,
    };
  }

  // Shelter Communications (CRM)
  async getShelterConversations(shelterId: string, status?: string): Promise<Conversation[]> {
    let conditions = [eq(schema.conversations.shelterId, shelterId)];
    if (status) {
      conditions.push(eq(schema.conversations.status, status));
    }
    return await db.query.conversations.findMany({
      where: and(...conditions),
      orderBy: (conversations, { desc }) => [desc(conversations.lastMessageAt)],
    });
  }

  async getShelterConversationWithDetails(conversationId: string): Promise<{
    conversation: Conversation;
    dog: Dog;
    adopter: { id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null };
    messages: Message[];
  } | undefined> {
    const conversation = await db.query.conversations.findFirst({
      where: eq(schema.conversations.id, conversationId),
    });
    if (!conversation) return undefined;

    const dog = await db.query.dogs.findFirst({
      where: eq(schema.dogs.id, conversation.dogId),
    });
    if (!dog) return undefined;

    const adopter = await db.query.users.findFirst({
      where: eq(schema.users.id, conversation.userId),
    });
    if (!adopter) return undefined;

    const messages = await this.getConversationMessages(conversationId);

    return {
      conversation,
      dog,
      adopter: {
        id: adopter.id,
        firstName: adopter.firstName,
        lastName: adopter.lastName,
        email: adopter.email,
        profileImageUrl: adopter.profileImageUrl,
      },
      messages,
    };
  }

  async updateConversationStatus(conversationId: string, status: string, closedBy?: string): Promise<Conversation | undefined> {
    const updateData: any = { status };
    if (status === 'closed') {
      updateData.closedAt = new Date();
      updateData.closedBy = closedBy;
    }
    const [updated] = await db.update(schema.conversations)
      .set(updateData)
      .where(eq(schema.conversations.id, conversationId))
      .returning();
    return updated;
  }

  async updateConversationPriority(conversationId: string, priority: string): Promise<Conversation | undefined> {
    const [updated] = await db.update(schema.conversations)
      .set({ priority })
      .where(eq(schema.conversations.id, conversationId))
      .returning();
    return updated;
  }

  async assignConversation(conversationId: string, staffId: string | null): Promise<Conversation | undefined> {
    const [updated] = await db.update(schema.conversations)
      .set({ assignedTo: staffId })
      .where(eq(schema.conversations.id, conversationId))
      .returning();
    return updated;
  }

  async getShelterUnreadCount(shelterId: string): Promise<number> {
    const result = await db.select({
      count: sql<number>`cast(sum(${schema.conversations.shelterUnreadCount}) as int)`
    })
      .from(schema.conversations)
      .where(eq(schema.conversations.shelterId, shelterId));
    return result[0]?.count || 0;
  }

  async markShelterMessagesAsRead(conversationId: string): Promise<void> {
    await db.update(schema.conversations)
      .set({ shelterUnreadCount: 0 })
      .where(eq(schema.conversations.id, conversationId));

    await db.update(schema.messages)
      .set({ isRead: true })
      .where(
        and(
          eq(schema.messages.conversationId, conversationId),
          eq(schema.messages.isRead, false),
          eq(schema.messages.senderType, "adopter")
        )
      );
  }

  // ============================================
  // MARKETING / ADVERTISERS
  // ============================================

  async getAllAdvertisers(): Promise<Advertiser[]> {
    return db.query.advertisers.findMany({
      orderBy: (advertisers, { desc }) => [desc(advertisers.createdAt)],
    });
  }

  async getAdvertiser(id: string): Promise<Advertiser | undefined> {
    return db.query.advertisers.findFirst({
      where: eq(schema.advertisers.id, id),
    });
  }

  async getActiveAdvertisers(): Promise<Advertiser[]> {
    return db.query.advertisers.findMany({
      where: eq(schema.advertisers.status, "active"),
      orderBy: (advertisers, { asc }) => [asc(advertisers.name)],
    });
  }

  async createAdvertiser(advertiser: InsertAdvertiser): Promise<Advertiser> {
    const [created] = await db.insert(schema.advertisers)
      .values(advertiser)
      .returning();
    return created;
  }

  async updateAdvertiser(id: string, advertiser: Partial<InsertAdvertiser>): Promise<Advertiser | undefined> {
    const [updated] = await db.update(schema.advertisers)
      .set({ ...advertiser, updatedAt: new Date() })
      .where(eq(schema.advertisers.id, id))
      .returning();
    return updated;
  }

  async deleteAdvertiser(id: string): Promise<void> {
    // Delete all locations first
    await db.delete(schema.advertiserLocations)
      .where(eq(schema.advertiserLocations.advertiserId, id));
    // Then delete the advertiser
    await db.delete(schema.advertisers)
      .where(eq(schema.advertisers.id, id));
  }

  async getAdvertiserLocations(advertiserId: string): Promise<AdvertiserLocation[]> {
    return db.query.advertiserLocations.findMany({
      where: eq(schema.advertiserLocations.advertiserId, advertiserId),
      orderBy: (locations, { asc }) => [asc(locations.name)],
    });
  }

  async getAllActiveAdvertiserLocations(): Promise<AdvertiserLocationWithBusiness[]> {
    const locations = await db
      .select()
      .from(schema.advertiserLocations)
      .innerJoin(schema.advertisers, eq(schema.advertiserLocations.advertiserId, schema.advertisers.id))
      .where(
        and(
          eq(schema.advertiserLocations.isActive, true),
          eq(schema.advertisers.status, "active")
        )
      );

    return locations.map(row => ({
      ...row.advertiser_locations,
      advertiser: row.advertisers,
    }));
  }

  async getAdvertiserLocation(id: string): Promise<AdvertiserLocation | undefined> {
    return db.query.advertiserLocations.findFirst({
      where: eq(schema.advertiserLocations.id, id),
    });
  }

  async createAdvertiserLocation(location: InsertAdvertiserLocation): Promise<AdvertiserLocation> {
    const [created] = await db.insert(schema.advertiserLocations)
      .values(location)
      .returning();
    return created;
  }

  async updateAdvertiserLocation(id: string, location: Partial<InsertAdvertiserLocation>): Promise<AdvertiserLocation | undefined> {
    const [updated] = await db.update(schema.advertiserLocations)
      .set({ ...location, updatedAt: new Date() })
      .where(eq(schema.advertiserLocations.id, id))
      .returning();
    return updated;
  }

  async deleteAdvertiserLocation(id: string): Promise<void> {
    await db.delete(schema.advertiserLocations)
      .where(eq(schema.advertiserLocations.id, id));
  }

  // ============================================
  // AI SCAN METADATA (ML Improvement Pipeline)
  // ============================================
  async createScanMetadata(metadata: {
    userId?: string | null;
    species: string;
    breed: string;
    breedConfidence: string;
    temperamentData?: any;
    bodyLanguageData?: any;
    scanTimestamp: Date;
  }): Promise<void> {
    await db.insert(schema.scanMetadata).values({
      userId: metadata.userId || null,
      species: metadata.species,
      breed: metadata.breed,
      breedConfidence: metadata.breedConfidence,
      temperamentData: metadata.temperamentData || null,
      bodyLanguageData: metadata.bodyLanguageData || null,
      scanTimestamp: metadata.scanTimestamp,
    });
  }

  // Animal Types Management
  async getEnabledAnimalTypes(): Promise<{ id: string; label: string }[]> {
    const settings = await db.select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.settingKey, 'enabled_animal_types'))
      .limit(1);

    if (settings.length === 0) {
      // Default: only dogs enabled
      return [{ id: 'dog', label: 'Dogs' }];
    }

    return settings[0].settingValue as { id: string; label: string }[];
  }

  async getAllAnimalTypes(): Promise<{ id: string; enabled: boolean }[]> {
    const settings = await db.select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.settingKey, 'enabled_animal_types'))
      .limit(1);

    const ANIMAL_TYPES = [
      { id: 'dog', label: 'Dogs', enabled: true },
      { id: 'cat', label: 'Cats', enabled: false },
      { id: 'bird', label: 'Birds', enabled: false },
      { id: 'rabbit', label: 'Rabbits', enabled: false },
      { id: 'other', label: 'Other Animals', enabled: false },
    ];

    if (settings.length === 0) {
      return ANIMAL_TYPES;
    }

    const enabledTypes = settings[0].settingValue as { id: string; label: string }[];
    const enabledIds = new Set(enabledTypes.map(t => t.id));

    return ANIMAL_TYPES.map(type => ({
      id: type.id,
      enabled: enabledIds.has(type.id),
    }));
  }

  async updateAnimalTypes(types: { id: string; enabled: boolean }[]): Promise<void> {
    const ANIMAL_TYPES_MAP = {
      dog: 'Dogs',
      cat: 'Cats',
      bird: 'Birds',
      rabbit: 'Rabbits',
      other: 'Other Animals',
    };

    const enabledTypes = types
      .filter(t => t.enabled)
      .map(t => ({
        id: t.id,
        label: ANIMAL_TYPES_MAP[t.id as keyof typeof ANIMAL_TYPES_MAP] || t.id,
      }));

    const existing = await db.select()
      .from(schema.platformSettings)
      .where(eq(schema.platformSettings.settingKey, 'enabled_animal_types'))
      .limit(1);

    if (existing.length > 0) {
      await db.update(schema.platformSettings)
        .set({
          settingValue: enabledTypes,
          updatedAt: new Date(),
        })
        .where(eq(schema.platformSettings.settingKey, 'enabled_animal_types'));
    } else {
      await db.insert(schema.platformSettings).values({
        id: randomUUID(),
        settingKey: 'enabled_animal_types',
        settingValue: enabledTypes,
        description: 'Enabled animal types on the platform',
      });
    }
  }

  // ============================================
  // PLUGIN WEBHOOK SYSTEM
  // ============================================

  async getAllPlugins(): Promise<Plugin[]> {
    return db.select().from(schema.plugins).where(eq(schema.plugins.isActive, true));
  }

  async getPublicPlugins(): Promise<Plugin[]> {
    return db.select()
      .from(schema.plugins)
      .where(and(
        eq(schema.plugins.isActive, true),
        eq(schema.plugins.isPublic, true)
      ))
      .orderBy(desc(schema.plugins.isOfficial), asc(schema.plugins.name));
  }

  async getPlugin(id: string): Promise<Plugin | undefined> {
    const [plugin] = await db.select().from(schema.plugins).where(eq(schema.plugins.id, id)).limit(1);
    return plugin;
  }

  async getPluginBySlug(slug: string): Promise<Plugin | undefined> {
    const [plugin] = await db.select().from(schema.plugins).where(eq(schema.plugins.slug, slug)).limit(1);
    return plugin;
  }

  async createPlugin(plugin: InsertPlugin): Promise<Plugin> {
    const [created] = await db.insert(schema.plugins).values(plugin).returning();
    return created;
  }

  async updatePlugin(id: string, plugin: Partial<InsertPlugin>): Promise<Plugin | undefined> {
    const [updated] = await db.update(schema.plugins)
      .set({ ...plugin, updatedAt: new Date() })
      .where(eq(schema.plugins.id, id))
      .returning();
    return updated;
  }

  async deletePlugin(id: string): Promise<void> {
    await db.delete(schema.pluginInstallations).where(eq(schema.pluginInstallations.pluginId, id));
    await db.delete(schema.plugins).where(eq(schema.plugins.id, id));
  }

  async getShelterPluginInstallations(shelterId: string): Promise<Array<PluginInstallation & { plugin: Plugin }>> {
    const installations = await db.select()
      .from(schema.pluginInstallations)
      .innerJoin(schema.plugins, eq(schema.pluginInstallations.pluginId, schema.plugins.id))
      .where(eq(schema.pluginInstallations.shelterId, shelterId));
    
    return installations.map(row => ({
      ...row.plugin_installations,
      plugin: row.plugins,
    }));
  }

  async getPluginInstallation(id: string): Promise<PluginInstallation | undefined> {
    const [installation] = await db.select()
      .from(schema.pluginInstallations)
      .where(eq(schema.pluginInstallations.id, id))
      .limit(1);
    return installation;
  }

  async installPlugin(installation: InsertPluginInstallation): Promise<PluginInstallation> {
    const [created] = await db.insert(schema.pluginInstallations).values(installation).returning();
    return created;
  }

  async updatePluginInstallation(id: string, installation: Partial<InsertPluginInstallation>): Promise<PluginInstallation | undefined> {
    const [updated] = await db.update(schema.pluginInstallations)
      .set({ ...installation, updatedAt: new Date() })
      .where(eq(schema.pluginInstallations.id, id))
      .returning();
    return updated;
  }

  async uninstallPlugin(id: string): Promise<void> {
    await db.delete(schema.pluginInstallations).where(eq(schema.pluginInstallations.id, id));
  }

  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const [created] = await db.insert(schema.webhookLogs).values(log).returning();
    
    // Update installation stats
    await db.update(schema.pluginInstallations)
      .set({
        totalWebhooksReceived: sql`${schema.pluginInstallations.totalWebhooksReceived} + 1`,
        lastWebhookAt: new Date(),
      })
      .where(eq(schema.pluginInstallations.id, log.installationId));
    
    return created;
  }

  async getWebhookLogs(installationId: string, limit = 50): Promise<WebhookLog[]> {
    return db.select()
      .from(schema.webhookLogs)
      .where(eq(schema.webhookLogs.installationId, installationId))
      .orderBy(desc(schema.webhookLogs.createdAt))
      .limit(limit);
  }

  async getPendingRetryWebhooks(): Promise<WebhookLog[]> {
    return db.select()
      .from(schema.webhookLogs)
      .where(and(
        eq(schema.webhookLogs.status, 'pending_retry'),
        sql`${schema.webhookLogs.nextRetryAt} <= NOW()`
      ))
      .orderBy(asc(schema.webhookLogs.nextRetryAt))
      .limit(50);
  }

  async updateWebhookLog(id: string, updates: Partial<InsertWebhookLog>): Promise<WebhookLog | undefined> {
    const [updated] = await db.update(schema.webhookLogs)
      .set(updates)
      .where(eq(schema.webhookLogs.id, id))
      .returning();
    return updated;
  }

  // ============================================
  // FEATURE FLAGS
  // ============================================

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return db.select().from(featureFlags).orderBy(asc(featureFlags.category), asc(featureFlags.label));
  }

  async getFeatureFlag(key: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
    return flag;
  }

  async getEnabledFeatureFlags(): Promise<FeatureFlag[]> {
    return db.select().from(featureFlags).where(eq(featureFlags.isEnabled, true));
  }

  async updateFeatureFlag(key: string, isEnabled: boolean, updatedBy?: string): Promise<FeatureFlag | undefined> {
    const [updated] = await db
      .update(featureFlags)
      .set({ isEnabled, updatedBy, updatedAt: new Date() })
      .where(eq(featureFlags.key, key))
      .returning();
    return updated;
  }

  async seedFeatureFlags(): Promise<void> {
    const defaultFlags = [
      { key: FEATURE_FLAG_KEYS.AI_BREED_IDENTIFICATION, label: 'AI Breed Identification', description: 'Scan photos to identify breed using AI', category: 'ai', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.AI_NAME_GENERATION, label: 'AI Name Suggestions', description: 'Generate pet name suggestions using AI', category: 'ai', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.AI_FORM_ASSISTANCE, label: 'AI Form Assistance', description: 'AI helps fill out forms and applications', category: 'ai', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.AI_BIO_ENHANCEMENT, label: 'AI Bio Enhancement', description: 'AI helps write better pet bios', category: 'ai', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.AI_HEALTH_SCREENING, label: 'AI Health Screening', description: 'AI-powered symptom checker and image analysis for pet health assessment', category: 'ai', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.FOSTER_MODE, label: 'Foster Mode', description: 'Allow users to switch to foster mode', category: 'modes', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.REHOME_MODE, label: 'Rehome Mode', description: 'Allow users to list pets for rehoming', category: 'modes', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.URGENCY_SYSTEM, label: 'Urgency System', description: 'Mark pets as urgent or critical for faster placement', category: 'operations', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.PHONE_SCREENING, label: 'Phone Screening', description: 'AI-powered phone screening via Vapi', category: 'communication', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.VIRTUAL_TOURS, label: 'Virtual Tours', description: 'Schedule virtual meet-and-greet sessions', category: 'discovery', isEnabled: true },
      // User-side Features
      { key: FEATURE_FLAG_KEYS.USER_DONATIONS, label: 'User Donations', description: 'Allow users to donate to shelters through shelter profile pages', category: 'user_features', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.USER_RESOURCES, label: 'User Resources', description: 'Show community resources on the map and shelter profiles', category: 'user_features', isEnabled: true },
      // Shelter CRM Features
      { key: FEATURE_FLAG_KEYS.SHELTER_AI_HEALTH_SCREENING, label: 'AI Health Screening', description: 'AI-powered health analysis for pet intake assessments', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_FOSTER_MANAGEMENT, label: 'Foster Management', description: 'Foster parent assignment and management features', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_PIPELINE_VIEW, label: 'Pipeline View', description: 'Drag-and-drop pipeline management for pet status tracking', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_BULK_OPERATIONS, label: 'Bulk Operations', description: 'Mass pet update and batch operations capabilities', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_INTAKE_AUTOMATION, label: 'Intake Automation', description: 'Automatically create tasks and records on pet intake', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_AI_BIO_GENERATOR, label: 'AI Bio Generator', description: 'AI-powered pet description and bio writing assistance', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_PHONE_SCREENING, label: 'Phone Screening', description: 'Vapi voice AI integration for adopter phone screening calls', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_MEDICAL_TRACKING, label: 'Medical Tracking', description: 'Vaccine and treatment tracking with reminders', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_DONATIONS, label: 'Donation System', description: 'Fundraising campaigns and donation management', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_RESOURCES, label: 'Community Resources', description: 'Manage community resources like food pantries, vaccinations, and pet support services', category: 'shelter_crm', isEnabled: true },
      { key: FEATURE_FLAG_KEYS.SHELTER_APPLICATION_BUILDER, label: 'Application Builder', description: 'Custom adoption application form builder', category: 'shelter_crm', isEnabled: true },
      // Automation Engine
      { key: FEATURE_FLAG_KEYS.AUTOMATIONS_ENGINE, label: 'Automations Engine', description: 'Rule-based task automation triggered by events like intake, status changes, and applications', category: 'shelter_crm', isEnabled: true },
    ];

    for (const flag of defaultFlags) {
      const existing = await this.getFeatureFlag(flag.key);
      if (!existing) {
        await db.insert(featureFlags).values({
          id: randomUUID(),
          ...flag,
        });
      }
    }
  }

  // ============================================
  // HEALTH SCREENING (AI-powered health analysis)
  // ============================================

  async createHealthScreening(screening: InsertHealthScreeningResult): Promise<HealthScreeningResult> {
    const [result] = await db.insert(healthScreeningResults).values({
      id: randomUUID(),
      ...screening,
    }).returning();
    return result;
  }

  async getHealthScreening(id: string): Promise<HealthScreeningResult | undefined> {
    const [result] = await db.select().from(healthScreeningResults).where(eq(healthScreeningResults.id, id)).limit(1);
    return result;
  }

  async getHealthScreeningsByDog(dogId: string): Promise<HealthScreeningResult[]> {
    return db.select().from(healthScreeningResults)
      .where(eq(healthScreeningResults.dogId, dogId))
      .orderBy(desc(healthScreeningResults.createdAt));
  }

  async getHealthScreeningsByShelter(shelterId: string): Promise<HealthScreeningResult[]> {
    return db.select().from(healthScreeningResults)
      .where(eq(healthScreeningResults.shelterId, shelterId))
      .orderBy(desc(healthScreeningResults.createdAt));
  }

  async getUnreviewedHealthScreenings(shelterId: string): Promise<HealthScreeningResult[]> {
    return db.select().from(healthScreeningResults)
      .where(and(
        eq(healthScreeningResults.shelterId, shelterId),
        eq(healthScreeningResults.isReviewed, false)
      ))
      .orderBy(desc(healthScreeningResults.createdAt));
  }

  async reviewHealthScreening(id: string, reviewedBy: string, reviewNotes: string, medicalRecordId?: string): Promise<HealthScreeningResult | undefined> {
    const [result] = await db.update(healthScreeningResults)
      .set({
        isReviewed: true,
        reviewedBy,
        reviewNotes,
        reviewedAt: new Date(),
        medicalRecordId: medicalRecordId || null,
      })
      .where(eq(healthScreeningResults.id, id))
      .returning();
    return result;
  }

  // ============================================
  // PLUGIN SEEDING
  // ============================================

  async seedPlugins(): Promise<void> {
    const defaultPlugins: Omit<InsertPlugin, 'id'>[] = [
      {
        name: 'Stripe Payments',
        slug: 'stripe_payments',
        description: 'Accept adoption fees and donations securely with Stripe. Supports one-time payments, recurring donations, and payment tracking.',
        category: 'payment',
        iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/stripe.svg',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'Secret API Key', description: 'Your Stripe secret key (starts with sk_)' },
            webhookSecret: { type: 'string', title: 'Webhook Secret', description: 'Webhook signing secret for verifying events' },
            publicKey: { type: 'string', title: 'Publishable Key', description: 'Your Stripe publishable key (starts with pk_)' }
          },
          required: ['apiKey', 'publicKey']
        },
        webhookEvents: ['payment.succeeded', 'payment.failed', 'donation.received'],
        requiredScopes: ['write:payments', 'read:adoptions'],
        supportsOAuth: false,
        isActive: true,
        isPublic: true
      },
      {
        name: 'Twilio SMS & Voice',
        slug: 'twilio_communication',
        description: 'Send SMS notifications, appointment reminders, and make voice calls to adopters. Perfect for adoption updates and follow-ups.',
        category: 'communication',
        iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/twilio.svg',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            accountSid: { type: 'string', title: 'Account SID', description: 'Your Twilio Account SID' },
            authToken: { type: 'string', title: 'Auth Token', description: 'Your Twilio Auth Token' },
            phoneNumber: { type: 'string', title: 'Phone Number', description: 'Your Twilio phone number (e.g., +1234567890)' }
          },
          required: ['accountSid', 'authToken', 'phoneNumber']
        },
        webhookEvents: ['message.sent', 'call.completed', 'reminder.sent'],
        requiredScopes: ['read:adopters', 'write:notifications'],
        supportsOAuth: false,
        isActive: true,
        isPublic: true
      },
      {
        name: 'Checkr Background Checks',
        slug: 'checkr_background',
        description: 'Run comprehensive background checks on potential adopters. Includes criminal history, sex offender registry, and more.',
        category: 'background_check',
        iconUrl: 'https://logo.clearbit.com/checkr.com',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'API Key', description: 'Your Checkr API key' },
            packageType: { 
              type: 'string', 
              title: 'Check Package', 
              description: 'Type of background check to run',
              enum: ['basic', 'standard', 'pro'],
              default: 'basic'
            }
          },
          required: ['apiKey']
        },
        webhookEvents: ['check.completed', 'check.flagged', 'check.failed'],
        requiredScopes: ['read:adopters', 'write:verifications'],
        supportsOAuth: false,
        isActive: true,
        isPublic: true
      },
      {
        name: 'SendGrid Email',
        slug: 'sendgrid_email',
        description: 'Send beautiful, branded emails to adopters. Perfect for application confirmations, adoption updates, and newsletters.',
        category: 'communication',
        iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/sendgrid.svg',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'API Key', description: 'Your SendGrid API key' },
            fromEmail: { type: 'string', title: 'From Email', description: 'Email address to send from' },
            fromName: { type: 'string', title: 'From Name', description: 'Display name for sent emails' }
          },
          required: ['apiKey', 'fromEmail']
        },
        webhookEvents: ['email.sent', 'email.opened', 'email.clicked'],
        requiredScopes: ['read:adopters', 'write:notifications'],
        supportsOAuth: false,
        isActive: true,
        isPublic: true
      },
      {
        name: 'Calendly Scheduling',
        slug: 'calendly_scheduling',
        description: 'Let adopters schedule meet-and-greet appointments, home visits, and adoption pickups directly from your calendar.',
        category: 'automation',
        iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/calendly.svg',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'API Key', description: 'Your Calendly API key' },
            organizationUri: { type: 'string', title: 'Organization URI', description: 'Your Calendly organization URI' }
          },
          required: ['apiKey']
        },
        webhookEvents: ['appointment.scheduled', 'appointment.cancelled', 'appointment.rescheduled'],
        requiredScopes: ['read:adoptions', 'write:appointments'],
        supportsOAuth: true,
        oauthAuthUrl: 'https://auth.calendly.com/oauth/authorize',
        oauthTokenUrl: 'https://auth.calendly.com/oauth/token',
        isActive: true,
        isPublic: true
      },
      {
        name: 'PetFinder Sync',
        slug: 'petfinder_sync',
        description: 'Automatically sync your pet listings to PetFinder.com to reach millions of potential adopters.',
        category: 'automation',
        iconUrl: 'https://logo.clearbit.com/petfinder.com',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'API Key', description: 'Your PetFinder API key' },
            apiSecret: { type: 'string', title: 'API Secret', description: 'Your PetFinder API secret' },
            shelterId: { type: 'string', title: 'Shelter ID', description: 'Your PetFinder shelter/organization ID' },
            autoSync: { type: 'boolean', title: 'Auto Sync', description: 'Automatically sync new pets', default: true }
          },
          required: ['apiKey', 'apiSecret', 'shelterId']
        },
        webhookEvents: ['pet.created', 'pet.updated', 'pet.adopted'],
        requiredScopes: ['read:dogs', 'write:dogs'],
        supportsOAuth: true,
        oauthAuthUrl: 'https://www.petfinder.com/user/oauth/authorize',
        oauthTokenUrl: 'https://api.petfinder.com/v2/oauth2/token',
        isActive: true,
        isPublic: true
      },
      {
        name: 'Salesforce CRM',
        slug: 'salesforce_crm',
        description: 'Sync adopter data, applications, and donation history with Salesforce for advanced relationship management.',
        category: 'crm',
        iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/salesforce.svg',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            instanceUrl: { type: 'string', title: 'Instance URL', description: 'Your Salesforce instance URL' },
            clientId: { type: 'string', title: 'Client ID', description: 'Connected App Client ID' },
            clientSecret: { type: 'string', title: 'Client Secret', description: 'Connected App Client Secret' }
          },
          required: ['instanceUrl', 'clientId', 'clientSecret']
        },
        webhookEvents: ['adopter.created', 'application.submitted', 'adoption.completed', 'donation.received'],
        requiredScopes: ['read:adopters', 'read:adoptions', 'read:donations'],
        supportsOAuth: true,
        oauthAuthUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        oauthTokenUrl: 'https://login.salesforce.com/services/oauth2/token',
        isActive: true,
        isPublic: true
      },
      {
        name: 'Google Analytics',
        slug: 'google_analytics',
        description: 'Track visitor behavior, adoption funnel performance, and marketing campaign effectiveness.',
        category: 'analytics',
        iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/googleanalytics.svg',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            measurementId: { type: 'string', title: 'Measurement ID', description: 'Your GA4 Measurement ID (G-XXXXXXX)' },
            apiSecret: { type: 'string', title: 'API Secret', description: 'Your GA4 API secret for server-side tracking' }
          },
          required: ['measurementId']
        },
        webhookEvents: ['page.viewed', 'application.started', 'application.submitted', 'adoption.completed'],
        requiredScopes: ['read:analytics'],
        supportsOAuth: false,
        isActive: true,
        isPublic: true
      },
      {
        name: 'VetCheck Pro',
        slug: 'vetcheck_medical',
        description: 'Integration with veterinary management systems for automatic medical record sync and vaccination tracking.',
        category: 'medical',
        iconUrl: 'https://logo.clearbit.com/vetspire.com',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'API Key', description: 'Your VetCheck API key' },
            clinicId: { type: 'string', title: 'Clinic ID', description: 'Your veterinary clinic ID' },
            syncInterval: { 
              type: 'string', 
              title: 'Sync Interval', 
              description: 'How often to sync records',
              enum: ['hourly', 'daily', 'weekly'],
              default: 'daily'
            }
          },
          required: ['apiKey', 'clinicId']
        },
        webhookEvents: ['record.created', 'vaccine.administered', 'appointment.scheduled'],
        requiredScopes: ['read:dogs', 'write:medical'],
        supportsOAuth: false,
        isActive: true,
        isPublic: true
      },
      {
        name: 'Mailchimp Marketing',
        slug: 'mailchimp_marketing',
        description: 'Build email lists, send newsletters, and automate marketing campaigns to potential adopters.',
        category: 'communication',
        iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/mailchimp.svg',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', title: 'API Key', description: 'Your Mailchimp API key' },
            serverPrefix: { type: 'string', title: 'Server Prefix', description: 'Your Mailchimp server prefix (e.g., us1)' },
            audienceId: { type: 'string', title: 'Audience ID', description: 'The audience/list to sync contacts to' }
          },
          required: ['apiKey', 'serverPrefix']
        },
        webhookEvents: ['subscriber.added', 'campaign.sent', 'email.opened'],
        requiredScopes: ['read:adopters', 'write:marketing'],
        supportsOAuth: true,
        oauthAuthUrl: 'https://login.mailchimp.com/oauth2/authorize',
        oauthTokenUrl: 'https://login.mailchimp.com/oauth2/token',
        isActive: true,
        isPublic: true
      },
      {
        name: 'Automations Engine',
        slug: 'automations_engine',
        description: 'Automate shelter workflows with rule-based task creation. Automatically generate tasks when dogs are intaked, status changes, applications are received, or medical care is due.',
        category: 'automation',
        iconUrl: 'https://cdn.jsdelivr.net/npm/simple-icons@v9/icons/zapier.svg',
        isOfficial: true,
        configSchema: {
          type: 'object',
          properties: {
            enabled: { 
              type: 'boolean', 
              title: 'Enable Automations', 
              description: 'Turn on automatic task generation based on your rules',
              default: true
            }
          },
          required: []
        },
        webhookEvents: ['dog.intake_created', 'dog.status_changed', 'application.received', 'medical.due'],
        requiredScopes: ['write:tasks', 'read:dogs', 'read:applications'],
        supportsOAuth: false,
        isActive: true,
        isPublic: true
      }
    ];

    for (const pluginData of defaultPlugins) {
      const existing = await this.getPluginBySlug(pluginData.slug);
      if (!existing) {
        await db.insert(plugins).values({
          id: randomUUID(),
          ...pluginData,
        });
        console.log(`✓ Seeded plugin: ${pluginData.name}`);
      }
    }
  }

  // ============================================
  // TASK RULES (Automations)
  // ============================================
  async getActiveTaskRulesByTrigger(triggerType: string, shelterId: string): Promise<TaskRule[]> {
    const results = await db
      .select()
      .from(taskRules)
      .where(
        and(
          eq(taskRules.triggerType, triggerType),
          eq(taskRules.isActive, true),
          sql`(${taskRules.shelterId} = ${shelterId} OR ${taskRules.shelterId} IS NULL)`
        )
      );
    return results;
  }
}

// Use database storage instead of in-memory storage
export const storage = new DatabaseStorage();