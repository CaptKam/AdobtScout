/**
 * Geocoding utility with deterministic fallback
 * 
 * Uses a tiered approach:
 * 1. Primary: OpenStreetMap Nominatim (accurate, real-time)
 * 2. Fallback: Static city/state centroids (approximate but deterministic)
 * 
 * Features:
 * - Rate limiting (1 request per second for Nominatim)
 * - Caching by city/state
 * - Retry logic with exponential backoff
 * - Guaranteed coordinates via fallback dataset
 */

import { lookupCentroid } from "./city-state-centroids";

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

interface CacheEntry {
  result: GeocodeResult;
  timestamp: number;
}

// Simple in-memory cache (city/state -> coordinates)
const geocodeCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting: 1 request per second for Nominatim
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function geocode(city: string, state: string, maxRetries: number = 3): Promise<GeocodeResult | null> {
  const cacheKey = `${city}, ${state}`.toLowerCase();
  
  // Check cache
  const cached = geocodeCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`    [Cache hit] ${city}, ${state}`);
    return cached.result;
  }

  let lastError: Error | null = null;
  
  // Retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        await sleep(waitTime);
      }

      // Nominatim API request
      const query = encodeURIComponent(`${city}, ${state}, USA`);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
      
      console.log(`    [Geocoding] ${city}, ${state} (attempt ${attempt}/${maxRetries})...`);
      lastRequestTime = Date.now();

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Scout-Dog-Adoption-Platform/1.0' // Required by Nominatim
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim returned ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || data.length === 0) {
        // Not found in Nominatim - break out of retry loop to try fallback
        console.log(`    [Info] No Nominatim results for ${city}, ${state} - will try fallback`);
        break;
      }

      const result: GeocodeResult = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon)
      };

      // Validate coordinates
      if (isNaN(result.latitude) || isNaN(result.longitude)) {
        throw new Error('Invalid coordinates returned');
      }

      // Cache the result
      geocodeCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      console.log(`    [Success] ${city}, ${state} → (${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)})`);
      return result;

    } catch (error: any) {
      lastError = error;
      console.error(`    [Error] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const backoffTime = Math.pow(2, attempt) * 1000;
        console.log(`    [Retry] Waiting ${backoffTime}ms before retry...`);
        await sleep(backoffTime);
      }
    }
  }

  // All Nominatim attempts failed - try static fallback
  console.log(`    [Fallback] All ${maxRetries} Nominatim attempts failed, checking static centroids...`);
  
  const fallback = lookupCentroid(city, state);
  if (fallback) {
    console.log(`    [Fallback Success] Using approximate centroid for ${city}, ${state} → (${fallback.latitude.toFixed(4)}, ${fallback.longitude.toFixed(4)})`);
    
    // Cache the fallback result
    geocodeCache.set(cacheKey, {
      result: fallback,
      timestamp: Date.now()
    });
    
    return fallback;
  }
  
  console.error(`    [Failed] No centroid found for ${city}, ${state} - cannot geocode`);
  return null;
}

// Export cache stats for monitoring
export function getCacheStats() {
  return {
    size: geocodeCache.size,
    entries: Array.from(geocodeCache.keys())
  };
}
