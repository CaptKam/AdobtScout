import { pgTable, text, varchar, integer, boolean, timestamp, real, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ============================================
// REPLIT AUTH TABLES (Required)
// ============================================

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// ============================================
// SCOUT AI INSIGHTS TABLE
// ============================================

// Scout Insights - AI-learned user preferences from conversations and behavior
export const scoutInsights = pgTable("scout_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),

  // Insight type and content
  insightType: text("insight_type").notNull(), // "preference", "concern", "lifestyle", "experience", "requirement"
  category: text("category").notNull(), // "size", "energy", "temperament", "breed", "age", "living_situation", etc.
  value: text("value").notNull(), // The actual preference/insight
  confidence: real("confidence").notNull().default(0.5), // 0.0-1.0 confidence score

  // Source tracking
  source: text("source").notNull(), // "chat", "swipe_pattern", "profile", "journey"
  sourceMessageId: varchar("source_message_id"), // Reference to chat message if from conversation

  // Decay and relevance
  lastReinforced: timestamp("last_reinforced").notNull().defaultNow(),
  reinforcementCount: integer("reinforcement_count").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  // Composite index for efficient context assembly queries
  index("scout_insights_user_active_confidence_idx").on(table.userId, table.isActive, table.confidence),
]);

export const insertScoutInsightSchema = createInsertSchema(scoutInsights);
export type InsertScoutInsight = z.infer<typeof insertScoutInsightSchema>;
export type ScoutInsight = typeof scoutInsights.$inferSelect;

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  email: varchar("email").unique(),
  password: text("password"), // null for OAuth users
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("adopter"), // "adopter" or "shelter"
  isAdmin: boolean("is_admin").notNull().default(false), // Admin access flag
  adminRole: text("admin_role"), // "platform_admin", "trust_safety", "shelter_admin", "ai_ops" - null means no admin role
  isActive: boolean("is_active").notNull().default(true), // Account status
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_email").on(table.email),
  index("idx_users_role").on(table.role),
  index("idx_users_admin_role").on(table.adminRole),
]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ============================================
// APPLICATION TABLES
// ============================================

// Shelter Profile Schema (Shelter-specific information)
export const shelterProfiles = pgTable("shelter_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(), // References users.id

  shelterName: text("shelter_name").notNull(),
  location: text("location").notNull(), // City, State (display text)
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  licenseNumber: text("license_number"),
  description: text("description"),
  isVerified: boolean("is_verified").default(false),

  // Explicit address-based location
  address: text("address"), // Street address
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  latitude: real("latitude"), // Geocoded from address
  longitude: real("longitude"), // Geocoded from address

  // Admin approval
  approvalStatus: text("approval_status").notNull().default("pending"), // "pending", "approved", "rejected"
  approvedBy: varchar("approved_by"), // Admin user ID who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_shelter_profiles_user").on(table.userId),
  index("idx_shelter_profiles_approval").on(table.approvalStatus),
  index("idx_shelter_profiles_coords").on(table.latitude, table.longitude),
]);

export const insertShelterProfileSchema = createInsertSchema(shelterProfiles);
export type InsertShelterProfile = z.infer<typeof insertShelterProfileSchema>;
export type ShelterProfile = typeof shelterProfiles.$inferSelect;

// Owner Profile Schema (Individual owner information for rehoming)
export const ownerProfiles = pgTable("owner_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(), // References users.id

  fullName: text("full_name").notNull(),
  location: text("location").notNull(), // City, State
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  reason: text("reason"), // Why they're rehoming

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOwnerProfileSchema = createInsertSchema(ownerProfiles);
export type InsertOwnerProfile = z.infer<typeof insertOwnerProfileSchema>;
export type OwnerProfile = typeof ownerProfiles.$inferSelect;

// User Profile Schema (Unified adopter/owner profile)
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(), // References users.id

  // Mode: What is the user currently doing?
  mode: text("mode").notNull().default("adopt"), // "adopt", "rehome", or "foster"

  // Living Situation (for adopters)
  homeType: text("home_type"), // "house", "apartment", "condo" (nullable for rehomers)
  hasYard: boolean("has_yard"),
  hasOtherPets: boolean("has_other_pets"),
  otherPetsType: text("other_pets_type"), // "dogs", "cats", "both", "other"

  // Family & Household (critical for dog matching)
  hasChildren: boolean("has_children"), // Does the household have children?
  childrenAges: text("children_ages").array(), // ["infant", "toddler", "child", "teen"] - age categories of children
  familySize: integer("family_size"), // Total people in household

  // Activity Level & Lifestyle (for adopters)
  activityLevel: text("activity_level"), // "very_active", "active", "moderate", "relaxed"
  workSchedule: text("work_schedule"), // "home_all_day", "hybrid", "office_full_time", "varies"
  exerciseCommitment: text("exercise_commitment"), // "multiple_daily", "daily", "few_times_week", "occasional"

  // Experience (for adopters)
  experienceLevel: text("experience_level"), // "first_time", "some_experience", "very_experienced"

  // Preferences (for adopters)
  preferredSize: text("preferred_size").array(), // ["small", "medium", "large"]
  preferredAge: text("preferred_age").array(), // ["puppy", "young", "adult", "senior"]
  preferredEnergy: text("preferred_energy").array(), // ["low", "moderate", "high", "very_high"]

  // Contact Info (for rehomers and adopters)
  phoneNumber: text("phone_number"), // Phone number

  // Rehoming Info (for rehomers)
  reasonForRehoming: text("reason_for_rehoming"), // Why they're rehoming their dog

  // Foster Info (for foster parents)
  fosterTimeCommitment: text("foster_time_commitment"), // "short_term" (2-4 weeks), "medium_term" (1-2 months), "long_term" (2+ months), "flexible"
  fosterSizePreference: text("foster_size_preference").array(), // ["small", "medium", "large", "any"]
  fosterSpecialNeedsWilling: boolean("foster_special_needs_willing"), // Willing to foster dogs with medical/behavioral needs
  fosterEmergencyAvailability: text("foster_emergency_availability"), // "same_day", "few_days", "week_notice", "month_notice"
  fosterPreviousExperience: text("foster_previous_experience"), // Description of previous fostering experience
  fosterVetInfo: text("foster_vet_info"), // Vet name/contact
  fosterBackupPlan: text("foster_backup_plan"), // Backup plan for travel/emergencies

  // Foster Discoverability (for rehomers to find fosters)
  fosterVisible: boolean("foster_visible").default(false), // Is this foster discoverable by rehomers?
  fosterCapacity: integer("foster_capacity").default(1), // How many dogs can they foster at once?
  fosterMaxWeight: integer("foster_max_weight"), // Max weight they can handle (lbs)
  fosterAgePreference: text("foster_age_preference").array(), // ["puppy", "young", "adult", "senior"]
  fosterEnergyPreference: text("foster_energy_preference").array(), // ["low", "moderate", "high", "very_high"]
  fosterCurrentCount: integer("foster_current_count").default(0), // How many dogs they're currently fostering

  // Foster Approval (admin approval required before fostering)
  fosterApprovalStatus: text("foster_approval_status").notNull().default("not_applied"), // "not_applied", "pending", "approved", "rejected"
  fosterApprovedBy: varchar("foster_approved_by"), // Admin user ID who approved
  fosterApprovedAt: timestamp("foster_approved_at"),
  fosterRejectionReason: text("foster_rejection_reason"),

  // Profile
  profileImage: text("profile_image"), // URL to profile image

  // Location (for both adopters and rehomers)
  city: text("city"), // City name (for rehomers)
  state: text("state"), // State name (for rehomers)
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  searchRadius: integer("search_radius").notNull().default(25), // miles (for adopters)

  // Admin approval (for rehomers listing their own dogs)
  rehomerApprovalStatus: text("rehomer_approval_status").notNull().default("auto_approved"), // "pending", "approved", "rejected", "auto_approved"
  approvedBy: varchar("approved_by"), // Admin user ID who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_profiles_user").on(table.userId),
  index("idx_profiles_mode").on(table.mode),
  index("idx_profiles_foster_visible").on(table.fosterVisible),
]);

// Dog Schema
export const dogs = pgTable("dogs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // Owner Information - links to the user who posted this dog
  userId: varchar("user_id").notNull(), // References users.id (shelter or owner)

  // Animal type (configurable via admin settings)
  animalType: text("animal_type").notNull().default("dog"), // "dog", "cat", "bird", etc.

  name: text("name").notNull(),
  breed: text("breed").notNull(),
  age: integer("age").notNull(), // in years
  ageCategory: text("age_category").notNull(), // "puppy", "young", "adult", "senior"
  size: text("size").notNull(), // "small", "medium", "large"
  weight: integer("weight").notNull(), // in pounds

  // Personality & Traits
  energyLevel: text("energy_level").notNull(), // "low", "moderate", "high", "very_high"
  temperament: text("temperament").array().notNull(), // ["friendly", "playful", "calm", "loyal", "gentle", "protective"]
  goodWithKids: boolean("good_with_kids").notNull(),
  goodWithDogs: boolean("good_with_dogs").notNull(),
  goodWithCats: boolean("good_with_cats").notNull(),

  // Description
  bio: text("bio").notNull(),
  specialNeeds: text("special_needs"), // medical conditions, dietary requirements, etc.

  // Photos
  photos: text("photos").array().notNull(), // array of photo URLs/paths

  // Shelter Information (kept for backward compatibility, but will be derived from userId)
  shelterId: varchar("shelter_id").notNull(),
  shelterName: text("shelter_name").notNull(),
  shelterAddress: text("shelter_address").notNull(),
  shelterPhone: text("shelter_phone").notNull(),

  // Location (address-based, coordinates derived from geocoding)
  latitude: real("latitude"), // Optional - geocoded from address
  longitude: real("longitude"), // Optional - geocoded from address
  address: text("address"), // Full street address
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  isPublic: boolean("is_public").notNull().default(false), // Privacy toggle

  // Health
  vaccinated: boolean("vaccinated").notNull(),
  spayedNeutered: boolean("spayed_neutered").notNull(),
  viewCount: integer("view_count").notNull().default(0), // Added view count

  // Virtual Meet & Greet Features
  dayInLifeVideo: varchar("day_in_life_video"), // URL to a short video of the dog's day

  // Listing Type (for rehomers to specify if they need temporary foster or permanent adoption)
  listingType: text("listing_type").notNull().default("adoption"), // "adoption" (permanent home) or "foster" (temporary care needed)
  fosterDuration: text("foster_duration"), // If foster: "short_term" (2-4 weeks), "medium_term" (1-2 months), "long_term" (2+ months)
  fosterReason: text("foster_reason"), // Why they need foster: "travel", "medical", "housing", "family_emergency", "other"

  // Urgency Status (for at-risk/euthanasia list dogs)
  urgencyLevel: text("urgency_level").notNull().default("normal"), // "normal", "urgent", "critical"
  urgencyDeadline: timestamp("urgency_deadline"), // Date by which they need placement
  urgencyReason: text("urgency_reason"), // "euthanasia_list", "medical", "space", "behavioral"

  // Hold Status (synced from intake record)
  holdType: text("hold_type"), // "stray_hold", "medical_hold", "legal_hold", "behavior_hold" - synced from intake
  holdExpiresAt: timestamp("hold_expires_at"), // When the hold expires - synced from intake
  holdNotes: text("hold_notes"), // Notes about the hold - synced from intake

  // Admin approval
  approvalStatus: text("approval_status").notNull().default("approved"), // "pending", "approved", "rejected" (default approved for shelters, pending for rehomers)
  approvedBy: varchar("approved_by"), // Admin user ID who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_dogs_user").on(table.userId),
  index("idx_dogs_approval").on(table.approvalStatus),
  index("idx_dogs_urgency").on(table.urgencyLevel),
  index("idx_dogs_listing").on(table.listingType),
  index("idx_dogs_animal_type").on(table.animalType),
  index("idx_dogs_public").on(table.isPublic),
  index("idx_dogs_created").on(table.createdAt),
  index("idx_dogs_coords").on(table.latitude, table.longitude),
  index("idx_dogs_hold_type").on(table.holdType),
]);

// Virtual Tour Scheduling
export const virtualTours = pgTable("virtual_tours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(),
  adopterUserId: varchar("adopter_user_id").notNull(),
  shelterUserId: varchar("shelter_user_id").notNull(),
  scheduledTime: timestamp("scheduled_time").notNull(),
  status: text("status").notNull().default("scheduled"), // "scheduled", "completed", "cancelled"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Swipe History Schema
export const swipes = pgTable("swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  dogId: varchar("dog_id").notNull(),
  direction: text("direction").notNull(), // "right" (like) or "left" (pass)
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("idx_swipes_user").on(table.userId),
  index("idx_swipes_dog").on(table.dogId),
  index("idx_swipes_user_dog").on(table.userId, table.dogId),
]);

// Chat Messages Schema (Scout AI)
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  dogContext: varchar("dog_context"), // optional reference to a dog being discussed
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("idx_chat_user").on(table.userId),
]);


// Household Pets Schema - User's existing dogs/pets
export const householdPets = pgTable("household_pets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(), // References users.id
  name: text("name").notNull(),
  species: text("species").notNull(), // "dog", "cat", "other"
  breed: text("breed"), // For dogs, helps with breed compatibility
  age: integer("age"), // in years
  size: text("size"), // "small", "medium", "large" (for dogs)
  energyLevel: text("energy_level"), // "low", "moderate", "high", "very_high"
  temperament: text("temperament").array(), // ["friendly", "shy", "protective", etc.]
  goodWithDogs: boolean("good_with_dogs"),
  goodWithCats: boolean("good_with_cats"),
  goodWithKids: boolean("good_with_kids"),
  specialNeeds: text("special_needs"), // Any medical/behavioral notes
  photo: text("photo"), // Optional photo URL
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Family Members Schema - User's household family members
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(), // References users.id
  name: text("name").notNull(),
  relation: text("relation").notNull(), // "self", "spouse", "child", "parent", "other"
  ageGroup: text("age_group"), // For children: "infant", "toddler", "child", "teen"
  photo: text("photo"), // Optional photo URL
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Conversations Schema (User-to-Shelter messaging)
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  dogId: varchar("dog_id").notNull(),
  shelterName: text("shelter_name").notNull(),
  shelterId: varchar("shelter_id"), // Links to shelter user for CRM

  // CRM fields for shelter communication management
  status: text("status").notNull().default("open"), // "open", "pending", "snoozed", "closed"
  channelType: text("channel_type").notNull().default("chat"), // "chat", "application", "inquiry", "call_transcript"
  priority: text("priority").notNull().default("normal"), // "low", "normal", "high", "urgent"
  assignedTo: varchar("assigned_to"), // Staff member handling this conversation

  // Tracking
  shelterUnreadCount: integer("shelter_unread_count").notNull().default(0),
  userUnreadCount: integer("user_unread_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  snoozedUntil: timestamp("snoozed_until"), // When to resurface snoozed conversations
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_conv_shelter").on(table.shelterId),
  index("idx_conv_status").on(table.status),
  index("idx_conv_user").on(table.userId),
]);

// Messages Schema (User-to-Shelter messaging)
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  senderId: text("sender_id").notNull(),
  senderType: text("sender_type").notNull(), // "adopter", "shelter_staff", "system"
  messageType: text("message_type").notNull().default("text"), // "text", "call_transcript", "system", "template"
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // For attachments, call info, etc.
  isRead: boolean("is_read").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("idx_msg_conv").on(table.conversationId),
]);

// Schemas for validation
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertDogSchema = createInsertSchema(dogs).omit({
  id: true,
  createdAt: true,
});

export const insertVirtualTourSchema = createInsertSchema(virtualTours).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const adoptionJourneys = pgTable("adoption_journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  dogId: varchar("dog_id").notNull(),
  currentStep: text("current_step").notNull().default("application"), // "application", "phone_screening", "meet_greet", "adoption", "completed"
  applicationSubmittedAt: timestamp("application_submitted_at"),

  // Phone Screening (AI Voice Call via Vapi) - replaces home_visit
  phoneScreeningStatus: text("phone_screening_status"), // "pending", "scheduled", "in_progress", "completed", "failed"
  vapiCallId: text("vapi_call_id"), // Vapi call ID for tracking
  phoneScreeningScheduledAt: timestamp("phone_screening_scheduled_at"),
  phoneScreeningCompletedAt: timestamp("phone_screening_completed_at"),
  phoneScreeningTranscript: text("phone_screening_transcript"), // Full call transcript
  phoneScreeningSummary: text("phone_screening_summary"), // AI-generated summary of the call
  phoneScreeningRecordingUrl: text("phone_screening_recording_url"), // URL to call recording
  phoneScreeningNotes: text("phone_screening_notes"), // AI analytics JSON: sentiment, concerns, positive indicators

  // Legacy home visit fields (kept for backward compatibility)
  homeVisitScheduledAt: timestamp("home_visit_scheduled_at"),
  homeVisitCompletedAt: timestamp("home_visit_completed_at"),

  meetGreetScheduledAt: timestamp("meet_greet_scheduled_at"),
  meetGreetCompletedAt: timestamp("meet_greet_completed_at"),
  adoptionDate: timestamp("adoption_date"),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),

  // Milestones/Badges tracking
  milestones: text("milestones").array().notNull().default(sql`ARRAY[]::text[]`), // "first_swipe", "shelter_visit_complete", "adoption_day"

  // AI Review Fields
  aiReviewScore: integer("ai_review_score"), // 0-100
  aiRecommendation: text("ai_recommendation"), // "approve", "request_more_info", etc.
  aiReviewSummary: text("ai_review_summary"),
  aiReviewData: jsonb("ai_review_data"), // Full AI review JSON
  reviewedAt: timestamp("reviewed_at"),

  // Application Responses - stores answers to application questions
  applicationResponses: jsonb("application_responses"), // { questionId: answer, ... }

  // Admin Review Fields
  adminNotes: text("admin_notes"), // Notes from admin review
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"), // Admin user ID who approved
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: varchar("rejected_by"), // Admin user ID who rejected
  rejectionReason: text("rejection_reason"),

  // Trust & Safety Eligibility Review (Two-Stage Approval)
  // Stage 1: T&S determines "Is this person eligible to adopt?"
  eligibilityStatus: text("eligibility_status").notNull().default("pending_eligibility"), // "pending_eligibility", "eligible", "ineligible", "escalated"
  eligibilityReviewedBy: varchar("eligibility_reviewed_by"), // T&S admin user ID who reviewed
  eligibilityReviewedAt: timestamp("eligibility_reviewed_at"),
  eligibilityNotes: text("eligibility_notes"), // T&S notes on eligibility decision
  escalatedTo: varchar("escalated_to"), // Platform Admin user ID if escalated
  escalatedAt: timestamp("escalated_at"),
  escalationReason: text("escalation_reason"),

  // Shelter Approval Fields (for VAPI phone screening workflow)
  shelterApprovalStatus: text("shelter_approval_status").notNull().default("pending"), // "pending", "approved", "rejected", "more_info_needed"
  shelterApprovedAt: timestamp("shelter_approved_at"),
  shelterApprovedBy: varchar("shelter_approved_by"), // Shelter staff user ID who approved
  shelterRejectedAt: timestamp("shelter_rejected_at"),
  shelterRejectedBy: varchar("shelter_rejected_by"), // Shelter staff user ID who rejected
  shelterRejectionReason: text("shelter_rejection_reason"),
  shelterNotes: text("shelter_notes"), // Notes from shelter review

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_journeys_user").on(table.userId),
  index("idx_journeys_dog").on(table.dogId),
  index("idx_journeys_eligibility").on(table.eligibilityStatus),
  index("idx_journeys_shelter_approval").on(table.shelterApprovalStatus),
]);

export const adoptionDocuments = pgTable("adoption_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  journeyId: varchar("journey_id").notNull(),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  aiProcessingResult: text("ai_processing_result"), // JSON string with OCR + AI extraction results
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

// Consultation Calls - User-initiated AI phone consultations about dogs
export const consultationCalls = pgTable("consultation_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  dogId: varchar("dog_id"),

  // Vapi call tracking
  vapiCallId: text("vapi_call_id"),
  callType: text("call_type").notNull().default("dog_consultation"), // "dog_consultation", "foster_consultation", "general"
  status: text("status").notNull().default("pending"), // "pending", "in_progress", "completed", "failed"

  // Call content
  phoneNumber: text("phone_number"),
  transcript: text("transcript"),
  summary: text("summary"),

  // AI analytics
  sentimentScore: integer("sentiment_score"), // 0-100
  insights: jsonb("insights"), // AI-extracted insights from call

  // Timestamps
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConsultationCallSchema = createInsertSchema(consultationCalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ConsultationCall = typeof consultationCalls.$inferSelect;
export type InsertConsultationCall = z.infer<typeof insertConsultationCallSchema>;

export const insertAdoptionJourneySchema = createInsertSchema(adoptionJourneys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdoptionDocumentSchema = createInsertSchema(adoptionDocuments).omit({
  id: true,
  uploadedAt: true,
});

export const insertHouseholdPetSchema = createInsertSchema(householdPets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdoptionJourney = typeof adoptionJourneys.$inferSelect;
export type InsertAdoptionJourney = z.infer<typeof insertAdoptionJourneySchema>;
export type AdoptionDocument = typeof adoptionDocuments.$inferSelect;
export type InsertAdoptionDocument = z.infer<typeof insertAdoptionDocumentSchema>;
export type HouseholdPet = typeof householdPets.$inferSelect;
export type InsertHouseholdPet = z.infer<typeof insertHouseholdPetSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;

export const insertSwipeSchema = createInsertSchema(swipes).omit({
  id: true,
  timestamp: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  lastMessageAt: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

// Types
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type Dog = typeof dogs.$inferSelect;
export type InsertDog = z.infer<typeof insertDogSchema>;

export type VirtualTour = typeof virtualTours.$inferSelect;
export type NewVirtualTour = z.infer<typeof insertVirtualTourSchema>;

export type Swipe = typeof swipes.$inferSelect;
export type InsertSwipe = z.infer<typeof insertSwipeSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Additional types for frontend use
export type DogWithCompatibility = Dog & {
  compatibilityScore: number;
  distance: number;
  compatibilityReasons: string[];
  ownerRole?: 'shelter' | 'adopter' | 'owner'; // Determines if listing is from a shelter or individual rehomer (both 'adopter' and 'owner' indicate individual owners)
};

export type OnboardingData = Omit<InsertUserProfile, 'latitude' | 'longitude'> & {
  location?: { latitude: number; longitude: number };
};

export type ConversationWithDetails = Conversation & {
  dog: Dog;
  lastMessage?: Message;
  unreadCount: number;
};

// Shelter CRM conversation type with adopter details
export type ShelterConversation = Conversation & {
  dog: Dog;
  adopter: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profileImageUrl: string | null;
  };
  lastMessage?: Message;
  messageCount: number;
};

// Admin Activity Logs Schema
export const adminActivityLogs = pgTable("admin_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  adminUserId: varchar("admin_user_id").notNull(), // Admin who performed the action
  action: text("action").notNull(), // "approve_shelter", "reject_dog", "suspend_user", etc.
  targetType: text("target_type").notNull(), // "shelter", "dog", "user", "application"
  targetId: varchar("target_id").notNull(), // ID of the affected entity
  details: jsonb("details"), // Additional context (old/new values, reason, etc.)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertAdminActivityLogSchema = createInsertSchema(adminActivityLogs).omit({
  id: true,
  timestamp: true,
});

export type AdminActivityLog = typeof adminActivityLogs.$inferSelect;
export type InsertAdminActivityLog = z.infer<typeof insertAdminActivityLogSchema>;

// ============================================
// FOSTER REQUESTS (Rehomers requesting foster help)
// ============================================

export const fosterRequests = pgTable("foster_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // Requester (rehomer) info
  rehomerId: varchar("rehomer_id").notNull(), // User requesting foster help
  dogId: varchar("dog_id"), // Optional - if they already listed a dog

  // Dog info (if not linked to existing dog listing)
  dogName: text("dog_name"),
  dogBreed: text("dog_breed"),
  dogAge: integer("dog_age"),
  dogSize: text("dog_size"), // "small", "medium", "large"
  dogWeight: integer("dog_weight"),
  dogEnergyLevel: text("dog_energy_level"),
  dogTemperament: text("dog_temperament").array(),
  dogGoodWithKids: boolean("dog_good_with_kids"),
  dogGoodWithDogs: boolean("dog_good_with_dogs"),
  dogGoodWithCats: boolean("dog_good_with_cats"),
  dogSpecialNeeds: text("dog_special_needs"),
  dogPhoto: text("dog_photo"),

  // Foster requested
  fosterId: varchar("foster_id").notNull(), // Foster parent being requested

  // Request details
  startDate: timestamp("start_date"), // When they need fostering to start
  endDate: timestamp("end_date"), // Expected end date (can be indefinite)
  duration: text("duration"), // "short_term", "medium_term", "long_term", "indefinite"
  urgency: text("urgency").notNull().default("normal"), // "normal", "urgent", "emergency"
  reason: text("reason"), // Why they need foster help
  additionalNotes: text("additional_notes"),

  // Contact preferences
  preferredContact: text("preferred_contact"), // "app", "phone", "email"

  // Status tracking
  status: text("status").notNull().default("pending"), // "pending", "accepted", "declined", "in_progress", "completed", "cancelled"
  responseMessage: text("response_message"), // Foster's response message
  respondedAt: timestamp("responded_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFosterRequestSchema = createInsertSchema(fosterRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  respondedAt: true,
});

export type FosterRequest = typeof fosterRequests.$inferSelect;
export type InsertFosterRequest = z.infer<typeof insertFosterRequestSchema>;

// Type for foster profile as displayed in search results
export type FosterProfile = {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  distance?: number;

  // Foster-specific info
  fosterTimeCommitment?: string;
  fosterSizePreference?: string[];
  fosterAgePreference?: string[];
  fosterEnergyPreference?: string[];
  fosterSpecialNeedsWilling?: boolean;
  fosterEmergencyAvailability?: string;
  fosterPreviousExperience?: string;
  fosterCapacity?: number;
  fosterCurrentCount?: number;
  fosterMaxWeight?: number;

  // Household info (for compatibility)
  hasChildren?: boolean;
  childrenAges?: string[];
  hasOtherPets?: boolean;
  otherPetsType?: string;
  hasYard?: boolean;
  homeType?: string;
};

// Adopter Verification Schema - Trust & Safety
export const adopterVerifications = pgTable("adopter_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(), // References users.id

  // Background Check Status
  backgroundCheckStatus: text("background_check_status").notNull().default("not_started"), // "not_started", "pending", "passed", "failed"
  backgroundCheckProvider: text("background_check_provider"), // e.g., "Checkr", "Instant Checkup"
  backgroundCheckRefId: text("background_check_ref_id"), // Reference ID from background check service
  backgroundCheckSubmittedAt: timestamp("background_check_submitted_at"),
  backgroundCheckCompletedAt: timestamp("background_check_completed_at"),
  backgroundCheckNotes: text("background_check_notes"), // Reason for failure if applicable

  // Pet Policy Verification (for renters)
  petPolicyVerified: boolean("pet_policy_verified").notNull().default(false),
  petPolicyVerificationMethod: text("pet_policy_verification_method"), // "landlord_letter", "lease_copy", "self_attestation"
  petPolicyVerifiedAt: timestamp("pet_policy_verified_at"),
  landlordName: text("landlord_name"), // Landlord name for verification
  landlordPhone: text("landlord_phone"), // Landlord contact
  landlordEmail: text("landlord_email"), // Landlord email

  // Overall Status
  isReadyToAdopt: boolean("is_ready_to_adopt").notNull().default(false), // True only if background check passed AND pet policy verified (if renter)
  verificationScore: integer("verification_score").notNull().default(0), // 0-100 score based on verifications

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdopterVerificationSchema = createInsertSchema(adopterVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdopterVerification = typeof adopterVerifications.$inferSelect;
export type InsertAdopterVerification = z.infer<typeof insertAdopterVerificationSchema>;

// Adoption Requirements Schema - Admin-configurable requirements
export const adoptionRequirements = pgTable("adoption_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // Profile requirements
  requireCompletedProfile: boolean("require_completed_profile").notNull().default(true),
  requirePhoneNumber: boolean("require_phone_number").notNull().default(true),
  requireProfilePhoto: boolean("require_profile_photo").notNull().default(false),

  // Verification requirements
  requireIdVerification: boolean("require_id_verification").notNull().default(false),
  requireBackgroundCheck: boolean("require_background_check").notNull().default(false),
  requireHomePhotos: boolean("require_home_photos").notNull().default(false),

  // Renter-specific requirements
  requirePetPolicyVerification: boolean("require_pet_policy_verification").notNull().default(false),

  // Custom message shown to users who don't meet requirements
  requirementsMessage: text("requirements_message"),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"), // Admin user ID who last updated
});

export const insertAdoptionRequirementsSchema = createInsertSchema(adoptionRequirements).omit({
  id: true,
  updatedAt: true,
});

export type AdoptionRequirements = typeof adoptionRequirements.$inferSelect;
export type InsertAdoptionRequirements = z.infer<typeof insertAdoptionRequirementsSchema>;

// ============================================
// ADMIN CONTENT MANAGEMENT SCHEMAS
// ============================================

// Application Questions - Questions shown in the adoption application form
export const applicationQuestions = pgTable("application_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // Question content
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull().default("text"), // "text", "textarea", "select", "multiselect", "boolean", "number"
  options: text("options").array(), // For select/multiselect types
  helperText: text("helper_text"), // Additional guidance for the question
  placeholder: text("placeholder"), // Placeholder text for inputs

  // Categorization
  section: text("section").notNull().default("general"), // "general", "housing", "lifestyle", "experience", "references"
  mode: text("mode").notNull().default("all"), // "adopt", "foster", "rehome", "all"

  // Display & validation
  isRequired: boolean("is_required").notNull().default(false),
  position: integer("position").notNull().default(0), // For ordering
  isActive: boolean("is_active").notNull().default(true),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"), // Admin user ID
});

export const insertApplicationQuestionSchema = createInsertSchema(applicationQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ApplicationQuestion = typeof applicationQuestions.$inferSelect;
export type InsertApplicationQuestion = z.infer<typeof insertApplicationQuestionSchema>;

// Phone Screening Questions - Questions for AI phone screening calls
export const phoneScreeningQuestions = pgTable("phone_screening_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // Question content
  questionText: text("question_text").notNull(), // The main question to ask
  aiPrompt: text("ai_prompt"), // Additional context for AI on how to ask/interpret
  followUpRules: text("follow_up_rules"), // JSON: conditions for follow-up questions

  // Categorization
  category: text("category").notNull().default("general"), // "introduction", "lifestyle", "experience", "housing", "expectations", "closing"
  scenario: text("scenario").notNull().default("adoption"), // "adoption", "foster", "rehome"

  // AI configuration
  aiTags: text("ai_tags").array(), // Tags to help AI route and respond
  expectedResponseType: text("expected_response_type").default("open"), // "open", "yes_no", "multiple_choice", "rating"
  scoringCriteria: text("scoring_criteria"), // How to score the response

  // Display & control
  position: integer("position").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"),
});

export const insertPhoneScreeningQuestionSchema = createInsertSchema(phoneScreeningQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PhoneScreeningQuestion = typeof phoneScreeningQuestions.$inferSelect;
export type InsertPhoneScreeningQuestion = z.infer<typeof insertPhoneScreeningQuestionSchema>;

// Vapi Knowledge Base - Content for AI assistant knowledge
export const vapiKnowledgeBase = pgTable("vapi_knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // Content
  title: text("title").notNull(),
  content: text("content").notNull(), // Main content (markdown supported)
  contentSummary: text("content_summary"), // Short summary for quick AI reference

  // Categorization
  category: text("category").notNull().default("general"), // "policies", "faq", "procedures", "dog_info", "shelter_info", "adoption_process"
  tags: text("tags").array(), // For filtering and AI routing

  // Linking
  relatedDogIds: text("related_dog_ids").array(), // Specific dogs this applies to

  // Status
  isPublished: boolean("is_published").notNull().default(false),
  priority: integer("priority").notNull().default(0), // Higher = more important for AI context

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"),
});

export const insertVapiKnowledgeBaseSchema = createInsertSchema(vapiKnowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VapiKnowledgeBaseEntry = typeof vapiKnowledgeBase.$inferSelect;
export type InsertVapiKnowledgeBaseEntry = z.infer<typeof insertVapiKnowledgeBaseSchema>;

// ============================================
// PROFILE COMPATIBILITY FLAGS
// ============================================

// Flags raised when there are potential compatibility issues with a user's profile
export const profileCompatibilityFlags = pgTable("profile_compatibility_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(), // References users.id
  
  // Flag details
  flagType: text("flag_type").notNull(), // "yellow" or "red"
  category: text("category").notNull(), // "space_requirements", "energy_mismatch", "experience_concern", "multi_pet"
  title: text("title").notNull(), // Short title like "High-energy dogs in small apartment"
  description: text("description").notNull(), // Detailed explanation of the concern
  
  // Context
  triggerReason: text("trigger_reason").notNull(), // What triggered this flag
  relatedDogId: varchar("related_dog_id"), // If related to a specific dog application
  relatedBreed: text("related_breed"), // If related to a specific breed
  
  // Admin review
  status: text("status").notNull().default("pending"), // "pending", "reviewed", "dismissed", "action_taken"
  adminComment: text("admin_comment"), // Comment from admin after review
  reviewedBy: varchar("reviewed_by"), // Admin user ID who reviewed
  reviewedAt: timestamp("reviewed_at"),
  
  // User notification
  userNotified: boolean("user_notified").notNull().default(false),
  userNotificationMessage: text("user_notification_message"), // Message shown to user
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProfileCompatibilityFlagSchema = createInsertSchema(profileCompatibilityFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProfileCompatibilityFlag = typeof profileCompatibilityFlags.$inferSelect;
export type InsertProfileCompatibilityFlag = z.infer<typeof insertProfileCompatibilityFlagSchema>;

// ============================================
// SHELTER APPLICATION QUESTIONS
// ============================================

// Shelter Application Forms - Custom question sets that shelters can create
export const shelterApplicationForms = pgTable("shelter_application_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter user)

  // Form details
  title: text("title").notNull().default("Custom Questions"),
  description: text("description"), // Description shown to adopters
  isDefault: boolean("is_default").notNull().default(true), // Is this the active form for this shelter?

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertShelterApplicationFormSchema = createInsertSchema(shelterApplicationForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShelterApplicationForm = typeof shelterApplicationForms.$inferSelect;
export type InsertShelterApplicationForm = z.infer<typeof insertShelterApplicationFormSchema>;

// Shelter Application Questions - Custom questions shelters can add to adoption applications
export const shelterApplicationQuestions = pgTable("shelter_application_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  formId: varchar("form_id").notNull(), // References shelterApplicationForms.id
  shelterId: varchar("shelter_id").notNull(), // References users.id (denormalized for easy filtering)

  // Question content
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull().default("text"), // "text", "textarea", "select", "multiselect", "yes_no"
  options: text("options").array(), // For select/multiselect types
  helperText: text("helper_text"), // Additional guidance for the question

  // Display & validation
  isRequired: boolean("is_required").notNull().default(false),
  position: integer("position").notNull().default(0), // For ordering
  isActive: boolean("is_active").notNull().default(true),

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertShelterApplicationQuestionSchema = createInsertSchema(shelterApplicationQuestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShelterApplicationQuestion = typeof shelterApplicationQuestions.$inferSelect;
export type InsertShelterApplicationQuestion = z.infer<typeof insertShelterApplicationQuestionSchema>;

// ============================================
// SHELTER CRM TABLES
// ============================================

// Intake Records - Track dog intake into shelter
export const intakeRecords = pgTable("intake_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(), // References dogs.id
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter user)

  // Intake Details
  intakeDate: timestamp("intake_date").notNull().defaultNow(),
  intakeType: text("intake_type").notNull(), // "stray", "owner_surrender", "transfer", "return", "rescue", "born_in_care"
  intakeReason: text("intake_reason"), // Detailed reason for intake
  sourceInfo: text("source_info"), // Where the dog came from (previous owner name, transfer shelter, location found, etc.)

  // Intake Condition
  initialCondition: text("initial_condition").notNull().default("good"), // "critical", "poor", "fair", "good", "excellent"
  initialWeight: integer("initial_weight"), // Weight at intake in pounds
  initialNotes: text("initial_notes"), // Notes from intake assessment

  // Pipeline Status
  pipelineStatus: text("pipeline_status").notNull().default("intake"), // "intake", "medical_hold", "behavior_eval", "ready", "adopted", "transferred", "other"
  pipelineStatusChangedAt: timestamp("pipeline_status_changed_at").notNull().defaultNow(),

  // Hold Information
  holdType: text("hold_type"), // "stray_hold", "medical_hold", "legal_hold", "behavior_hold"
  holdExpiresAt: timestamp("hold_expires_at"),
  holdNotes: text("hold_notes"),

  // Outcome
  outcomeType: text("outcome_type"), // "adopted", "transferred", "returned_to_owner", "euthanized", "died_in_care", "other"
  outcomeDate: timestamp("outcome_date"),
  outcomeNotes: text("outcome_notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_intake_dog").on(table.dogId),
  index("idx_intake_shelter").on(table.shelterId),
  index("idx_intake_status").on(table.pipelineStatus),
]);

export const insertIntakeRecordSchema = createInsertSchema(intakeRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const intakeFormSchema = z.object({
  dogId: z.string(),
  intakeDate: z.union([z.string(), z.date()]).optional(),
  intakeType: z.enum(['stray', 'owner_surrender', 'transfer', 'return', 'rescue', 'born_in_care']).default('owner_surrender'),
  sourceInfo: z.string().optional(),
  intakeReason: z.string().optional(),
  initialCondition: z.enum(['critical', 'poor', 'fair', 'good', 'excellent']).default('good'),
  initialWeight: z.number().optional(),
  initialNotes: z.string().optional(),
  pipelineStatus: z.string().optional(),
  holdType: z.enum(['stray_hold', 'medical_hold', 'legal_hold', 'behavior_hold']).optional(),
  holdExpiresAt: z.union([z.string(), z.date()]).optional(),
  holdNotes: z.string().optional(),
});

export const outcomeFormSchema = z.object({
  outcomeType: z.enum(['adopted', 'transferred', 'returned_to_owner', 'euthanized', 'died_in_care', 'other']),
  outcomeDate: z.union([z.string(), z.date()]).optional(),
  outcomeNotes: z.string().optional(),
});

export type IntakeRecord = typeof intakeRecords.$inferSelect;
export type InsertIntakeRecord = z.infer<typeof insertIntakeRecordSchema>;
export type IntakeFormData = z.infer<typeof intakeFormSchema>;
export type OutcomeFormData = z.infer<typeof outcomeFormSchema>;

// Shelter Tasks - Task management for shelter operations (Google Tasks-style)
export const shelterTasks = pgTable("shelter_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter user)
  dogId: varchar("dog_id"), // Optional - some tasks are shelter-wide

  // Task Details
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull(), // "vaccine", "medical", "spay_neuter", "grooming", "behavior_eval", "follow_up", "admin", "custom"

  // Priority & Scheduling
  priority: text("priority").notNull().default("medium"), // "low", "medium", "high", "urgent"
  dueDate: timestamp("due_date"),
  dueTime: text("due_time"), // Optional time for the due date (HH:MM format)
  reminderDate: timestamp("reminder_date"),

  // Hierarchical structure (for subtasks - Google Tasks style)
  parentTaskId: varchar("parent_task_id"), // References shelterTasks.id for subtasks
  sortOrder: integer("sort_order").notNull().default(0), // For drag-and-drop reordering

  // Assignment
  assignedTo: varchar("assigned_to"), // Staff user ID (optional)
  assignedBy: varchar("assigned_by"), // Who created/assigned the task

  // Status
  status: text("status").notNull().default("pending"), // "pending", "in_progress", "completed", "cancelled", "overdue"
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  completionNotes: text("completion_notes"),

  // Auto-generation
  isAutoGenerated: boolean("is_auto_generated").notNull().default(false),
  autoGeneratedFrom: text("auto_generated_from"), // "intake", "vaccine_schedule", "medical_protocol"

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_task_shelter").on(table.shelterId),
  index("idx_task_dog").on(table.dogId),
  index("idx_task_status").on(table.status),
  index("idx_task_due").on(table.dueDate),
  index("idx_task_assigned").on(table.assignedTo),
  index("idx_task_parent").on(table.parentTaskId),
]);

export const insertShelterTaskSchema = createInsertSchema(shelterTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShelterTask = typeof shelterTasks.$inferSelect;
export type InsertShelterTask = z.infer<typeof insertShelterTaskSchema>;

// Medical Records - Track medical history for shelter dogs
export const medicalRecords = pgTable("medical_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(), // References dogs.id
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter user)

  // Record Type
  recordType: text("record_type").notNull(), // "vaccine", "treatment", "exam", "surgery", "medication", "weight_check", "other"
  
  // Source tracking for AI-generated records
  source: text("source"), // "manual", "ai_intake", "ai_screening" - indicates how the record was created
  sourceScreeningId: varchar("source_screening_id"), // References health_screening_results.id if from AI

  // Details
  title: text("title").notNull(), // e.g., "Rabies Vaccine", "Spay Surgery", "Weight Check"
  description: text("description"),
  veterinarian: text("veterinarian"), // Vet name

  // For vaccines specifically
  vaccineName: text("vaccine_name"), // "rabies", "dhpp", "bordetella", "leptospirosis", "canine_influenza", "lyme"
  vaccineManufacturer: text("vaccine_manufacturer"),
  vaccineLotNumber: text("vaccine_lot_number"),
  nextDueDate: timestamp("next_due_date"), // When booster is due

  // For medications
  medicationName: text("medication_name"),
  dosage: text("dosage"),
  frequency: text("frequency"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  // For exams/weight checks
  weight: integer("weight"), // Current weight in pounds
  temperature: real("temperature"), // Body temp in Fahrenheit
  heartRate: integer("heart_rate"),

  // For surgeries
  surgeryType: text("surgery_type"), // "spay", "neuter", "dental", "orthopedic", "other"
  anesthesiaUsed: boolean("anesthesia_used"),
  surgeryNotes: text("surgery_notes"),

  // Files
  attachments: text("attachments").array(), // URLs to attached files/images

  // Cost tracking
  cost: real("cost"),

  // Status
  status: text("status").notNull().default("completed"), // "scheduled", "in_progress", "completed", "cancelled"
  performedAt: timestamp("performed_at").notNull().defaultNow(),
  performedBy: varchar("performed_by"), // User who entered the record

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_medical_dog").on(table.dogId),
  index("idx_medical_shelter").on(table.shelterId),
  index("idx_medical_type").on(table.recordType),
  index("idx_medical_vaccine_due").on(table.nextDueDate),
]);

export const insertMedicalRecordSchema = createInsertSchema(medicalRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MedicalRecord = typeof medicalRecords.$inferSelect;
export type InsertMedicalRecord = z.infer<typeof insertMedicalRecordSchema>;

// Behavior Assessments - Structured behavior evaluations
export const behaviorAssessments = pgTable("behavior_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(), // References dogs.id
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter user)

  // Assessment Info
  assessmentDate: timestamp("assessment_date").notNull().defaultNow(),
  assessedBy: varchar("assessed_by").notNull(), // User who performed the assessment
  assessorRole: text("assessor_role"), // "volunteer", "staff", "trainer", "behaviorist"

  // Overall Assessment
  overallScore: integer("overall_score"), // 1-5 scale (1=needs significant work, 5=excellent)
  overallNotes: text("overall_notes"),

  // Dog-to-Dog Behavior
  dogReactivity: text("dog_reactivity"), // "none", "mild", "moderate", "severe"
  dogPlayStyle: text("dog_play_style"), // "gentle", "rough", "selective", "avoidant"
  dogSocialNotes: text("dog_social_notes"),

  // Dog-to-Cat Behavior  
  catTested: boolean("cat_tested").default(false),
  catReactivity: text("cat_reactivity"), // "none", "curious", "chase", "aggressive"
  catNotes: text("cat_notes"),

  // Dog-to-Child Behavior
  childTested: boolean("child_tested").default(false),
  childBehavior: text("child_behavior"), // "excellent", "good", "cautious", "not_recommended"
  childNotes: text("child_notes"),

  // Resource Guarding
  foodGuarding: text("food_guarding"), // "none", "mild", "moderate", "severe"
  toyGuarding: text("toy_guarding"), // "none", "mild", "moderate", "severe"
  locationGuarding: text("location_guarding"), // "none", "mild", "moderate", "severe"
  guardingNotes: text("guarding_notes"),

  // Handling
  handlingTolerance: text("handling_tolerance"), // "excellent", "good", "fair", "poor"
  groomingTolerance: text("grooming_tolerance"), // "excellent", "good", "fair", "poor"
  vetHandling: text("vet_handling"), // "excellent", "good", "fair", "poor"
  handlingNotes: text("handling_notes"),

  // Leash Behavior
  leashManners: text("leash_manners"), // "excellent", "good", "needs_work", "poor"
  leashReactivity: text("leash_reactivity"), // "none", "mild", "moderate", "severe"
  leashNotes: text("leash_notes"),

  // House Training
  houseTrainedStatus: text("house_trained_status"), // "fully", "mostly", "in_progress", "not_started", "unknown"
  crateTrainedStatus: text("crate_trained_status"), // "fully", "mostly", "in_progress", "not_started", "unknown"

  // Fear/Anxiety
  fearTriggers: text("fear_triggers").array(), // ["loud_noises", "men", "hats", "umbrellas", etc.]
  anxietyLevel: text("anxiety_level"), // "none", "mild", "moderate", "severe"
  anxietyNotes: text("anxiety_notes"),

  // Recommendations
  trainingNeeds: text("training_needs").array(), // ["basic_obedience", "leash_training", "socialization", etc.]
  idealHomeType: text("ideal_home_type"), // Description of ideal home
  homeRestrictions: text("home_restrictions").array(), // ["no_cats", "no_small_children", "experienced_owner_only", etc.]

  // Flags
  behaviorFlags: text("behavior_flags").array(), // ["resource_guarding", "leash_reactive", "separation_anxiety", etc.]

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_behavior_dog").on(table.dogId),
  index("idx_behavior_shelter").on(table.shelterId),
  index("idx_behavior_date").on(table.assessmentDate),
]);

export const insertBehaviorAssessmentSchema = createInsertSchema(behaviorAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BehaviorAssessment = typeof behaviorAssessments.$inferSelect;
export type InsertBehaviorAssessment = z.infer<typeof insertBehaviorAssessmentSchema>;

// ============================================
// SHELTER STAFF & PERMISSIONS
// ============================================

// Staff role definitions with their access levels and default permissions
export const SHELTER_STAFF_ROLES = {
  owner: {
    label: "Shelter Owner",
    description: "Full ownership and control of the shelter account",
    priority: 0,
    defaultPermissions: {
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
    },
  },
  manager: {
    label: "Shelter Manager",
    description: "Full access to shelter operations, staff management, and analytics",
    priority: 1,
    defaultPermissions: {
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
    },
  },
  medical: {
    label: "Medical Staff",
    description: "Access to medical records, treatments, and health screening",
    priority: 2,
    defaultPermissions: {
      canManageDogs: false,
      canManageTasks: true,
      canViewMedical: true,
      canEditMedical: true,
      canManageStaff: false,
      canViewReports: false,
      canManageCalendar: false,
      canManageApplications: false,
      canManageFosters: false,
      canViewBehavior: true,
      canEditBehavior: false,
      canViewInbox: false,
      canSendMessages: false,
    },
  },
  behavior: {
    label: "Behavior Team",
    description: "Access to behavior assessments, evaluations, and training plans",
    priority: 2,
    defaultPermissions: {
      canManageDogs: false,
      canManageTasks: true,
      canViewMedical: true,
      canEditMedical: false,
      canManageStaff: false,
      canViewReports: false,
      canManageCalendar: false,
      canManageApplications: false,
      canManageFosters: false,
      canViewBehavior: true,
      canEditBehavior: true,
      canViewInbox: false,
      canSendMessages: false,
    },
  },
  kennel: {
    label: "Kennel Staff",
    description: "Access to daily care checklists, feeding, and basic notes",
    priority: 3,
    defaultPermissions: {
      canManageDogs: false,
      canManageTasks: true,
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
    },
  },
  foster_coordinator: {
    label: "Foster Coordinator",
    description: "Access to foster network, matching, and foster communications",
    priority: 2,
    defaultPermissions: {
      canManageDogs: false,
      canManageTasks: true,
      canViewMedical: true,
      canEditMedical: false,
      canManageStaff: false,
      canViewReports: false,
      canManageCalendar: true,
      canManageApplications: true,
      canManageFosters: true,
      canViewBehavior: true,
      canEditBehavior: false,
      canViewInbox: true,
      canSendMessages: true,
    },
  },
  adoption_counselor: {
    label: "Adoption Counselor",
    description: "Access to applications, meet & greets, and adopter communications",
    priority: 2,
    defaultPermissions: {
      canManageDogs: false,
      canManageTasks: true,
      canViewMedical: true,
      canEditMedical: false,
      canManageStaff: false,
      canViewReports: false,
      canManageCalendar: true,
      canManageApplications: true,
      canManageFosters: false,
      canViewBehavior: true,
      canEditBehavior: false,
      canViewInbox: true,
      canSendMessages: true,
    },
  },
  volunteer: {
    label: "Volunteer",
    description: "Limited read-only access with assigned tasks only",
    priority: 4,
    defaultPermissions: {
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
    },
  },
} as const;

export type ShelterStaffRole = keyof typeof SHELTER_STAFF_ROLES;

// Shelter Staff - Staff members for shelter accounts
export const shelterStaff = pgTable("shelter_staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter owner)
  userId: varchar("user_id"), // Optional link to Scout user account

  // Staff Info
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull().default("staff").$type<ShelterStaffRole>(), // owner, manager, medical, behavior, kennel, foster_coordinator, adoption_counselor, volunteer
  customTitle: text("custom_title"), // Optional custom title like "Head Veterinarian"

  // Core Permissions
  canManageDogs: boolean("can_manage_dogs").notNull().default(true),
  canManageTasks: boolean("can_manage_tasks").notNull().default(true),
  canViewMedical: boolean("can_view_medical").notNull().default(true),
  canEditMedical: boolean("can_edit_medical").notNull().default(false),
  canManageStaff: boolean("can_manage_staff").notNull().default(false),
  canViewReports: boolean("can_view_reports").notNull().default(false),
  
  // Extended Permissions (for full role-based access)
  canManageCalendar: boolean("can_manage_calendar").notNull().default(false),
  canManageApplications: boolean("can_manage_applications").notNull().default(false),
  canManageFosters: boolean("can_manage_fosters").notNull().default(false),
  canViewBehavior: boolean("can_view_behavior").notNull().default(true),
  canEditBehavior: boolean("can_edit_behavior").notNull().default(false),
  canViewInbox: boolean("can_view_inbox").notNull().default(false),
  canSendMessages: boolean("can_send_messages").notNull().default(false),

  // Invitation tracking
  invitedBy: varchar("invited_by"), // User ID who invited this staff member
  invitedAt: timestamp("invited_at"),
  acceptedAt: timestamp("accepted_at"), // null = pending invitation

  // Status
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"), // Admin notes about this staff member

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_staff_shelter").on(table.shelterId),
  index("idx_staff_user").on(table.userId),
  index("idx_staff_role").on(table.role),
]);

export const insertShelterStaffSchema = createInsertSchema(shelterStaff).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShelterStaff = typeof shelterStaff.$inferSelect;
export type InsertShelterStaff = z.infer<typeof insertShelterStaffSchema>;

// Shelter Staff Invitations - For inviting new staff via email
export const shelterStaffInvitations = pgTable("shelter_staff_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter owner)
  
  email: varchar("email").notNull(),
  role: text("role").notNull().$type<ShelterStaffRole>(),
  customTitle: text("custom_title"),
  
  invitedBy: varchar("invited_by").notNull(), // User ID who created the invitation
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Invitations expire after 7 days
  
  // Token for accepting invitation
  token: varchar("token").notNull().unique(),
  
  // Status
  status: text("status").notNull().default("pending"), // pending, accepted, expired, revoked
  acceptedAt: timestamp("accepted_at"),
  acceptedByUserId: varchar("accepted_by_user_id"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_staff_invitation_shelter").on(table.shelterId),
  index("idx_staff_invitation_email").on(table.email),
  index("idx_staff_invitation_token").on(table.token),
  index("idx_staff_invitation_status").on(table.status),
]);

export const insertShelterStaffInvitationSchema = createInsertSchema(shelterStaffInvitations).omit({
  id: true,
  createdAt: true,
});

export type ShelterStaffInvitation = typeof shelterStaffInvitations.$inferSelect;
export type InsertShelterStaffInvitation = z.infer<typeof insertShelterStaffInvitationSchema>;

// ============================================
// PHASE 1: MOBILE CHECKOUT & AUTO TASKS
// ============================================

// Adoption Checkouts - Fast adoption processing workflow
export const adoptionCheckouts = pgTable("adoption_checkouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter)
  journeyId: varchar("journey_id").notNull(), // References adoptionJourneys.id
  dogId: varchar("dog_id").notNull(), // References dogs.id
  adopterId: varchar("adopter_id").notNull(), // References users.id (adopter)

  // Checkout Status
  status: text("status").notNull().default("pending"), // "pending", "in_progress", "completed", "cancelled"

  // Adoption Fee
  adoptionFee: real("adoption_fee").default(0),
  feeWaived: boolean("fee_waived").default(false),
  feeWaivedReason: text("fee_waived_reason"),
  paymentMethod: text("payment_method"), // "cash", "card", "check", "waived"
  paymentStatus: text("payment_status").default("pending"), // "pending", "paid", "waived"
  paymentReference: text("payment_reference"), // Transaction ID or receipt number

  // Contract & Documents
  contractSigned: boolean("contract_signed").default(false),
  contractSignedAt: timestamp("contract_signed_at"),
  contractUrl: text("contract_url"), // URL to signed contract PDF
  adopterSignature: text("adopter_signature"), // Base64 signature image

  // Microchip Transfer
  microchipTransferred: boolean("microchip_transferred").default(false),
  microchipNumber: text("microchip_number"),
  microchipRegistry: text("microchip_registry"),

  // Supplies Provided
  suppliesProvided: jsonb("supplies_provided"), // { "food_sample": true, "leash": true, "collar": true, etc. }

  // Follow-up
  followUpScheduled: boolean("follow_up_scheduled").default(false),
  followUpDate: timestamp("follow_up_date"),
  followUpNotes: text("follow_up_notes"),

  // Processing
  processedBy: varchar("processed_by"), // Staff member who processed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  processingTimeSeconds: integer("processing_time_seconds"), // Track efficiency

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_checkout_shelter").on(table.shelterId),
  index("idx_checkout_journey").on(table.journeyId),
  index("idx_checkout_status").on(table.status),
]);

export const insertAdoptionCheckoutSchema = createInsertSchema(adoptionCheckouts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdoptionCheckout = typeof adoptionCheckouts.$inferSelect;
export type InsertAdoptionCheckout = z.infer<typeof insertAdoptionCheckoutSchema>;

// Task Rules - Automatic task generation rules
export const taskRules = pgTable("task_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id"), // null = global rule, otherwise shelter-specific

  // Rule Definition
  name: text("name").notNull(),
  description: text("description"),

  // Trigger Conditions
  triggerType: text("trigger_type").notNull(), // "intake", "medical_due", "application_received", "time_in_shelter", "status_change", "schedule"
  triggerConditions: jsonb("trigger_conditions"), // { "pipelineStatus": "intake", "daysInShelter": 7, etc. }

  // Task Template
  taskTitle: text("task_title").notNull(),
  taskDescription: text("task_description"),
  taskCategory: text("task_category").notNull().default("general"), // "medical", "feeding", "cleaning", "exercise", "grooming", "documentation", "general"
  taskPriority: text("task_priority").notNull().default("medium"), // "low", "medium", "high", "urgent"

  // Due Date Calculation
  dueDateOffset: integer("due_date_offset").default(0), // Days from trigger
  dueTimeOfDay: text("due_time_of_day"), // "09:00" - specific time of day

  // Assignment
  assignToRole: text("assign_to_role"), // "staff", "volunteer", "manager", or specific user ID

  // Recurrence
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // "daily", "weekly", "monthly", "custom"
  recurrenceInterval: integer("recurrence_interval").default(1), // Every X days/weeks/months

  // Status
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_rule_shelter").on(table.shelterId),
  index("idx_rule_trigger").on(table.triggerType),
]);

export const insertTaskRuleSchema = createInsertSchema(taskRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TaskRule = typeof taskRules.$inferSelect;
export type InsertTaskRule = z.infer<typeof insertTaskRuleSchema>;

// ============================================
// PHASE 2: ADVANCED MEDICAL & FOSTER
// ============================================

// Medical Templates - Quick-fill templates for vaccines, treatments
export const medicalTemplates = pgTable("medical_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id"), // null = global template

  // Template Info
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // "vaccine", "treatment", "exam", "surgery", "medication"

  // Template Fields
  title: text("title").notNull(), // Pre-filled title for medical record
  recordType: text("record_type").notNull(), // Maps to medicalRecords.recordType
  vaccineName: text("vaccine_name"), // For vaccine templates
  defaultDosage: text("default_dosage"),
  defaultNotes: text("default_notes"),

  // Schedule
  defaultNextDueDays: integer("default_next_due_days"), // Days until next dose

  // Protocol
  isPartOfProtocol: boolean("is_part_of_protocol").default(false),
  protocolName: text("protocol_name"), // e.g., "Puppy Vaccine Series"
  protocolStep: integer("protocol_step"), // 1, 2, 3, etc.

  // Usage
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_med_template_shelter").on(table.shelterId),
  index("idx_med_template_category").on(table.category),
]);

export const insertMedicalTemplateSchema = createInsertSchema(medicalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MedicalTemplate = typeof medicalTemplates.$inferSelect;
export type InsertMedicalTemplate = z.infer<typeof insertMedicalTemplateSchema>;

// Foster Assignments - Track dogs in foster care
export const fosterAssignments = pgTable("foster_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(), // References dogs.id
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter)
  fosterId: varchar("foster_id").notNull(), // References users.id (foster parent)

  // Assignment Details
  status: text("status").notNull().default("active"), // "pending", "active", "completed", "cancelled"
  assignmentType: text("assignment_type").notNull().default("standard"), // "standard", "medical", "behavioral", "hospice", "emergency"

  // Dates
  startDate: timestamp("start_date").notNull().defaultNow(),
  expectedEndDate: timestamp("expected_end_date"),
  actualEndDate: timestamp("actual_end_date"),

  // Care Instructions
  careInstructions: text("care_instructions"),
  feedingSchedule: text("feeding_schedule"),
  medicationSchedule: jsonb("medication_schedule"), // { "medication_name": "dosage", "schedule": "twice daily" }
  behaviorNotes: text("behavior_notes"),

  // Check-ins
  lastCheckInDate: timestamp("last_check_in_date"),
  checkInFrequency: text("check_in_frequency").default("weekly"), // "daily", "weekly", "biweekly"

  // Outcome
  outcome: text("outcome"), // "returned_to_shelter", "adopted_by_foster", "transferred", "passed_away"
  outcomeNotes: text("outcome_notes"),

  // Ratings
  fosterRating: integer("foster_rating"), // 1-5 rating of foster experience
  dogRating: integer("dog_rating"), // 1-5 rating of dog in foster

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_foster_dog").on(table.dogId),
  index("idx_foster_shelter").on(table.shelterId),
  index("idx_foster_parent").on(table.fosterId),
  index("idx_foster_status").on(table.status),
]);

export const insertFosterAssignmentSchema = createInsertSchema(fosterAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FosterAssignment = typeof fosterAssignments.$inferSelect;
export type InsertFosterAssignment = z.infer<typeof insertFosterAssignmentSchema>;

// ============================================
// PHASE 3: TRANSFERS & FORMS
// ============================================

// Animal Transfers - Track transfers between organizations
export const animalTransfers = pgTable("animal_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(), // References dogs.id

  // Source
  sourceShelterId: varchar("source_shelter_id").notNull(), // Sending organization
  sourceContactName: text("source_contact_name"),
  sourceContactPhone: text("source_contact_phone"),
  sourceContactEmail: text("source_contact_email"),

  // Destination
  destinationShelterId: varchar("destination_shelter_id"), // Receiving organization (if in system)
  destinationName: text("destination_name").notNull(), // Organization name
  destinationContactName: text("destination_contact_name"),
  destinationContactPhone: text("destination_contact_phone"),
  destinationContactEmail: text("destination_contact_email"),

  // Transfer Details
  transferType: text("transfer_type").notNull(), // "incoming", "outgoing"
  transferReason: text("transfer_reason"), // "space", "medical", "behavioral", "location_match", "rescue_partner"
  status: text("status").notNull().default("pending"), // "pending", "approved", "in_transit", "completed", "cancelled"

  // Dates
  requestedDate: timestamp("requested_date").notNull().defaultNow(),
  approvedDate: timestamp("approved_date"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),

  // Transport
  transportMethod: text("transport_method"), // "shelter_vehicle", "volunteer", "transport_service", "partner_pickup"
  transportNotes: text("transport_notes"),

  // Documentation
  healthCertAttached: boolean("health_cert_attached").default(false),
  recordsTransferred: boolean("records_transferred").default(false),
  transferDocumentUrl: text("transfer_document_url"),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_transfer_dog").on(table.dogId),
  index("idx_transfer_source").on(table.sourceShelterId),
  index("idx_transfer_dest").on(table.destinationShelterId),
  index("idx_transfer_status").on(table.status),
]);

export const insertAnimalTransferSchema = createInsertSchema(animalTransfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AnimalTransfer = typeof animalTransfers.$inferSelect;
export type InsertAnimalTransfer = z.infer<typeof insertAnimalTransferSchema>;

// Custom Form Templates - Configurable intake/outcome forms
export const formTemplates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id"), // null = global template

  // Form Info
  name: text("name").notNull(),
  description: text("description"),
  formType: text("form_type").notNull(), // "intake", "outcome", "medical_exam", "behavior_eval", "foster_agreement", "adoption_contract"

  // Form Definition
  fields: jsonb("fields").notNull(), // Array of field definitions
  sections: jsonb("sections"), // Optional section groupings

  // Validation
  requiredFields: text("required_fields").array(),
  validationRules: jsonb("validation_rules"),

  // Status
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").notNull().default(true),
  version: integer("version").default(1),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_form_shelter").on(table.shelterId),
  index("idx_form_type").on(table.formType),
]);

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FormTemplate = typeof formTemplates.$inferSelect;
export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;

// ============================================
// PHASE 4: REPORTING & ANALYTICS
// ============================================

// Report Definitions - Pre-built and custom reports
export const reportDefinitions = pgTable("report_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id"), // null = system report

  // Report Info
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // "operations", "medical", "adoptions", "intake", "outcomes", "financial", "custom"

  // Report Configuration
  reportType: text("report_type").notNull(), // "summary", "detailed", "chart", "export"
  dataSource: text("data_source").notNull(), // "dogs", "adoptions", "medical", "tasks", "intake", etc.

  // Query Definition
  filters: jsonb("filters"), // { "dateRange": "last_30_days", "status": "active", etc. }
  groupBy: text("group_by").array(), // ["month", "breed", "outcome"]
  sortBy: text("sort_by"),
  columns: jsonb("columns"), // Column definitions for the report

  // Scheduling
  isScheduled: boolean("is_scheduled").default(false),
  scheduleFrequency: text("schedule_frequency"), // "daily", "weekly", "monthly"
  scheduleDay: integer("schedule_day"), // Day of week/month
  scheduleTime: text("schedule_time"), // "09:00"
  emailRecipients: text("email_recipients").array(),

  // System Reports
  isSystemReport: boolean("is_system_report").default(false),
  isFavorite: boolean("is_favorite").default(false),
  lastRunAt: timestamp("last_run_at"),
  runCount: integer("run_count").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_report_shelter").on(table.shelterId),
  index("idx_report_category").on(table.category),
]);

export const insertReportDefinitionSchema = createInsertSchema(reportDefinitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ReportDefinition = typeof reportDefinitions.$inferSelect;
export type InsertReportDefinition = z.infer<typeof insertReportDefinitionSchema>;

// Shelter Analytics - Daily/weekly metrics snapshots
export const shelterAnalytics = pgTable("shelter_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),

  // Time Period
  periodType: text("period_type").notNull(), // "daily", "weekly", "monthly"
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),

  // Intake Metrics
  intakeCount: integer("intake_count").default(0),
  intakeBySource: jsonb("intake_by_source"), // { "stray": 5, "surrender": 3, "transfer": 2 }

  // Outcome Metrics
  outcomeCount: integer("outcome_count").default(0),
  adoptionCount: integer("adoption_count").default(0),
  returnToOwnerCount: integer("return_to_owner_count").default(0),
  transferOutCount: integer("transfer_out_count").default(0),
  euthanasiaCount: integer("euthanasia_count").default(0),

  // Population
  averagePopulation: real("average_population"),
  endingPopulation: integer("ending_population"),

  // Length of Stay
  averageLengthOfStay: real("average_length_of_stay"), // Days
  medianLengthOfStay: real("median_length_of_stay"),

  // Live Release Rate
  liveReleaseRate: real("live_release_rate"), // Percentage

  // Applications
  applicationsReceived: integer("applications_received").default(0),
  applicationsApproved: integer("applications_approved").default(0),

  // Foster
  fosterPlacements: integer("foster_placements").default(0),
  activeFosters: integer("active_fosters").default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_analytics_shelter").on(table.shelterId),
  index("idx_analytics_period").on(table.periodStart),
]);

export const insertShelterAnalyticsSchema = createInsertSchema(shelterAnalytics).omit({
  id: true,
  createdAt: true,
});

export type ShelterAnalytics = typeof shelterAnalytics.$inferSelect;
export type InsertShelterAnalytics = z.infer<typeof insertShelterAnalyticsSchema>;

// ============================================
// DONATION & FUNDRAISING TABLES
// ============================================

// Shelter Payment Settings - Stripe account connection (for future Stripe integration)
export const shelterPaymentSettings = pgTable("shelter_payment_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),

  // Stripe Connect (for future integration)
  stripeAccountId: varchar("stripe_account_id"),
  stripeAccountStatus: text("stripe_account_status").default("not_connected"), // "not_connected", "pending", "active", "restricted"
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false),

  // Donation Settings
  acceptsDonations: boolean("accepts_donations").default(true),
  minimumDonation: integer("minimum_donation").default(5), // In dollars
  suggestedAmounts: jsonb("suggested_amounts").default(sql`'[10, 25, 50, 100]'::jsonb`), // Suggested donation amounts

  // Display Settings
  showDonorNames: boolean("show_donor_names").default(true), // Show donor names publicly
  showDonationAmounts: boolean("show_donation_amounts").default(false), // Show amounts publicly
  thankYouMessage: text("thank_you_message"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_payment_shelter").on(table.shelterId),
]);

export const insertShelterPaymentSettingsSchema = createInsertSchema(shelterPaymentSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShelterPaymentSettings = typeof shelterPaymentSettings.$inferSelect;
export type InsertShelterPaymentSettings = z.infer<typeof insertShelterPaymentSettingsSchema>;

// Fundraising Campaigns
export const fundraisingCampaigns = pgTable("fundraising_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),

  // Campaign Details
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),

  // Goal & Progress
  goalAmount: integer("goal_amount").notNull(), // In cents
  currentAmount: integer("current_amount").default(0), // In cents
  donorCount: integer("donor_count").default(0),

  // Campaign Type
  campaignType: text("campaign_type").notNull().default("general"), // "general", "medical", "rescue", "facility", "emergency"
  dogId: varchar("dog_id"), // Optional - link to specific dog for medical campaigns

  // Status & Timing
  status: text("status").notNull().default("draft"), // "draft", "active", "paused", "completed", "cancelled"
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  // Display
  isFeatured: boolean("is_featured").default(false),
  isPublic: boolean("is_public").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_campaign_shelter").on(table.shelterId),
  index("idx_campaign_status").on(table.status),
  index("idx_campaign_dog").on(table.dogId),
]);

export const insertFundraisingCampaignSchema = createInsertSchema(fundraisingCampaigns).omit({
  id: true,
  currentAmount: true,
  donorCount: true,
  createdAt: true,
  updatedAt: true,
});

export type FundraisingCampaign = typeof fundraisingCampaigns.$inferSelect;
export type InsertFundraisingCampaign = z.infer<typeof insertFundraisingCampaignSchema>;

// Donations - Individual donation records
export const donations = pgTable("donations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),
  campaignId: varchar("campaign_id"), // Optional - general donation if null

  // Donor Info
  donorName: text("donor_name"),
  donorEmail: text("donor_email"),
  donorUserId: varchar("donor_user_id"), // If logged in user
  isAnonymous: boolean("is_anonymous").default(false),

  // Amount
  amount: integer("amount").notNull(), // In cents
  currency: text("currency").default("usd"),

  // Payment Info (for future Stripe integration)
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  stripeChargeId: varchar("stripe_charge_id"),
  paymentStatus: text("payment_status").notNull().default("pending"), // "pending", "succeeded", "failed", "refunded"

  // Metadata
  message: text("message"), // Optional message from donor
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: text("recurring_frequency"), // "monthly", "yearly"

  // For demo/testing without Stripe
  isTestDonation: boolean("is_test_donation").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_donation_shelter").on(table.shelterId),
  index("idx_donation_campaign").on(table.campaignId),
  index("idx_donation_status").on(table.paymentStatus),
  index("idx_donation_donor").on(table.donorUserId),
]);

export const insertDonationSchema = createInsertSchema(donations).omit({
  id: true,
  createdAt: true,
});

export type Donation = typeof donations.$inferSelect;
export type InsertDonation = z.infer<typeof insertDonationSchema>;

// Shelter Resources - Community services and resources offered by shelters
export const shelterResources = pgTable("shelter_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(), // References users.id (shelter user)

  // Resource Details
  resourceType: text("resource_type").notNull(), // "food_pantry", "vaccinations", "spay_neuter", "microchipping", "training", "behavior_support", "supplies", "emergency_shelter", "other"
  title: text("title").notNull(),
  description: text("description"),

  // Availability
  availability: text("availability"), // "daily", "weekly", "monthly", "by_appointment", "emergency_only"
  schedule: text("schedule"), // Free text for hours/days

  // Eligibility & Requirements
  eligibilityNotes: text("eligibility_notes"), // Income requirements, location restrictions, etc.
  cost: text("cost"), // "free", "low_cost", "sliding_scale", or specific amount

  // Contact
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  websiteUrl: text("website_url"),

  // Status
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_resource_shelter").on(table.shelterId),
  index("idx_resource_type").on(table.resourceType),
  index("idx_resource_active").on(table.isActive),
]);

export const insertShelterResourceSchema = createInsertSchema(shelterResources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShelterResource = typeof shelterResources.$inferSelect;
export type InsertShelterResource = z.infer<typeof insertShelterResourceSchema>;

// Platform Settings - Global configuration for the platform
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: jsonb("setting_value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"), // Admin user ID who last updated
});

export type PlatformSetting = typeof platformSettings.$inferSelect;

// Feature Flags - Toggle platform features on/off
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  key: text("key").notNull().unique(), // Unique identifier like "ai_matching", "swipe_discovery"
  label: text("label").notNull(), // Human-readable name
  description: text("description"), // What this feature does
  category: text("category").notNull(), // "ai", "discovery", "communication", "modes"
  isEnabled: boolean("is_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: varchar("updated_by"), // Admin user ID who last updated
}, (table) => [
  index("idx_feature_flag_key").on(table.key),
  index("idx_feature_flag_category").on(table.category),
]);

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  updatedAt: true,
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// Feature flag keys as constants for type safety
export const FEATURE_FLAG_KEYS = {
  AI_BREED_IDENTIFICATION: 'ai_breed_identification',
  AI_NAME_GENERATION: 'ai_name_generation',
  AI_FORM_ASSISTANCE: 'ai_form_assistance',
  AI_BIO_ENHANCEMENT: 'ai_bio_enhancement',
  AI_HEALTH_SCREENING: 'ai_health_screening',
  FOSTER_MODE: 'foster_mode',
  REHOME_MODE: 'rehome_mode',
  URGENCY_SYSTEM: 'urgency_system',
  PHONE_SCREENING: 'phone_screening',
  VIRTUAL_TOURS: 'virtual_tours',
  // User-side Features
  USER_DONATIONS: 'user_donations',
  USER_RESOURCES: 'user_resources',
  // Shelter CRM Features
  SHELTER_AI_HEALTH_SCREENING: 'shelter_ai_health_screening',
  SHELTER_FOSTER_MANAGEMENT: 'shelter_foster_management',
  SHELTER_PIPELINE_VIEW: 'shelter_pipeline_view',
  SHELTER_BULK_OPERATIONS: 'shelter_bulk_operations',
  SHELTER_INTAKE_AUTOMATION: 'shelter_intake_automation',
  SHELTER_AI_BIO_GENERATOR: 'shelter_ai_bio_generator',
  SHELTER_PHONE_SCREENING: 'shelter_phone_screening',
  SHELTER_MEDICAL_TRACKING: 'shelter_medical_tracking',
  SHELTER_DONATIONS: 'shelter_donations',
  SHELTER_RESOURCES: 'shelter_resources',
  SHELTER_APPLICATION_BUILDER: 'shelter_application_builder',
  // Automation Engine
  AUTOMATIONS_ENGINE: 'automations_engine',
} as const;

export type FeatureFlagKey = typeof FEATURE_FLAG_KEYS[keyof typeof FEATURE_FLAG_KEYS];

// Animal Types - Supported animal types on the platform
export const ANIMAL_TYPES = [
  { id: 'dog', label: 'Dogs', icon: 'Dog', enabled: true },
  { id: 'cat', label: 'Cats', icon: 'Cat', enabled: false },
  { id: 'bird', label: 'Birds', icon: 'Bird', enabled: false },
  { id: 'rabbit', label: 'Rabbits', icon: 'Rabbit', enabled: false },
  { id: 'other', label: 'Other Animals', icon: 'PawPrint', enabled: false },
] as const;

export type AnimalType = typeof ANIMAL_TYPES[number]['id'];

// ============================================
// PLUGIN WEBHOOK SYSTEM
// ============================================

// Plugin Definitions - Available plugins shelters can install
export const plugins = pgTable("plugins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  
  // Plugin Info
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(), // "stripe_payments", "checkr_background", etc.
  description: text("description").notNull(),
  category: text("category").notNull(), // "payment", "background_check", "communication", "automation"
  iconUrl: text("icon_url"),
  
  // Developer Info
  developerId: varchar("developer_id"), // User who created this plugin (for custom plugins)
  isOfficial: boolean("is_official").notNull().default(false), // Scout-verified plugins
  
  // Configuration
  configSchema: jsonb("config_schema").notNull(), // JSON Schema for configuration fields
  webhookEvents: text("webhook_events").array(), // ["adoption.completed", "application.received", etc.]
  requiredScopes: text("required_scopes").array(), // ["read:dogs", "write:adoptions", etc.]
  
  // Webhook Settings
  webhookUrl: text("webhook_url"), // Base URL for receiving webhooks
  supportsOAuth: boolean("supports_oauth").notNull().default(false),
  oauthAuthUrl: text("oauth_auth_url"),
  oauthTokenUrl: text("oauth_token_url"),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  isPublic: boolean("is_public").notNull().default(true), // Available in plugin store
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_plugins_category").on(table.category),
  index("idx_plugins_slug").on(table.slug),
]);

// Plugin Installations - Shelters' installed plugins
export const pluginInstallations = pgTable("plugin_installations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  
  pluginId: varchar("plugin_id").notNull().references(() => plugins.id),
  shelterId: varchar("shelter_id").notNull(), // References users.id
  
  // Configuration
  config: jsonb("config").notNull(), // Plugin-specific configuration (API keys, settings, etc.)
  
  // OAuth tokens (encrypted)
  accessToken: text("access_token"), // Encrypted OAuth access token
  refreshToken: text("refresh_token"), // Encrypted OAuth refresh token
  tokenExpiresAt: timestamp("token_expires_at"),
  
  // Webhook signature for security
  webhookSecret: text("webhook_secret"), // Secret for validating incoming webhooks
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  
  // Usage stats
  totalWebhooksReceived: integer("total_webhooks_received").notNull().default(0),
  totalWebhooksSent: integer("total_webhooks_sent").notNull().default(0),
  lastWebhookAt: timestamp("last_webhook_at"),
  
  installedAt: timestamp("installed_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_plugin_install_shelter").on(table.shelterId),
  index("idx_plugin_install_plugin").on(table.pluginId),
]);

// Webhook Logs - Track all webhook activity
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  
  installationId: varchar("installation_id").notNull().references(() => pluginInstallations.id),
  
  // Webhook Details
  direction: text("direction").notNull(), // "incoming" or "outgoing"
  eventType: text("event_type").notNull(), // "adoption.completed", "payment.received", etc.
  
  // Request/Response
  requestUrl: text("request_url"),
  requestMethod: text("request_method"), // "POST", "GET", etc.
  requestHeaders: jsonb("request_headers"),
  requestBody: jsonb("request_body"),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  
  // Validation
  signatureValid: boolean("signature_valid"),
  
  // Status
  status: text("status").notNull(), // "success", "failed", "pending_retry"
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Performance
  processingTimeMs: integer("processing_time_ms"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_webhook_logs_installation").on(table.installationId),
  index("idx_webhook_logs_event").on(table.eventType),
  index("idx_webhook_logs_status").on(table.status),
  index("idx_webhook_logs_created").on(table.createdAt),
]);

export const insertPluginSchema = createInsertSchema(plugins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPluginInstallationSchema = createInsertSchema(pluginInstallations).omit({
  id: true,
  installedAt: true,
  updatedAt: true,
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true,
});

export type Plugin = typeof plugins.$inferSelect;
export type InsertPlugin = z.infer<typeof insertPluginSchema>;
export type PluginInstallation = typeof pluginInstallations.$inferSelect;
export type InsertPluginInstallation = z.infer<typeof insertPluginInstallationSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;

// ============================================
// MARKETING / ADVERTISERS
// ============================================

// Advertisers - Business partners who pay to advertise on the platform
export const advertisers = pgTable("advertisers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),

  // Business Info
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  website: text("website"),

  // Contact Info
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactName: text("contact_name"),

  // Contract/Status
  status: text("status").notNull().default("active"), // "active", "paused", "expired"
  tier: text("tier").notNull().default("basic"), // "basic", "premium", "enterprise"
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),

  // Admin notes
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_advertiser_status").on(table.status),
  index("idx_advertiser_tier").on(table.tier),
]);

export const insertAdvertiserSchema = createInsertSchema(advertisers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Advertiser = typeof advertisers.$inferSelect;
export type InsertAdvertiser = z.infer<typeof insertAdvertiserSchema>;

// Advertiser Locations - Store locations for advertisers to show on map
export const advertiserLocations = pgTable("advertiser_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  advertiserId: varchar("advertiser_id").notNull(), // References advertisers.id

  // Location Info
  name: text("name").notNull(), // e.g., "PetSmart - Downtown Seattle"
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code"),

  // Geolocation
  latitude: real("latitude"),
  longitude: real("longitude"),

  // Details
  phone: text("phone"),
  hours: text("hours"), // Operating hours description
  services: text("services").array(), // ["grooming", "training", "adoption_events"]

  // Display
  heroImageUrl: text("hero_image_url"),
  isFeatured: boolean("is_featured").default(false),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_advertiser_location_advertiser").on(table.advertiserId),
  index("idx_advertiser_location_active").on(table.isActive),
  index("idx_advertiser_location_coords").on(table.latitude, table.longitude),
]);

export const insertAdvertiserLocationSchema = createInsertSchema(advertiserLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AdvertiserLocation = typeof advertiserLocations.$inferSelect;
export type InsertAdvertiserLocation = z.infer<typeof insertAdvertiserLocationSchema>;

// Combined type for map display
export interface AdvertiserLocationWithBusiness extends AdvertiserLocation {
  advertiser: Advertiser;
}

// ============================================
// AI SCAN METADATA - ML IMPROVEMENT PIPELINE
// ============================================

// Stores anonymized scan data for model improvement
export const scanMetadata = pgTable("scan_metadata", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id"), // Optional, for user-initiated scans

  // Species/Breed Detection
  species: text("species").notNull(), // "dog", "cat", "other"
  breed: text("breed").notNull(),
  breedConfidence: text("breed_confidence").notNull(), // "high", "medium", "low"

  // Temperament Analysis (stored as JSON for flexibility)
  temperamentData: jsonb("temperament_data"), // { calmLevel, friendlinessScore, confidenceScore, stressScore, energyEstimate }
  bodyLanguageData: jsonb("body_language_data"), // { tailPosition, earPosition, posture, facialExpression }

  // ML Feedback (for future model improvements)
  userFeedback: text("user_feedback"), // "accurate", "inaccurate", "partially_accurate"
  correctedBreed: text("corrected_breed"), // If user corrects the breed
  correctedData: jsonb("corrected_data"), // Any corrections user provides

  // Scan Context
  scanContext: text("scan_context"), // "intake", "rehome", "general"
  deviceType: text("device_type"), // "mobile", "desktop"

  // Timestamps
  scanTimestamp: timestamp("scan_timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_scan_species").on(table.species),
  index("idx_scan_breed").on(table.breed),
  index("idx_scan_confidence").on(table.breedConfidence),
  index("idx_scan_timestamp").on(table.scanTimestamp),
]);

export const insertScanMetadataSchema = createInsertSchema(scanMetadata).omit({
  id: true,
  createdAt: true,
});

export type ScanMetadata = typeof scanMetadata.$inferSelect;
export type InsertScanMetadata = z.infer<typeof insertScanMetadataSchema>;

// ============================================
// BULK OPERATIONS - Message Templates & Import Logs
// ============================================

// Message Templates - Reusable templates for shelter communications
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),
  
  name: text("name").notNull(),
  subject: text("subject"),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"), // "general", "application_update", "adoption_followup", "foster_request", "medical_reminder"
  
  // Template variables: {{adopter_name}}, {{dog_name}}, {{shelter_name}}, etc.
  variables: text("variables").array(),
  
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_template_shelter").on(table.shelterId),
  index("idx_template_category").on(table.category),
]);

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;

// Bulk Import Logs - Track bulk import operations
export const bulkImportLogs = pgTable("bulk_import_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),
  importedBy: varchar("imported_by").notNull(),
  
  importType: text("import_type").notNull(), // "dogs", "medical_records", "photos"
  fileName: text("file_name"),
  
  // Results
  totalRows: integer("total_rows").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errors: jsonb("errors"), // Array of error details
  
  status: text("status").notNull().default("processing"), // "processing", "completed", "failed"
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertBulkImportLogSchema = createInsertSchema(bulkImportLogs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type BulkImportLog = typeof bulkImportLogs.$inferSelect;
export type InsertBulkImportLog = z.infer<typeof insertBulkImportLogSchema>;

// Bulk Message Logs - Track bulk message sends
export const bulkMessageLogs = pgTable("bulk_message_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),
  sentBy: varchar("sent_by").notNull(),
  
  templateId: varchar("template_id"),
  subject: text("subject"),
  content: text("content").notNull(),
  
  // Recipients
  recipientType: text("recipient_type").notNull(), // "adopters", "fosters", "applicants", "custom"
  recipientFilter: jsonb("recipient_filter"), // Filter criteria used
  recipientCount: integer("recipient_count").notNull().default(0),
  
  // Results
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  
  status: text("status").notNull().default("sending"), // "sending", "completed", "failed"
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertBulkMessageLogSchema = createInsertSchema(bulkMessageLogs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type BulkMessageLog = typeof bulkMessageLogs.$inferSelect;
export type InsertBulkMessageLog = z.infer<typeof insertBulkMessageLogSchema>;

// CSV Import validation schemas
export const csvDogImportSchema = z.object({
  name: z.string().min(1, "Name is required"),
  breed: z.string().min(1, "Breed is required"),
  age: z.coerce.number().min(0).max(30),
  ageCategory: z.enum(["puppy", "young", "adult", "senior"]).optional(),
  size: z.enum(["small", "medium", "large"]),
  weight: z.coerce.number().min(1).max(300),
  energyLevel: z.enum(["low", "moderate", "high", "very_high"]),
  temperament: z.string().optional(), // Comma-separated
  goodWithKids: z.coerce.boolean().optional().default(false),
  goodWithDogs: z.coerce.boolean().optional().default(false),
  goodWithCats: z.coerce.boolean().optional().default(false),
  bio: z.string().optional(),
  specialNeeds: z.string().optional(),
  vaccinated: z.coerce.boolean().optional().default(false),
  spayedNeutered: z.coerce.boolean().optional().default(false),
  listingType: z.enum(["adoption", "foster"]).optional().default("adoption"),
  urgencyLevel: z.enum(["normal", "urgent", "critical"]).optional().default("normal"),
});

export type CsvDogImport = z.infer<typeof csvDogImportSchema>;

export const csvMedicalImportSchema = z.object({
  dogName: z.string().min(1, "Dog name is required"),
  recordType: z.enum(["vaccine", "treatment", "exam", "surgery", "medication", "weight_check", "other"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  veterinarian: z.string().optional(),
  vaccineName: z.string().optional(),
  performedAt: z.string().optional(), // Date string
  nextDueDate: z.string().optional(), // Date string
  cost: z.coerce.number().optional(),
});

export type CsvMedicalImport = z.infer<typeof csvMedicalImportSchema>;

// ============================================
// HEALTH SCREENING (AI-powered health analysis)
// ============================================

export const healthScreeningResults = pgTable("health_screening_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").references(() => dogs.id, { onDelete: "cascade" }),
  shelterId: varchar("shelter_id").references(() => users.id),
  intakeRecordId: varchar("intake_record_id").references(() => intakeRecords.id, { onDelete: "set null" }), // Link to intake if from intake process
  
  // Screening input
  symptoms: text("symptoms"), // User-described symptoms
  imageUrls: text("image_urls").array(), // Uploaded photos for analysis
  screeningType: text("screening_type").notNull(), // 'symptom_check' | 'image_analysis' | 'full_assessment' | 'intake_health_snapshot'
  
  // Health snapshot body parts captured (for intake)
  capturedBodyParts: text("captured_body_parts").array(), // ['eyes', 'ears', 'skin', 'teeth', 'body'] - which areas were photographed
  
  // AI Analysis results
  severity: text("severity").notNull(), // 'low' | 'moderate' | 'high' | 'critical'
  recommendation: text("recommendation").notNull(), // 'home_care' | 'monitor' | 'vet_visit' | 'emergency'
  aiAnalysis: text("ai_analysis").notNull(), // Full AI analysis text
  conditions: text("conditions").array(), // Detected/suspected conditions
  careInstructions: text("care_instructions"), // Home care advice if applicable
  
  // Review tracking
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  isReviewed: boolean("is_reviewed").notNull().default(false),
  
  // Linked medical record (created after review)
  medicalRecordId: varchar("medical_record_id").references(() => medicalRecords.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_health_screening_dog").on(table.dogId),
  index("idx_health_screening_shelter").on(table.shelterId),
  index("idx_health_screening_reviewed").on(table.isReviewed),
]);

export const insertHealthScreeningSchema = createInsertSchema(healthScreeningResults).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewNotes: true,
  isReviewed: true,
  medicalRecordId: true,
});

export type HealthScreeningResult = typeof healthScreeningResults.$inferSelect;
export type InsertHealthScreeningResult = z.infer<typeof insertHealthScreeningSchema>;

// ============================================
// TREATMENT PLANS (Medical treatment tracking)
// ============================================

export const treatmentPlans = pgTable("treatment_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull().references(() => dogs.id, { onDelete: "cascade" }),
  shelterId: varchar("shelter_id").notNull().references(() => users.id),
  healthScreeningId: varchar("health_screening_id").references(() => healthScreeningResults.id),
  
  title: text("title").notNull(),
  description: text("description"),
  condition: text("condition"), // Condition being treated
  goal: text("goal"), // Treatment goal
  
  priority: text("priority").notNull().default("normal"), // 'low' | 'normal' | 'high' | 'urgent'
  status: text("status").notNull().default("active"), // 'active' | 'completed' | 'cancelled' | 'on_hold'
  
  assignedTo: varchar("assigned_to").references(() => users.id), // Staff member responsible
  startDate: timestamp("start_date").notNull().defaultNow(),
  targetEndDate: timestamp("target_end_date"),
  completedAt: timestamp("completed_at"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_treatment_plan_dog").on(table.dogId),
  index("idx_treatment_plan_shelter").on(table.shelterId),
  index("idx_treatment_plan_status").on(table.status),
]);

export const insertTreatmentPlanSchema = createInsertSchema(treatmentPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type TreatmentPlan = typeof treatmentPlans.$inferSelect;
export type InsertTreatmentPlan = z.infer<typeof insertTreatmentPlanSchema>;

// Treatment Entries - Individual steps/tasks within a treatment plan
export const treatmentEntries = pgTable("treatment_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  treatmentPlanId: varchar("treatment_plan_id").notNull().references(() => treatmentPlans.id, { onDelete: "cascade" }),
  
  entryType: text("entry_type").notNull(), // 'medication' | 'procedure' | 'follow_up' | 'observation' | 'other'
  title: text("title").notNull(),
  description: text("description"),
  
  // For medications
  medicationName: text("medication_name"),
  dosage: text("dosage"),
  frequency: text("frequency"),
  
  // Scheduling
  scheduledDate: timestamp("scheduled_date"),
  dueDate: timestamp("due_date"),
  
  // Completion
  status: text("status").notNull().default("pending"), // 'pending' | 'completed' | 'skipped' | 'overdue'
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  completionNotes: text("completion_notes"),
  
  // Cost tracking
  cost: real("cost"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_treatment_entry_plan").on(table.treatmentPlanId),
  index("idx_treatment_entry_status").on(table.status),
]);

export const insertTreatmentEntrySchema = createInsertSchema(treatmentEntries).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  completedBy: true,
});

export type TreatmentEntry = typeof treatmentEntries.$inferSelect;
export type InsertTreatmentEntry = z.infer<typeof insertTreatmentEntrySchema>;

// ============================================
// VET REFERRALS (External vet escalation)
// ============================================

export const vetReferrals = pgTable("vet_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull().references(() => dogs.id, { onDelete: "cascade" }),
  shelterId: varchar("shelter_id").notNull().references(() => users.id),
  healthScreeningId: varchar("health_screening_id").references(() => healthScreeningResults.id),
  treatmentPlanId: varchar("treatment_plan_id").references(() => treatmentPlans.id),
  
  // Referral details
  reason: text("reason").notNull(),
  urgency: text("urgency").notNull().default("routine"), // 'routine' | 'soon' | 'urgent' | 'emergency'
  symptoms: text("symptoms"),
  aiAnalysisSummary: text("ai_analysis_summary"),
  
  // Vet information
  vetClinicName: text("vet_clinic_name"),
  vetName: text("vet_name"),
  vetPhone: text("vet_phone"),
  vetEmail: text("vet_email"),
  vetAddress: text("vet_address"),
  
  // Scheduling
  appointmentDate: timestamp("appointment_date"),
  appointmentNotes: text("appointment_notes"),
  
  // Status tracking
  status: text("status").notNull().default("pending"), // 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  
  // Outcome
  diagnosisFromVet: text("diagnosis_from_vet"),
  treatmentFromVet: text("treatment_from_vet"),
  followUpRequired: boolean("follow_up_required").default(false),
  followUpNotes: text("follow_up_notes"),
  cost: real("cost"),
  
  // Audit
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_vet_referral_dog").on(table.dogId),
  index("idx_vet_referral_shelter").on(table.shelterId),
  index("idx_vet_referral_status").on(table.status),
  index("idx_vet_referral_urgency").on(table.urgency),
]);

export const insertVetReferralSchema = createInsertSchema(vetReferrals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type VetReferral = typeof vetReferrals.$inferSelect;
export type InsertVetReferral = z.infer<typeof insertVetReferralSchema>;

// ============================================
// SHELTER AVAILABILITY TABLES
// ============================================

// Shelter recurring weekly availability slots for meet & greets
export const shelterAvailability = pgTable("shelter_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull().references(() => users.id),
  
  // Day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  dayOfWeek: integer("day_of_week").notNull(),
  
  // Time slots in HH:MM format (24-hour)
  startTime: varchar("start_time", { length: 5 }).notNull(), // e.g., "09:00"
  endTime: varchar("end_time", { length: 5 }).notNull(), // e.g., "17:00"
  
  // Slot duration in minutes (for booking individual appointments)
  slotDuration: integer("slot_duration").notNull().default(60), // default 1 hour slots
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_shelter_availability_shelter").on(table.shelterId),
  index("idx_shelter_availability_day").on(table.dayOfWeek),
]);

export const insertShelterAvailabilitySchema = createInsertSchema(shelterAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShelterAvailability = typeof shelterAvailability.$inferSelect;
export type InsertShelterAvailability = z.infer<typeof insertShelterAvailabilitySchema>;

// Shelter blocked dates (holidays, closures, etc.)
export const shelterBlockedDates = pgTable("shelter_blocked_dates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull().references(() => users.id),
  
  // The blocked date
  blockedDate: timestamp("blocked_date").notNull(),
  
  // Optional reason for blocking
  reason: text("reason"),
  
  // Whether this blocks the whole day or specific hours
  allDay: boolean("all_day").notNull().default(true),
  startTime: varchar("start_time", { length: 5 }), // If not all day, block from this time
  endTime: varchar("end_time", { length: 5 }), // If not all day, block until this time
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_shelter_blocked_dates_shelter").on(table.shelterId),
  index("idx_shelter_blocked_dates_date").on(table.blockedDate),
]);

export const insertShelterBlockedDateSchema = createInsertSchema(shelterBlockedDates).omit({
  id: true,
  createdAt: true,
});

export type ShelterBlockedDate = typeof shelterBlockedDates.$inferSelect;
export type InsertShelterBlockedDate = z.infer<typeof insertShelterBlockedDateSchema>;

// ============================================
// AUTOMATION RUNS (Explainability Logs)
// ============================================

export const automationRuns = pgTable("automation_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),
  
  // What triggered this automation
  triggerType: text("trigger_type").notNull(), // "vaccine_added", "pipeline_moved", "hold_expired", "intake_created", "medical_added"
  triggerEvent: text("trigger_event").notNull(), // Human-readable description of the trigger
  
  // What was affected
  targetType: text("target_type").notNull(), // "task", "pipeline_status", "notification", "dog"
  targetId: varchar("target_id"), // ID of the affected entity
  dogId: varchar("dog_id"), // Dog associated with the automation (if any)
  
  // What action was taken
  actionType: text("action_type").notNull(), // "auto_complete_task", "move_pipeline", "create_task", "send_notification"
  actionDescription: text("action_description").notNull(), // Plain English: "Completed vaccine task for Bella"
  
  // Outcome
  result: text("result").notNull().default("success"), // "success", "failed", "skipped"
  resultMessage: text("result_message"), // Additional details or error message
  
  // Metadata
  metadata: jsonb("metadata"), // Additional JSON data about the automation
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_automation_runs_shelter").on(table.shelterId),
  index("idx_automation_runs_dog").on(table.dogId),
  index("idx_automation_runs_trigger").on(table.triggerType),
  index("idx_automation_runs_created").on(table.createdAt),
]);

export const insertAutomationRunSchema = createInsertSchema(automationRuns).omit({
  id: true,
  createdAt: true,
});

export type AutomationRun = typeof automationRuns.$inferSelect;
export type InsertAutomationRun = z.infer<typeof insertAutomationRunSchema>;

// ============================================
// DOG EVENTS (Normalized Timeline)
// ============================================

export const dogEvents = pgTable("dog_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(),
  shelterId: varchar("shelter_id"),
  
  // Event type classification
  eventType: text("event_type").notNull(), // PIPELINE_MOVED, VACCINE_ADMINISTERED, HOLD_STARTED, HOLD_ENDED, APP_STATUS_CHANGED, INTAKE_CREATED, MEDICAL_ADDED, TASK_COMPLETED, etc.
  
  // Event details
  payload: jsonb("payload"), // Flexible JSON for event-specific data
  description: text("description").notNull(), // Human-readable description
  
  // Actor info
  actorType: text("actor_type").notNull().default("system"), // "user", "system", "automation"
  actorId: varchar("actor_id"), // User ID if actor is a user
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_dog_events_dog").on(table.dogId),
  index("idx_dog_events_shelter").on(table.shelterId),
  index("idx_dog_events_type").on(table.eventType),
  index("idx_dog_events_created").on(table.createdAt),
]);

export const insertDogEventSchema = createInsertSchema(dogEvents).omit({
  id: true,
  createdAt: true,
});

export type DogEvent = typeof dogEvents.$inferSelect;
export type InsertDogEvent = z.infer<typeof insertDogEventSchema>;

// ============================================
// ADMIN DIAGNOSTICS TYPES
// ============================================

export type DiagnosticStatus = "PASS" | "FAIL" | "WARN" | "SKIP";

export interface DiagnosticResult {
  id: string;
  label: string;
  category: string;
  route?: string;
  method?: string;
  status: DiagnosticStatus;
  statusCode?: number;
  durationMs: number;
  message: string;
  timestamp: string;
  error?: string;
}

export interface RouteTestConfig {
  id: string;
  label: string;
  category: string;
  route: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  expectedStatus?: number;
  requiresShelterProfile?: boolean;
}

export interface RunAllSummary {
  total: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface RunAllResponse {
  summary: RunAllSummary;
  results: DiagnosticResult[];
}

export interface WebhookEventLog {
  id: string;
  source: "vapi" | "stripe" | "email" | "other";
  eventType: string;
  receivedAt: string;
  status: "SUCCESS" | "FAILED";
  message?: string;
}