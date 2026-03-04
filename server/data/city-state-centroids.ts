/**
 * Static city/state centroid dataset for deterministic geocoding fallback
 * 
 * This provides approximate coordinates for common US cities when
 * Nominatim or other geocoding services fail.
 */

interface Centroid {
  latitude: number;
  longitude: number;
}

// City/State centroids (approximate city centers)
const CITY_STATE_CENTROIDS: Record<string, Centroid> = {
  // Texas
  "austin, tx": { latitude: 30.2672, longitude: -97.7431 },
  "houston, tx": { latitude: 29.7604, longitude: -95.3698 },
  "dallas, tx": { latitude: 32.7767, longitude: -96.7970 },
  "san antonio, tx": { latitude: 29.4241, longitude: -98.4936 },
  
  // California
  "los angeles, ca": { latitude: 34.0522, longitude: -118.2437 },
  "san francisco, ca": { latitude: 37.7749, longitude: -122.4194 },
  "san diego, ca": { latitude: 32.7157, longitude: -117.1611 },
  "sacramento, ca": { latitude: 38.5816, longitude: -121.4944 },
  
  // New York
  "new york, ny": { latitude: 40.7128, longitude: -74.0060 },
  "buffalo, ny": { latitude: 42.8864, longitude: -78.8784 },
  "albany, ny": { latitude: 42.6526, longitude: -73.7562 },
  
  // Florida
  "miami, fl": { latitude: 25.7617, longitude: -80.1918 },
  "orlando, fl": { latitude: 28.5383, longitude: -81.3792 },
  "tampa, fl": { latitude: 27.9506, longitude: -82.4572 },
  "jacksonville, fl": { latitude: 30.3322, longitude: -81.6557 },
  
  // Illinois
  "chicago, il": { latitude: 41.8781, longitude: -87.6298 },
  "springfield, il": { latitude: 39.7817, longitude: -89.6501 },
  
  // Washington
  "seattle, wa": { latitude: 47.6062, longitude: -122.3321 },
  "spokane, wa": { latitude: 47.6588, longitude: -117.4260 },
  
  // Add more as needed...
};

// State centroids as fallback when city is not found
// Covers all 50 US states + DC for guaranteed coverage
const STATE_CENTROIDS: Record<string, Centroid> = {
  "al": { latitude: 32.3182, longitude: -86.9023 }, // Alabama
  "ak": { latitude: 64.2008, longitude: -149.4937 }, // Alaska
  "az": { latitude: 34.0489, longitude: -111.0937 }, // Arizona
  "ar": { latitude: 35.2010, longitude: -91.8318 }, // Arkansas
  "ca": { latitude: 36.7783, longitude: -119.4179 }, // California
  "co": { latitude: 39.5501, longitude: -105.7821 }, // Colorado
  "ct": { latitude: 41.6032, longitude: -73.0877 }, // Connecticut
  "de": { latitude: 38.9108, longitude: -75.5277 }, // Delaware
  "dc": { latitude: 38.9072, longitude: -77.0369 }, // District of Columbia
  "fl": { latitude: 27.6648, longitude: -81.5158 }, // Florida
  "ga": { latitude: 32.1656, longitude: -82.9001 }, // Georgia
  "hi": { latitude: 19.8968, longitude: -155.5828 }, // Hawaii
  "id": { latitude: 44.0682, longitude: -114.7420 }, // Idaho
  "il": { latitude: 40.6331, longitude: -89.3985 }, // Illinois
  "in": { latitude: 40.2672, longitude: -86.1349 }, // Indiana
  "ia": { latitude: 41.8780, longitude: -93.0977 }, // Iowa
  "ks": { latitude: 39.0119, longitude: -98.4842 }, // Kansas
  "ky": { latitude: 37.8393, longitude: -84.2700 }, // Kentucky
  "la": { latitude: 30.9843, longitude: -91.9623 }, // Louisiana
  "me": { latitude: 45.2538, longitude: -69.4455 }, // Maine
  "md": { latitude: 39.0458, longitude: -76.6413 }, // Maryland
  "ma": { latitude: 42.4072, longitude: -71.3824 }, // Massachusetts
  "mi": { latitude: 44.3148, longitude: -85.6024 }, // Michigan
  "mn": { latitude: 46.7296, longitude: -94.6859 }, // Minnesota
  "ms": { latitude: 32.3547, longitude: -89.3985 }, // Mississippi
  "mo": { latitude: 37.9643, longitude: -91.8318 }, // Missouri
  "mt": { latitude: 46.8797, longitude: -110.3626 }, // Montana
  "ne": { latitude: 41.4925, longitude: -99.9018 }, // Nebraska
  "nv": { latitude: 38.8026, longitude: -116.4194 }, // Nevada
  "nh": { latitude: 43.1939, longitude: -71.5724 }, // New Hampshire
  "nj": { latitude: 40.0583, longitude: -74.4057 }, // New Jersey
  "nm": { latitude: 34.5199, longitude: -105.8701 }, // New Mexico
  "ny": { latitude: 43.2994, longitude: -74.2179 }, // New York
  "nc": { latitude: 35.7596, longitude: -79.0193 }, // North Carolina
  "nd": { latitude: 47.5515, longitude: -101.0020 }, // North Dakota
  "oh": { latitude: 40.4173, longitude: -82.9071 }, // Ohio
  "ok": { latitude: 35.4676, longitude: -97.5164 }, // Oklahoma
  "or": { latitude: 43.8041, longitude: -120.5542 }, // Oregon
  "pa": { latitude: 41.2033, longitude: -77.1945 }, // Pennsylvania
  "ri": { latitude: 41.5801, longitude: -71.4774 }, // Rhode Island
  "sc": { latitude: 33.8361, longitude: -81.1637 }, // South Carolina
  "sd": { latitude: 43.9695, longitude: -99.9018 }, // South Dakota
  "tn": { latitude: 35.5175, longitude: -86.5804 }, // Tennessee
  "tx": { latitude: 31.9686, longitude: -99.9018 }, // Texas
  "ut": { latitude: 39.3210, longitude: -111.0937 }, // Utah
  "vt": { latitude: 44.5588, longitude: -72.5778 }, // Vermont
  "va": { latitude: 37.4316, longitude: -78.6569 }, // Virginia
  "wa": { latitude: 47.7511, longitude: -120.7401 }, // Washington
  "wv": { latitude: 38.5976, longitude: -80.4549 }, // West Virginia
  "wi": { latitude: 43.7844, longitude: -88.7879 }, // Wisconsin
  "wy": { latitude: 43.0760, longitude: -107.2903 }, // Wyoming
};

export function lookupCentroid(city: string, state: string): Centroid | null {
  const cityKey = `${city}, ${state}`.toLowerCase().trim();
  
  // Try exact city/state match first
  if (CITY_STATE_CENTROIDS[cityKey]) {
    return CITY_STATE_CENTROIDS[cityKey];
  }
  
  // Fall back to state centroid
  const stateKey = state.toLowerCase().trim();
  if (STATE_CENTROIDS[stateKey]) {
    return STATE_CENTROIDS[stateKey];
  }
  
  return null;
}

// Export dataset for potential expansion
export function getAllCityCentroids(): Record<string, Centroid> {
  return { ...CITY_STATE_CENTROIDS };
}

export function getAllStateCentroids(): Record<string, Centroid> {
  return { ...STATE_CENTROIDS };
}
