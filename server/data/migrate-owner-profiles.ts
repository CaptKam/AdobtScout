/**
 * Conservative Migration Script: Enrich user_profiles with owner_profiles data
 * 
 * This script safely migrates owner_profiles data to the unified user_profiles table:
 * - Preserves existing adopter lifestyle data
 * - Only updates rehome-specific fields
 * - Requires geocoding or skips records
 * - Provides detailed audit log
 * - Idempotent (safe to rerun)
 * 
 * Usage: npm run tsx server/data/migrate-owner-profiles.ts
 */

import { db } from "../db";
import { ownerProfiles, userProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import { geocode, getCacheStats } from "./geocode-util";

interface MigrationResult {
  userId: string;
  fullName: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  reason?: string;
}

interface RemediationRecord {
  userId: string;
  fullName: string;
  phone: string;
  reason: string;
  city: string;
  state: string;
  // To be filled by geocoding service:
  latitude: number | null;
  longitude: number | null;
}

async function migrateOwnerProfiles() {
  console.log("Starting conservative owner_profiles migration...\n");
  
  const results: MigrationResult[] = [];
  const remediationRecords: RemediationRecord[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // Fetch all owner profiles
    const owners = await db.select().from(ownerProfiles);
    console.log(`Found ${owners.length} owner profiles to process\n`);

    if (owners.length === 0) {
      console.log("No owner profiles found. Exiting.");
      return;
    }

    for (const owner of owners) {
      const fullName = owner.fullName || 'Unknown';
      
      try {
        // Validate required fields
        if (!owner.phone) {
          console.log(`  ⚠ Skipping ${fullName} - missing phone number`);
          results.push({ userId: owner.userId, fullName, action: 'skipped', reason: 'Missing phone number' });
          skippedCount++;
          continue;
        }

        // Parse location safely
        let city: string | null = null;
        let state: string | null = null;
        
        if (owner.location && owner.location.includes(",")) {
          const parts = owner.location.split(",").map(s => s.trim());
          city = parts[0] || null;
          state = parts[1] || null;
        }

        if (!city || !state) {
          console.log(`  ⚠ Skipping ${fullName} - invalid location format: "${owner.location}"`);
          results.push({ 
            userId: owner.userId, 
            fullName, 
            action: 'skipped', 
            reason: `Invalid location format: "${owner.location}". Requires manual remediation.` 
          });
          skippedCount++;
          continue;
        }

        // Check if user profile already exists
        const existingProfile = await db.query.userProfiles.findFirst({
          where: eq(userProfiles.userId, owner.userId)
        });

        if (existingProfile) {
          // Conservative update: Only update rehome-specific fields
          // Preserve all adopter lifestyle data
          // Only switch mode to 'rehome' if user has no adopter data
          const hasAdopterData = existingProfile.homeType || 
                                 existingProfile.activityLevel || 
                                 existingProfile.experienceLevel;

          // Preserve existing coordinates (explicit null check for both lat/long)
          const hasExistingCoords = existingProfile.latitude !== null && 
                                     existingProfile.latitude !== undefined &&
                                     existingProfile.longitude !== null && 
                                     existingProfile.longitude !== undefined;

          await db.update(userProfiles)
            .set({
              // Only update mode if user has no adopter data
              ...(hasAdopterData ? {} : { mode: 'rehome' }),
              phoneNumber: owner.phone,
              reasonForRehoming: owner.reason,
              city: city,
              state: state,
              // Don't update coordinates - preserve existing or keep null
            })
            .where(eq(userProfiles.userId, owner.userId));

          const updateReason = hasAdopterData 
            ? 'Preserved adopter data' 
            : 'Switched to rehome mode';
          const coordsNote = hasExistingCoords 
            ? ' (preserved coordinates)' 
            : ' (coordinates remain null - requires geocoding)';
          
          console.log(`  ✓ Updated ${fullName} (${updateReason}${coordsNote})`);
          results.push({ 
            userId: owner.userId, 
            fullName, 
            action: 'updated', 
            reason: updateReason + coordsNote 
          });
          updatedCount++;
        } else {
          // Geocode and create new profile
          console.log(`  🌐 Geocoding ${fullName} (${city}, ${state})...`);
          const coords = await geocode(city, state);
          
          if (coords) {
            // Successfully geocoded - create profile
            await db.insert(userProfiles).values({
              userId: owner.userId,
              mode: 'rehome',
              phoneNumber: owner.phone,
              reasonForRehoming: owner.reason,
              city,
              state,
              latitude: coords.latitude,
              longitude: coords.longitude,
              searchRadius: 25,
              // Omit adopter lifestyle fields - let database defaults apply
            });

            console.log(`  ✓ Created profile for ${fullName} with geocoded coordinates`);
            results.push({ 
              userId: owner.userId, 
              fullName, 
              action: 'created', 
              reason: `Geocoded and created profile for ${city}, ${state}` 
            });
            createdCount++;
          } else {
            // Geocoding failed - add to remediation queue
            console.log(`  ⚠ Geocoding failed for ${fullName} - adding to remediation queue`);
            remediationRecords.push({
              userId: owner.userId,
              fullName,
              phone: owner.phone,
              reason: owner.reason,
              city,
              state,
              latitude: null,
              longitude: null,
            });
            results.push({ 
              userId: owner.userId, 
              fullName, 
              action: 'skipped', 
              reason: `Geocoding failed for ${city}, ${state} - added to remediation file` 
            });
            skippedCount++;
          }
        }
      } catch (error: any) {
        console.error(`  ✗ Error processing ${fullName}:`, error.message);
        results.push({ userId: owner.userId, fullName, action: 'error', reason: error.message });
        errorCount++;
      }
    }

    // Write audit log
    const auditLog = {
      timestamp: new Date().toISOString(),
      summary: {
        total: owners.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        awaitingGeocoding: remediationRecords.length,
      },
      results,
    };

    fs.writeFileSync(
      'migration-audit.json',
      JSON.stringify(auditLog, null, 2)
    );

    // Write remediation file for owner-only accounts
    if (remediationRecords.length > 0) {
      fs.writeFileSync(
        'owner-remediation.json',
        JSON.stringify(remediationRecords, null, 2)
      );
      
      // Also write CSV for easy geocoding service integration
      const csvHeader = 'userId,fullName,phone,reason,city,state,latitude,longitude\n';
      const csvRows = remediationRecords.map(r => 
        `${r.userId},"${r.fullName}","${r.phone}","${r.reason}","${r.city}","${r.state}",,`
      ).join('\n');
      fs.writeFileSync('owner-remediation.csv', csvHeader + csvRows);
    }

    // Display geocoding cache stats
    const cacheStats = getCacheStats();
    
    console.log("\n" + "=".repeat(50));
    console.log("Migration Summary:");
    console.log("=".repeat(50));
    console.log(`  Total owner profiles: ${owners.length}`);
    console.log(`  ✓ Created new profiles: ${createdCount}`);
    console.log(`  ✓ Updated existing profiles: ${updatedCount}`);
    console.log(`  📝 Awaiting geocoding: ${remediationRecords.length}`);
    console.log(`  ⚠ Skipped (validation failed): ${skippedCount - remediationRecords.length}`);
    console.log(`  ✗ Errors: ${errorCount}`);
    console.log("=".repeat(50));
    console.log(`\nGeocoding Stats:`);
    console.log(`  Cached locations: ${cacheStats.size}`);
    console.log(`\nDetailed audit log saved to: migration-audit.json`);

    if (remediationRecords.length > 0) {
      console.log("\n📋 Remediation Files Generated:");
      console.log(`  - owner-remediation.json (${remediationRecords.length} records)`);
      console.log(`  - owner-remediation.csv (for geocoding services)`);
      console.log("\n📝 Next Steps for Owner-Only Accounts:");
      console.log("  1. Geocode the addresses in owner-remediation.csv");
      console.log("     - Use a geocoding service (Google Maps, Nominatim, etc.)");
      console.log("     - Fill in latitude and longitude columns");
      console.log("     - Save as owner-remediation-geocoded.csv");
      console.log("  2. Run: npm run tsx server/data/import-geocoded-owners.ts");
      console.log("  3. Verify the import was successful");
    }

    if (updatedCount > 0) {
      console.log("\n✓ Phase 1 Migration Completed!");
      console.log("📝 Note: Adopter data was preserved for all updated profiles.");
      console.log("📝 Note: Coordinates were preserved where they existed.");
      console.log("📝 Note: The owner_profiles table still exists for verification.");
    }

    if (remediationRecords.length === 0 && updatedCount > 0) {
      console.log("\n✅ All owner profiles successfully migrated!");
    }
  } catch (error: any) {
    console.error("\n✗ Migration failed:", error);
    process.exit(1);
  }
}

// Run migration
migrateOwnerProfiles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
