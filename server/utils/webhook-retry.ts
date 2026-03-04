const RETRY_INTERVALS_MS = [
  60 * 1000,        // 1 minute
  5 * 60 * 1000,    // 5 minutes
  15 * 60 * 1000,   // 15 minutes
  60 * 60 * 1000,   // 1 hour
  4 * 60 * 60 * 1000, // 4 hours
];

const MAX_RETRIES = 5;

export function calculateNextRetryTime(retryCount: number): Date | null {
  if (retryCount >= MAX_RETRIES) {
    return null;
  }
  
  const intervalMs = RETRY_INTERVALS_MS[Math.min(retryCount, RETRY_INTERVALS_MS.length - 1)];
  const jitter = Math.random() * 0.1 * intervalMs;
  
  return new Date(Date.now() + intervalMs + jitter);
}

export function shouldRetry(retryCount: number): boolean {
  return retryCount < MAX_RETRIES;
}

export function getMaxRetries(): number {
  return MAX_RETRIES;
}

export function getRetryIntervalDescription(retryCount: number): string {
  if (retryCount >= MAX_RETRIES) {
    return 'Max retries reached';
  }
  
  const intervals = ['1 minute', '5 minutes', '15 minutes', '1 hour', '4 hours'];
  return intervals[Math.min(retryCount, intervals.length - 1)];
}
