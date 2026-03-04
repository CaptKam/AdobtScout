
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";
import { generateFakeDogs, generateFakeUsers, generateFakeShelters, generateFakeRehomers, generateFakeFosters } from "../data/generate-fake-data";

neonConfig.webSocketConstructor = ws;

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log("🌱 Seeding database with comprehensive fake data...");

  try {
    // Clear existing data in correct order (respecting foreign keys)
    console.log("  Clearing existing data...");
    await db.delete(schema.messages);
    await db.delete(schema.conversations);
    await db.delete(schema.chatMessages);
    await db.delete(schema.swipes);
    await db.delete(schema.dogs);
    await db.delete(schema.userProfiles);
    await db.delete(schema.shelterProfiles);
    await db.delete(schema.ownerProfiles);
    await db.delete(schema.users);
    console.log("  ✓ Cleared existing data");

    // Generate and insert shelter profiles
    console.log("  Generating 20 shelter profiles...");
    const shelters = generateFakeShelters();
    
    // Create shelter users first
    console.log("  Creating shelter user accounts...");
    const shelterUsers = [];
    for (let i = 0; i < 20; i++) {
      shelterUsers.push({
        id: `shelter-user-${i + 1}`,
        email: `shelter${i + 1}@example.com`,
        firstName: shelters[i].shelterName.split(' ')[0],
        lastName: "Rescue",
        role: "shelter",
      });
    }
    await db.insert(schema.users).values(shelterUsers);
    console.log("  ✓ Created 20 shelter user accounts");
    
    // Now insert shelter profiles
    await db.insert(schema.shelterProfiles).values(shelters);
    console.log("  ✓ Inserted 20 shelter profiles");

    // Generate and insert dogs
    console.log("  Generating 100 dogs across shelters...");
    const dogs = generateFakeDogs(20);
    await db.insert(schema.dogs).values(dogs);
    console.log("  ✓ Inserted 100 dogs");

    // Generate and insert adopter profiles with users
    console.log("  Generating 50 adopter profiles with varied preferences...");
    const users = generateFakeUsers();
    
    // Create adopter user accounts
    const adopterUsers = [];
    for (let i = 0; i < 50; i++) {
      adopterUsers.push({
        id: `adopter-user-${i + 1}`,
        email: `adopter${i + 1}@example.com`,
        firstName: `User`,
        lastName: `${i + 1}`,
        role: "adopter",
      });
    }
    await db.insert(schema.users).values(adopterUsers);
    console.log("  ✓ Created 50 adopter user accounts");
    
    // Link profiles to users
    const userProfilesWithIds = users.map((profile, index) => ({
      ...profile,
      id: `adopter-user-${index + 1}`,
    }));
    await db.insert(schema.userProfiles).values(userProfilesWithIds);
    console.log("  ✓ Inserted 50 adopter profiles");

    // Generate and insert rehome profiles
    console.log("  Generating 20 rehome profiles...");
    const rehomers = generateFakeRehomers();
    
    // Create rehomer user accounts
    const rehomerUsers = [];
    for (let i = 0; i < 20; i++) {
      rehomerUsers.push({
        id: `rehomer-user-${i + 1}`,
        email: `rehomer${i + 1}@example.com`,
        firstName: `Rehomer`,


  // Seed example plugins
  const stripePlugin = await db.insert(schema.plugins).values({
    name: "Stripe Payments",
    slug: "stripe_payments",
    description: "Accept adoption fees and donations via Stripe",
    category: "payment",
    iconUrl: "https://stripe.com/favicon.ico",
    isOfficial: true,
    isPublic: true,
    configSchema: {
      type: "object",
      properties: {
        apiKey: { type: "string", description: "Stripe Secret Key" },
        webhookSecret: { type: "string", description: "Stripe Webhook Secret" },
      },
      required: ["apiKey"],
    },
    webhookEvents: ["payment.succeeded", "payment.failed"],
    requiredScopes: ["read:adoptions", "write:payments"],
    webhookUrl: "https://api.stripe.com/v1/webhooks",
  }).returning();

  const checkrPlugin = await db.insert(schema.plugins).values({
    name: "Checkr Background Checks",
    slug: "checkr_background",
    description: "Automated background checks for adopters",
    category: "background_check",
    iconUrl: "https://checkr.com/favicon.ico",
    isOfficial: true,
    isPublic: true,
    configSchema: {
      type: "object",
      properties: {
        apiKey: { type: "string", description: "Checkr API Key" },
        packageSlug: { type: "string", description: "Checkr Package Type" },
      },
      required: ["apiKey"],
    },
    webhookEvents: ["report.completed", "report.disputed"],
    requiredScopes: ["read:applications", "write:verifications"],
    webhookUrl: "https://api.checkr.com/v1/webhooks",
  }).returning();

  const twilioPlugin = await db.insert(schema.plugins).values({
    name: "Twilio SMS",
    slug: "twilio_sms",
    description: "Send SMS notifications to adopters",
    category: "communication",
    iconUrl: "https://twilio.com/favicon.ico",
    isOfficial: true,
    isPublic: true,
    configSchema: {
      type: "object",
      properties: {
        accountSid: { type: "string", description: "Twilio Account SID" },
        authToken: { type: "string", description: "Twilio Auth Token" },
        phoneNumber: { type: "string", description: "Your Twilio Phone Number" },
      },
      required: ["accountSid", "authToken", "phoneNumber"],
    },
    webhookEvents: ["message.delivered", "message.failed"],
    requiredScopes: ["read:adopters", "write:notifications"],
  }).returning();

  console.log("✓ Seeded example plugins");

        lastName: `${i + 1}`,
        role: "adopter",
      });
    }
    await db.insert(schema.users).values(rehomerUsers);
    console.log("  ✓ Created 20 rehomer user accounts");
    
    const rehomerProfilesWithIds = rehomers.map((profile, index) => ({
      ...profile,
      id: `rehomer-user-${index + 1}`,
    }));
    await db.insert(schema.userProfiles).values(rehomerProfilesWithIds);
    console.log("  ✓ Inserted 20 rehome profiles");

    // Generate and insert foster profiles
    console.log("  Generating 25 foster profiles...");
    const fosters = generateFakeFosters();
    
    // Create foster user accounts
    const fosterUsers = [];
    for (let i = 0; i < 25; i++) {
      fosterUsers.push({
        id: `foster-user-${i + 1}`,
        email: `foster${i + 1}@example.com`,
        firstName: `Foster`,
        lastName: `${i + 1}`,
        role: "adopter",
      });
    }
    await db.insert(schema.users).values(fosterUsers);
    console.log("  ✓ Created 25 foster user accounts");
    
    const fosterProfilesWithIds = fosters.map((profile, index) => ({
      ...profile,
      id: `foster-user-${index + 1}`,
    }));
    await db.insert(schema.userProfiles).values(fosterProfilesWithIds);
    console.log("  ✓ Inserted 25 foster profiles");

    console.log("\n✅ Database seeded successfully!");
    console.log("📊 Summary:");
    console.log("   • 20 shelters with user accounts");
    console.log("   • 100 dogs (distributed across shelters)");
    console.log("   • 50 adopter profiles with user accounts");
    console.log("   • 20 rehome profiles with user accounts");
    console.log("   • 25 foster profiles with user accounts");
    
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Error seeding database:", error);
  process.exit(1);
});
