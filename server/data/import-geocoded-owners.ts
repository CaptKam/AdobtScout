/**
 * Import Geocoded Owners Script: Create user_profiles from geocoded remediation data
 * 
 * This script reads the owner-remediation-geocoded.csv file (after manual geocoding)
 * and creates user_profiles entries for owner-only accounts with verified coordinates.
 * 
 * Prerequisites:
 * 1. Run migrate-owner-profiles.ts first
 * 2. Geocode the addresses in owner-remediation.csv
 * 3. Save as owner-remediation-geocoded.csv with latitude/longitude filled
 * 
 * Usage: npm run tsx server/data/import-geocoded-owners.ts
 */

import { db } from "../db";
import { userProfiles } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

interface GeocodedOwner {
  userId: string;
  fullName: string;
  phone: string;
  reason: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

async function importGeocodedOwners() {
  console.log("Starting geocoded owners import...\n");

  const csvPath = 'owner-remediation-geocoded.csv';
  
  // Check if file exists
  if (!fs.existsSync(csvPath)) {
    console.error(`✗ File not found: ${csvPath}`);
    console.log("\nMake sure you:");
    console.log("  1. Ran migrate-owner-profiles.ts to generate owner-remediation.csv");
    console.log("  2. Geocoded the addresses and filled in latitude/longitude");
    console.log("  3. Saved the file as owner-remediation-geocoded.csv");
    process.exit(1);
  }

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const results: Array<{userId: string, fullName: string, action: string, reason?: string}> = [];

  try {
    // Read and parse CSV
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      console.error("✗ CSV file is empty or has no data rows");
      process.exit(1);
    }

    // Parse CSV (skip header)
    const dataLines = lines.slice(1);
    console.log(`Found ${dataLines.length} records to process\n`);

    for (const line of dataLines) {
      // Basic CSV parsing (handles quoted fields)
      const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
      if (!matches || matches.length < 8) {
        console.log(`⚠ Skipping malformed line: ${line.substring(0, 50)}...`);
        skippedCount++;
        continue;
      }

      const [userId, fullName, phone, reason, city, state, latStr, lonStr] = matches.map(
        field => field.replace(/^"(.*)"$/, '$1').trim()
      );

      const latitude = parseFloat(latStr);
      const longitude = parseFloat(lonStr);

      // Validate required fields
      if (!userId || !fullName || !phone || !city || !state) {
        console.log(`⚠ Skipping ${fullName || 'unknown'} - missing required fields`);
        results.push({ userId, fullName, action: 'skipped', reason: 'Missing required fields' });
        skippedCount++;
        continue;
      }

      // Validate coordinates
      if (isNaN(latitude) || isNaN(longitude)) {
        console.log(`⚠ Skipping ${fullName} - invalid coordinates: ${latStr}, ${lonStr}`);
        results.push({ userId, fullName, action: 'skipped', reason: 'Invalid coordinates' });
        skippedCount++;
        continue;
      }

      try {
        // Check if profile already exists
        const existing = await db.query.userProfiles.findFirst({
          where: (userProfiles, { eq }) => eq(userProfiles.userId, userId)
        });

        if (existing) {
          console.log(`⚠ Skipping ${fullName} - profile already exists`);
          results.push({ userId, fullName, action: 'skipped', reason: 'Profile already exists' });
          skippedCount++;
          continue;
        }

        // Create new user profile with rehome mode
        await db.insert(userProfiles).values({
          userId,
          mode: 'rehome',
          phoneNumber: phone,
          reasonForRehoming: reason,
          city,
          state,
          latitude,
          longitude,
          searchRadius: 25,
          // Omit adopter lifestyle fields - let database defaults apply
        });

        console.log(`✓ Created profile for ${fullName} (${city}, ${state})`);
        results.push({ userId, fullName, action: 'created' });
        createdCount++;
      } catch (error: any) {
        console.error(`✗ Error creating profile for ${fullName}:`, error.message);
        results.push({ userId, fullName, action: 'error', reason: error.message });
        errorCount++;
      }
    }

    // Write audit log
    const auditLog = {
      timestamp: new Date().toISOString(),
      summary: {
        total: dataLines.length,
        created: createdCount,
        skipped: skippedCount,
        errors: errorCount,
      },
      results,
    };

    fs.writeFileSync(
      'import-geocoded-audit.json',
      JSON.stringify(auditLog, null, 2)
    );

    console.log("\n" + "=".repeat(50));
    console.log("Import Summary:");
    console.log("=".repeat(50));
    console.log(`  Total records: ${dataLines.length}`);
    console.log(`  ✓ Created profiles: ${createdCount}`);
    console.log(`  ⚠ Skipped: ${skippedCount}`);
    console.log(`  ✗ Errors: ${errorCount}`);
    console.log("=".repeat(50));
    console.log(`\nDetailed audit log saved to: import-geocoded-audit.json`);

    if (createdCount > 0) {
      console.log("\n✅ Import completed successfully!");
      console.log("📝 Note: All new profiles created with mode='rehome'");
      console.log("📝 Note: You can now verify the profiles in the database");
    }

    if (errorCount > 0) {
      console.log("\n⚠ Some errors occurred during import.");
      console.log("  See import-geocoded-audit.json for details.");
    }

  } catch (error: any) {
    console.error("\n✗ Import failed:", error);
    process.exit(1);
  }
}

// Run import
importGeocodedOwners()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
