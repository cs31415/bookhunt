import { getRedis, reportCacheFailure, reportCacheHealthy, withTimeout } from './redis-client';

/**
 * Reads a JSON value from the cache, or null for anything that is not a clean
 * hit — no Redis configured, Redis down, a timeout, or a value that no longer
 * parses because its shape changed.
 *
 * Every failure is a miss on purpose. The cache stands in front of an LLM call
 * and a books provider, both of which the caller can still make; a cache error
 * that surfaced as a request error would make the API less reliable than it was
 * before the cache existed.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const raw = await withTimeout(redis.get(key), null);
    reportCacheHealthy();
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    reportCacheFailure('get', error);
    return null;
  }
}
