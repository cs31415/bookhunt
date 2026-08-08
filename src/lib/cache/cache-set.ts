import { getRedis, reportCacheFailure, withTimeout } from './redis-client';
import { logCacheDisabled, logCacheEvent } from './log-cache';

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
  if (!redis) {
    logCacheDisabled();
    return;
  }

  const start = Date.now();
  try {
    // withTimeout resolves to its fallback rather than rejecting, so a timed-out
    // or refused write lands here with `stored === null` and never reaches the
    // catch. Reporting that as a successful set would make a dead cache look
    // like a working one — the exact confusion this logging exists to end.
    // Redis answers 'OK' on a successful SET.
    const stored = await withTimeout(redis.set(key, JSON.stringify(value), 'EX', ttlSeconds), null);
    // The TTL is logged because it is the thing most worth confirming: a key
    // written with the wrong duration looks identical to one written correctly
    // until it expires.
    logCacheEvent(stored === null ? 'set-failed' : 'set', key, start, ttlSeconds);
  } catch (error) {
    reportCacheFailure('set', error);
    logCacheEvent('set-failed', key, start, ttlSeconds);
  }
}
