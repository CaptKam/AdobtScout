CREATE TABLE "adoption_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"journey_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"ai_processing_result" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adoption_journeys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"dog_id" varchar NOT NULL,
	"current_step" text DEFAULT 'application' NOT NULL,
	"application_submitted_at" timestamp,
	"home_visit_scheduled_at" timestamp,
	"home_visit_completed_at" timestamp,
	"meet_greet_scheduled_at" timestamp,
	"meet_greet_completed_at" timestamp,
	"adoption_date" timestamp,
	"completed_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"milestones" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"ai_review_score" integer,
	"ai_recommendation" text,
	"ai_review_summary" text,
	"ai_review_data" jsonb,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_pets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"species" text NOT NULL,
	"breed" text,
	"age" integer,
	"size" text,
	"energy_level" text,
	"temperament" text[],
	"good_with_dogs" boolean,
	"good_with_cats" boolean,
	"good_with_kids" boolean,
	"special_needs" text,
	"photo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"dog_context" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"dog_id" varchar NOT NULL,
	"shelter_name" text NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dogs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"breed" text NOT NULL,
	"age" integer NOT NULL,
	"age_category" text NOT NULL,
	"size" text NOT NULL,
	"weight" integer NOT NULL,
	"energy_level" text NOT NULL,
	"temperament" text[] NOT NULL,
	"good_with_kids" boolean NOT NULL,
	"good_with_dogs" boolean NOT NULL,
	"good_with_cats" boolean NOT NULL,
	"bio" text NOT NULL,
	"special_needs" text,
	"photos" text[] NOT NULL,
	"shelter_id" text NOT NULL,
	"shelter_name" text NOT NULL,
	"shelter_address" text NOT NULL,
	"shelter_phone" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"vaccinated" boolean NOT NULL,
	"spayed_neutered" boolean NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"day_in_life_video" text,
	"approval_status" text DEFAULT 'approved' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"conversation_id" varchar NOT NULL,
	"sender_id" text NOT NULL,
	"sender_type" text NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"full_name" text NOT NULL,
	"location" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shelter_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"shelter_name" text NOT NULL,
	"location" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"license_number" text,
	"description" text,
	"is_verified" boolean DEFAULT false,
	"approval_status" text DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swipes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"dog_id" varchar NOT NULL,
	"direction" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"mode" text DEFAULT 'adopt' NOT NULL,
	"home_type" text,
	"has_yard" boolean,
	"has_other_pets" boolean,
	"other_pets_type" text,
	"activity_level" text,
	"work_schedule" text,
	"exercise_commitment" text,
	"experience_level" text,
	"preferred_size" text[],
	"preferred_age" text[],
	"preferred_energy" text[],
	"phone_number" text,
	"reason_for_rehoming" text,
	"profile_image" text,
	"city" text,
	"state" text,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"search_radius" integer DEFAULT 25 NOT NULL,
	"rehomer_approval_status" text DEFAULT 'auto_approved' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"email" varchar,
	"password" text,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" text DEFAULT 'adopter' NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "virtual_tours" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"dog_id" varchar NOT NULL,
	"adopter_user_id" varchar NOT NULL,
	"shelter_user_id" varchar NOT NULL,
	"scheduled_time" timestamp NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");