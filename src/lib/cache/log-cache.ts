import { isCallStatsScopeActive } from '../stats/call-stats-store';
import { isCacheLoggingEnabled } from './is-cache-logging-enabled';

type CacheOutcome = 'hit' | 'miss' | 'set' | 'set-failed';

/**
 * Every failure mode of this cache is deliberately shaped like a miss — no
 * REDIS_URL, Redis down, a command over the 200ms budget, a value that no longer
 * parses. That keeps the cache from ever failing a request, at the cost of
 * making a dead cache indistinguishable from a cold one. These logs are the only
 * way to tell them apart.
 */

// Once per process, not per call: with no REDIS_URL every operation reports the
// same thing, and a line per request would bury the one fact that matters.
let _disabledReported = false;

export function logCacheDisabled(): void {
  if (_disabledReported || !isCacheLoggingEnabled()) return;
  _disabledReported = true;
  console.log('[cache] disabled: REDIS_URL is unset, every read is a miss');
}

/**
 * Logs the key, never the value. Keys are already namespaced and hashed
 * (`ai:search:v2:<sha256>`), so the namespace identifies the consumer while the
 * query itself stays out of the log.
 */
export function logCacheEvent(
  outcome: CacheOutcome,
  key: string,
  startedAt: number,
  ttlSeconds?: number,
): void {
  // Suppressed inside a stats scope for the same reason logged-fetch.ts
  // suppresses provider logging: that request reports its own totals, and a line
  // per cache operation would bury them.
  if (!isCacheLoggingEnabled() || isCallStatsScopeActive()) return;
  const ttl = ttlSeconds === undefined ? '' : ` ttl=${ttlSeconds}s`;
  console.log(`[cache] ${outcome} ${key}${ttl}, ${Date.now() - startedAt}ms`);
}

/** Test hook; also re-arms the once-per-process disabled notice. */
export function resetCacheLogging(): void {
  _disabledReported = false;
}
