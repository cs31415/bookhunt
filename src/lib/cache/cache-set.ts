import { getRedis, reportCacheFailure, withTimeout } from './redis-client';

/**
 * Stores a JSON value under a TTL. Failures are swallowed for the same reason
 * cacheGet treats them as misses: the caller already has the value it was going
 * to return, and losing the chance to cache it is not worth failing a request.
 *
 * Callers decide what is worth storing — in particular, neither an empty LLM
 * answer nor a non-2xx provider response should ever get here, since both would
 * pin a transient failure for the length of the TTL.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await withTimeout(redis.set(key, JSON.stringify(value), 'EX', ttlSeconds), null);
  } catch (error) {
    reportCacheFailure('set', error);
  }
}
