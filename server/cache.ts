interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }

  set<T>(key: string, data: T, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const cache = new InMemoryCache();

export const CACHE_KEYS = {
  ALL_DOGS: 'dogs:all',
  DOGS_BY_USER: (userId: string) => `dogs:user:${userId}`,
  USER_PROFILE: (userId: string) => `profile:${userId}`,
  SHELTER_PROFILE: (userId: string) => `shelter:${userId}`,
  COMPATIBILITY: (userId: string, dogId: string) => `compat:${userId}:${dogId}`,
  DISCOVER_DOGS: (userId: string) => `discover:${userId}`,
};

export const CACHE_TTL = {
  SHORT: 30 * 1000,       // 30 seconds
  MEDIUM: 2 * 60 * 1000,  // 2 minutes
  LONG: 5 * 60 * 1000,    // 5 minutes
  VERY_LONG: 15 * 60 * 1000, // 15 minutes
};
