import Redis from 'ioredis';

// Built on first use rather than at import time: dotenv.config() runs in
// index.ts after the import graph resolves, so a module-level const off
// process.env would read undefined. Same shape as getPool() in lib/db.ts.
let _redis: Redis | null = null;
let _resolved = false;

/**
 * Fails fast on purpose. A cache that takes longer than the call it is standing
 * in for is worse than no cache, so a command gets 200ms and one retry before
 * callers treat it as a miss.
 */
export const COMMAND_TIMEOUT_MS = 200;

/**
 * The hard guarantee, independent of whatever ioredis does with reconnects and
 * queued commands: no cache operation delays a request by more than the budget.
 */
export function withTimeout<T>(operation: Promise<T>, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), COMMAND_TIMEOUT_MS);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export function isCacheEnabled(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/**
 * Returns null when REDIS_URL is unset, which is the no-op case: local dev and
 * the whole test suite run with no Redis at all, and every caller already
 * handles a miss.
 */
export function getRedis(): Redis | null {
  if (_resolved) return _redis;
  _resolved = true;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  // Construction is already deferred to the first cache operation by this
  // function, so lazyConnect would only push the connect to the first *command*
  // — which, with no offline queue, made that command fail outright rather than
  // wait. The offline queue is left on so an in-flight connect is waited for
  // instead; withTimeout is what actually bounds the wait.
  _redis = new Redis(url, {
    connectTimeout: COMMAND_TIMEOUT_MS,
    commandTimeout: COMMAND_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
  });

  // Required, and deliberately silent: an unhandled 'error' on the client is a
  // process-level crash, so something must listen. It fires for transient
  // connect churn too, which made it report an outage while the cache was in
  // fact working — the honest signal is an operation that actually failed, and
  // that is reported below.
  _redis.on('error', () => {});

  return _redis;
}

// Sustained outages are one line, not one per request.
let _reported = false;

export function reportCacheFailure(operation: string, error: unknown): void {
  if (_reported) return;
  _reported = true;
  console.warn(
    `[cache] ${operation} failed, serving misses until it recovers:`,
    (error as Error)?.message ?? error,
  );
}

/** Clears the once-per-outage latch, so a later outage is reported again. */
export function reportCacheHealthy(): void {
  _reported = false;
}

/**
 * Test hook; also lets a caller drop the connection on shutdown.
 *
 * disconnect() rather than quit(): quit() sends a QUIT command and so needs a
 * live connection, which hangs for exactly the case this most needs to work —
 * Redis already unreachable. disconnect() tears down the socket and cancels the
 * reconnect timer without talking to anyone.
 */
export function resetRedis(): void {
  _redis?.disconnect();
  _redis = null;
  _resolved = false;
  _reported = false;
}
