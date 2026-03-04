import { pgTable, text, varchar, integer, boolean, timestamp, real, index, jsonb } from "drizzle-orm/pg-core";
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

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  email: varchar("email").unique(),
  password: text("password"), // null for OAuth users, bcrypt hash for email/password
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default('adopter'),
  isAdmin: boolean("is_admin").notNull().default(false), // Admin access flag
  isActive: boolean("is_active").notNull().default(true), // Account status
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// APPLICATION TABLES
// ============================================

export const shelterProfiles = pgTable("shelter_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  shelterName: text("shelter_name").notNull(),
  location: text("location").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  licenseNumber: text("license_number"),
  description: text("description"),
  isVerified: boolean("is_verified").default(false),
  
  // Admin approval
  approvalStatus: text("approval_status").notNull().default("pending"), // "pending", "approved", "rejected"
  approvedBy: varchar("approved_by"), // Admin user ID who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ownerProfiles = pgTable("owner_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  fullName: text("full_name").notNull(),
  location: text("location").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),

  // Mode: What is the user currently doing?
  mode: text("mode").notNull().default("adopt"), // "adopt" or "rehome"

  // Living Situation (for adopters)
  homeType: text("home_type"),
  hasYard: boolean("has_yard"),
  hasOtherPets: boolean("has_other_pets"),
  otherPetsType: text("other_pets_type"),

  // Activity Level & Lifestyle (for adopters)
  activityLevel: text("activity_level"),
  workSchedule: text("work_schedule"),
  exerciseCommitment: text("exercise_commitment"),

  // Experience (for adopters)
  experienceLevel: text("experience_level"),

  // Preferences (for adopters)
  preferredSize: text("preferred_size").array(),
  preferredAge: text("preferred_age").array(),
  preferredEnergy: text("preferred_energy").array(),

  // Contact Info (for rehomers and adopters)
  phoneNumber: text("phone_number"),

  // Rehoming Info (for rehomers)
  reasonForRehoming: text("reason_for_rehoming"),

  // Profile
  profileImage: text("profile_image"),

  // Location (for both adopters and rehomers)
  city: text("city"),
  state: text("state"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  searchRadius: integer("search_radius").notNull().default(25),

  // Admin approval (for rehomers listing their own dogs)
  rehomerApprovalStatus: text("rehomer_approval_status").notNull().default("auto_approved"), // "pending", "approved", "rejected", "auto_approved"
  approvedBy: varchar("approved_by"), // Admin user ID who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const dogs = pgTable("dogs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(), // References users.id (shelter or owner)
  name: text("name").notNull(),
  size: text("size").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  address: text("address"), // Full street address
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  isPublic: boolean("is_public").notNull().default(false), // Privacy toggle
  breed: text("breed").notNull(),
  age: integer("age").notNull(),
  ageCategory: text("age_category").notNull(),
  weight: integer("weight").notNull(),
  energyLevel: text("energy_level").notNull(),
  temperament: text("temperament").array().notNull(),
  goodWithKids: boolean("good_with_kids").notNull(),
  goodWithDogs: boolean("good_with_dogs").notNull(),
  goodWithCats: boolean("good_with_cats").notNull(),
  bio: text("bio").notNull(),
  specialNeeds: text("special_needs"),
  dayInLifeVideo: text("day_in_life_video"), // URL to video showing dog's daily routine
  photos: text("photos").array().notNull(),
  shelterId: text("shelter_id").notNull(),
  shelterName: text("shelter_name").notNull(),
  shelterAddress: text("shelter_address").notNull(),
  shelterPhone: text("shelter_phone").notNull(),
  vaccinated: boolean("vaccinated").notNull(),
  spayedNeutered: boolean("spayed_neutered").notNull(),
  viewCount: integer("view_count").notNull().default(0),
  
  // Urgency Status (for at-risk/euthanasia list dogs)
  urgencyLevel: text("urgency_level").notNull().default("normal"), // "normal", "urgent", "critical"
  urgencyDeadline: timestamp("urgency_deadline"), // Date by which they need placement
  urgencyReason: text("urgency_reason"), // "euthanasia_list", "medical", "space", "behavioral"

  // Admin approval
  approvalStatus: text("approval_status").notNull().default("approved"), // "pending", "approved", "rejected" (default approved for shelters, pending for rehomers)
  approvedBy: varchar("approved_by"), // Admin user ID who approved
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const swipes = pgTable("swipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull().references(() => userProfiles.id),
  dogId: varchar("dog_id").notNull().references(() => dogs.id),
  direction: text("direction").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull().references(() => userProfiles.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  dogContext: text("dog_context"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  dogId: varchar("dog_id").notNull(),
  shelterName: text("shelter_name").notNull(),
  shelterId: varchar("shelter_id"),
  
  status: text("status").notNull().default("open"),
  channelType: text("channel_type").notNull().default("chat"),
  priority: text("priority").notNull().default("normal"),
  assignedTo: varchar("assigned_to"),
  
  shelterUnreadCount: integer("shelter_unread_count").notNull().default(0),
  userUnreadCount: integer("user_unread_count").notNull().default(0),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  snoozedUntil: timestamp("snoozed_until"),
  closedAt: timestamp("closed_at"),
  closedBy: varchar("closed_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_conv_shelter").on(table.shelterId),
  index("idx_conv_status").on(table.status),
  index("idx_conv_user").on(table.userId),
]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  senderId: text("sender_id").notNull(),
  senderType: text("sender_type").notNull(),
  messageType: text("message_type").notNull().default("text"),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  isRead: boolean("is_read").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("idx_msg_conv").on(table.conversationId),
]);

export const virtualTours = pgTable("virtual_tours", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull().references(() => dogs.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  shelterId: text("shelter_id").notNull(), // ID of shelter/owner hosting the tour
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("scheduled"), // "scheduled", "completed", "cancelled"
  videoRoomId: text("video_room_id"), // For video call integration
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adoptionJourneys = pgTable("adoption_journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull().references(() => users.id),
  dogId: varchar("dog_id").notNull().references(() => dogs.id),
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
  status: text("status").notNull().default("active"), // "active", "completed", "cancelled"
  notes: text("notes"),

  // Milestones/Badges tracking
  milestones: text("milestones").array().notNull().default(sql`ARRAY[]::text[]`), // "first_swipe", "shelter_visit_complete", "adoption_day"

  // AI Review Fields
  aiReviewScore: integer("ai_review_score"), // 0-100
  aiRecommendation: text("ai_recommendation"), // "approve", "request_more_info", etc.
  aiReviewSummary: text("ai_review_summary"),
  aiReviewData: jsonb("ai_review_data"), // Full AI review JSON
  reviewedAt: timestamp("reviewed_at"),

  // Application responses (user answers to application questions)
  applicationResponses: jsonb("application_responses"),
  
  // Admin review fields
  adminNotes: text("admin_notes"),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: varchar("rejected_by"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const adoptionDocuments = pgTable("adoption_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  journeyId: varchar("journey_id").notNull().references(() => adoptionJourneys.id),
  documentType: text("document_type").notNull(), // "application", "id", "proof_of_residence", "vet_reference", "other"
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  aiProcessingResult: text("ai_processing_result"), // JSON string with OCR + AI extraction results
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const journeyReminders = pgTable("journey_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  journeyId: varchar("journey_id").notNull().references(() => adoptionJourneys.id),
  reminderType: text("reminder_type").notNull(), // "home_visit_upcoming", "meet_greet_upcoming", "document_needed", etc.
  message: text("message").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Consultation Calls - User-initiated AI phone consultations about dogs
export const consultationCalls = pgTable("consultation_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull().references(() => users.id),
  dogId: varchar("dog_id").references(() => dogs.id), // Optional - may be general consultation
  
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
});

// Household Pets Schema
export const householdPets = pgTable("household_pets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  species: text("species").notNull(), // "dog", "cat", "other"
  breed: text("breed"),
  age: integer("age"),
  size: text("size"),
  energyLevel: text("energy_level"),
  temperament: text("temperament").array(),
  goodWithDogs: boolean("good_with_dogs"),
  goodWithCats: boolean("good_with_cats"),
  goodWithKids: boolean("good_with_kids"),
  specialNeeds: text("special_needs"),
  photo: text("photo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// ADMIN CONTENT MANAGEMENT TABLES
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

// ============================================
// SHELTER CRM TABLES
// ============================================

// Intake Records - Track dog intake from surrender or transfer
export const intakeRecords = pgTable("intake_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull().references(() => dogs.id),
  shelterId: varchar("shelter_id").notNull(), // User ID of shelter
  
  // Intake details
  intakeDate: timestamp("intake_date").notNull().defaultNow(),
  intakeType: text("intake_type").notNull().default("surrender"), // "surrender", "stray", "transfer", "return", "seizure"
  intakeSource: text("intake_source"), // Where the dog came from
  intakeNotes: text("intake_notes"),
  
  // Previous owner info (if surrender)
  previousOwnerName: text("previous_owner_name"),
  previousOwnerPhone: text("previous_owner_phone"),
  previousOwnerEmail: text("previous_owner_email"),
  surrenderReason: text("surrender_reason"),
  
  // Initial assessment
  initialHealthStatus: text("initial_health_status"), // "healthy", "minor_issues", "needs_medical", "critical"
  initialBehaviorNotes: text("initial_behavior_notes"),
  
  // Pipeline tracking
  pipelineStatus: text("pipeline_status").notNull().default("intake"), // "intake", "medical_hold", "behavior_eval", "ready", "adopted", "transferred"
  pipelineStatusChangedAt: timestamp("pipeline_status_changed_at").defaultNow(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Shelter Tasks - Task management for shelter operations
export const shelterTasks = pgTable("shelter_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(), // User ID of shelter
  dogId: varchar("dog_id").references(() => dogs.id), // Optional dog association
  
  // Task details
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull().default("custom"), // "vaccine", "medical", "spay_neuter", "grooming", "behavior_eval", "follow_up", "admin", "custom"
  
  // Scheduling
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  
  // Status and priority
  status: text("status").notNull().default("pending"), // "pending", "in_progress", "completed", "cancelled"
  priority: text("priority").notNull().default("medium"), // "low", "medium", "high", "urgent"
  
  // Assignment
  assignedTo: varchar("assigned_to"), // Staff member ID
  assignedBy: varchar("assigned_by"), // Who created/assigned
  
  // Auto-generated task tracking
  isAutoGenerated: boolean("is_auto_generated").notNull().default(false),
  sourceType: text("source_type"), // "intake", "medical", "behavior", "vaccine_schedule"
  sourceId: varchar("source_id"), // ID of the source record
  
  // Notes
  notes: text("notes"),
  completionNotes: text("completion_notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Medical Records - Comprehensive medical tracking
export const medicalRecords = pgTable("medical_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull().references(() => dogs.id),
  shelterId: varchar("shelter_id").notNull(), // User ID of shelter
  
  // Record type
  recordType: text("record_type").notNull(), // "exam", "vaccine", "treatment", "surgery", "medication", "test", "note"
  title: text("title").notNull(),
  description: text("description"),
  
  // Date tracking
  recordDate: timestamp("record_date").notNull().defaultNow(),
  nextDueDate: timestamp("next_due_date"), // For recurring items like vaccines
  
  // Vaccine specific
  vaccineName: text("vaccine_name"),
  vaccineManufacturer: text("vaccine_manufacturer"),
  vaccineLotNumber: text("vaccine_lot_number"),
  vaccineExpiration: timestamp("vaccine_expiration"),
  
  // Treatment/Medication specific
  medicationName: text("medication_name"),
  dosage: text("dosage"),
  frequency: text("frequency"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  
  // Test/Lab specific
  testType: text("test_type"),
  testResult: text("test_result"),
  testNotes: text("test_notes"),
  
  // Veterinarian info
  vetName: text("vet_name"),
  vetClinic: text("vet_clinic"),
  vetPhone: text("vet_phone"),
  
  // Costs
  cost: real("cost"),
  isPaid: boolean("is_paid").default(false),
  
  // Attachments
  attachmentUrls: text("attachment_urls").array(),
  
  // Status
  status: text("status").notNull().default("completed"), // "scheduled", "completed", "cancelled"
  
  // Staff tracking
  recordedBy: varchar("recorded_by"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Behavior Assessments - Structured behavior evaluations
export const behaviorAssessments = pgTable("behavior_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull().references(() => dogs.id),
  shelterId: varchar("shelter_id").notNull(),
  
  // Assessment info
  assessmentDate: timestamp("assessment_date").notNull().defaultNow(),
  assessorName: text("assessor_name").notNull(),
  assessorId: varchar("assessor_id"),
  
  // Scores (1-5 scale)
  overallScore: integer("overall_score"), // 1-5
  
  // Temperament scores
  friendlinessHumans: integer("friendliness_humans"),
  friendlinessDogs: integer("friendliness_dogs"),
  friendlinessCats: integer("friendliness_cats"),
  friendlinessChildren: integer("friendliness_children"),
  
  // Behavior scores
  energyLevel: integer("energy_level"),
  leashBehavior: integer("leash_behavior"),
  resourceGuarding: integer("resource_guarding"), // Lower is better
  fearfulness: integer("fearfulness"), // Lower is better
  aggression: integer("aggression"), // Lower is better
  trainability: integer("trainability"),
  
  // Detailed observations
  socialBehaviorNotes: text("social_behavior_notes"),
  playStyleNotes: text("play_style_notes"),
  handlingNotes: text("handling_notes"),
  feedingNotes: text("feeding_notes"),
  environmentReactionNotes: text("environment_reaction_notes"),
  
  // Known triggers/concerns
  triggers: text("triggers").array(),
  concerns: text("concerns").array(),
  
  // Recommendations
  homeRequirements: text("home_requirements").array(), // "no_kids", "no_cats", "experienced_owner", etc.
  trainingRecommendations: text("training_recommendations"),
  placementNotes: text("placement_notes"),
  
  // Status
  status: text("status").notNull().default("completed"), // "in_progress", "completed", "needs_reeval"
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Shelter Staff - Staff/volunteer management
export const shelterStaff = pgTable("shelter_staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(), // User ID of shelter (owner)
  userId: varchar("user_id"), // Optional link to users table for login access
  
  // Staff info
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  
  // Role and permissions
  role: text("role").notNull().default("volunteer"), // "admin", "manager", "staff", "volunteer", "vet_tech"
  permissions: text("permissions").array(), // Fine-grained permissions
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"),
  
  // Notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// PHASE 1: MOBILE CHECKOUT & AUTO TASKS
// ============================================

// Adoption Checkouts - Fast adoption processing workflow
export const adoptionCheckouts = pgTable("adoption_checkouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),
  journeyId: varchar("journey_id").notNull(),
  dogId: varchar("dog_id").notNull(),
  adopterId: varchar("adopter_id").notNull(),
  
  status: text("status").notNull().default("pending"),
  
  adoptionFee: real("adoption_fee").default(0),
  feeWaived: boolean("fee_waived").default(false),
  feeWaivedReason: text("fee_waived_reason"),
  paymentMethod: text("payment_method"),
  paymentStatus: text("payment_status").default("pending"),
  paymentReference: text("payment_reference"),
  
  contractSigned: boolean("contract_signed").default(false),
  contractSignedAt: timestamp("contract_signed_at"),
  contractUrl: text("contract_url"),
  adopterSignature: text("adopter_signature"),
  
  microchipTransferred: boolean("microchip_transferred").default(false),
  microchipNumber: text("microchip_number"),
  microchipRegistry: text("microchip_registry"),
  
  suppliesProvided: jsonb("supplies_provided"),
  
  followUpScheduled: boolean("follow_up_scheduled").default(false),
  followUpDate: timestamp("follow_up_date"),
  followUpNotes: text("follow_up_notes"),
  
  processedBy: varchar("processed_by"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  processingTimeSeconds: integer("processing_time_seconds"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Rules - Automatic task generation rules
export const taskRules = pgTable("task_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id"),
  
  name: text("name").notNull(),
  description: text("description"),
  
  triggerType: text("trigger_type").notNull(),
  triggerConditions: jsonb("trigger_conditions"),
  
  taskTitle: text("task_title").notNull(),
  taskDescription: text("task_description"),
  taskCategory: text("task_category").notNull().default("general"),
  taskPriority: text("task_priority").notNull().default("medium"),
  
  dueDateOffset: integer("due_date_offset").default(0),
  dueTimeOfDay: text("due_time_of_day"),
  
  assignToRole: text("assign_to_role"),
  
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"),
  recurrenceInterval: integer("recurrence_interval").default(1),
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// PHASE 2: ADVANCED MEDICAL & FOSTER
// ============================================

// Medical Templates - Quick-fill templates for vaccines, treatments
export const medicalTemplates = pgTable("medical_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id"),
  
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  
  title: text("title").notNull(),
  recordType: text("record_type").notNull(),
  vaccineName: text("vaccine_name"),
  defaultDosage: text("default_dosage"),
  defaultNotes: text("default_notes"),
  
  defaultNextDueDays: integer("default_next_due_days"),
  
  isPartOfProtocol: boolean("is_part_of_protocol").default(false),
  protocolName: text("protocol_name"),
  protocolStep: integer("protocol_step"),
  
  usageCount: integer("usage_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Foster Assignments - Track dogs in foster care
export const fosterAssignments = pgTable("foster_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(),
  shelterId: varchar("shelter_id").notNull(),
  fosterId: varchar("foster_id").notNull(),
  
  status: text("status").notNull().default("active"),
  assignmentType: text("assignment_type").notNull().default("standard"),
  
  startDate: timestamp("start_date").notNull().defaultNow(),
  expectedEndDate: timestamp("expected_end_date"),
  actualEndDate: timestamp("actual_end_date"),
  
  careInstructions: text("care_instructions"),
  feedingSchedule: text("feeding_schedule"),
  medicationSchedule: jsonb("medication_schedule"),
  behaviorNotes: text("behavior_notes"),
  
  lastCheckInDate: timestamp("last_check_in_date"),
  checkInFrequency: text("check_in_frequency").default("weekly"),
  
  outcome: text("outcome"),
  outcomeNotes: text("outcome_notes"),
  
  fosterRating: integer("foster_rating"),
  dogRating: integer("dog_rating"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// PHASE 3: TRANSFERS & FORMS
// ============================================

// Animal Transfers - Track transfers between organizations
export const animalTransfers = pgTable("animal_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  dogId: varchar("dog_id").notNull(),
  
  sourceShelterId: varchar("source_shelter_id").notNull(),
  sourceContactName: text("source_contact_name"),
  sourceContactPhone: text("source_contact_phone"),
  sourceContactEmail: text("source_contact_email"),
  
  destinationShelterId: varchar("destination_shelter_id"),
  destinationName: text("destination_name").notNull(),
  destinationContactName: text("destination_contact_name"),
  destinationContactPhone: text("destination_contact_phone"),
  destinationContactEmail: text("destination_contact_email"),
  
  transferType: text("transfer_type").notNull(),
  transferReason: text("transfer_reason"),
  status: text("status").notNull().default("pending"),
  
  requestedDate: timestamp("requested_date").notNull().defaultNow(),
  approvedDate: timestamp("approved_date"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  
  transportMethod: text("transport_method"),
  transportNotes: text("transport_notes"),
  
  healthCertAttached: boolean("health_cert_attached").default(false),
  recordsTransferred: boolean("records_transferred").default(false),
  transferDocumentUrl: text("transfer_document_url"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Custom Form Templates - Configurable intake/outcome forms
export const formTemplates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id"),
  
  name: text("name").notNull(),
  description: text("description"),
  formType: text("form_type").notNull(),
  
  fields: jsonb("fields").notNull(),
  sections: jsonb("sections"),
  
  requiredFields: text("required_fields").array(),
  validationRules: jsonb("validation_rules"),
  
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").notNull().default(true),
  version: integer("version").default(1),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ============================================
// PHASE 4: REPORTING & ANALYTICS
// ============================================

// Report Definitions - Pre-built and custom reports
export const reportDefinitions = pgTable("report_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id"),
  
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  
  reportType: text("report_type").notNull(),
  dataSource: text("data_source").notNull(),
  
  filters: jsonb("filters"),
  groupBy: text("group_by").array(),
  sortBy: text("sort_by"),
  columns: jsonb("columns"),
  
  isScheduled: boolean("is_scheduled").default(false),
  scheduleFrequency: text("schedule_frequency"),
  scheduleDay: integer("schedule_day"),
  scheduleTime: text("schedule_time"),
  emailRecipients: text("email_recipients").array(),
  
  isSystemReport: boolean("is_system_report").default(false),
  isFavorite: boolean("is_favorite").default(false),
  lastRunAt: timestamp("last_run_at"),
  runCount: integer("run_count").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Shelter Analytics - Daily/weekly metrics snapshots
export const shelterAnalytics = pgTable("shelter_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
  shelterId: varchar("shelter_id").notNull(),
  
  periodType: text("period_type").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  intakeCount: integer("intake_count").default(0),
  intakeBySource: jsonb("intake_by_source"),
  
  outcomeCount: integer("outcome_count").default(0),
  adoptionCount: integer("adoption_count").default(0),
  returnToOwnerCount: integer("return_to_owner_count").default(0),
  transferOutCount: integer("transfer_out_count").default(0),
  euthanasiaCount: integer("euthanasia_count").default(0),
  
  averagePopulation: real("average_population"),
  endingPopulation: integer("ending_population"),
  
  averageLengthOfStay: real("average_length_of_stay"),
  medianLengthOfStay: real("median_length_of_stay"),
  
  liveReleaseRate: real("live_release_rate"),
  
  applicationsReceived: integer("applications_received").default(0),
  applicationsApproved: integer("applications_approved").default(0),
  
  fosterPlacements: integer("foster_placements").default(0),
  activeFosters: integer("active_fosters").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});