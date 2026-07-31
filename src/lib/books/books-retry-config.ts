function positiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Attempts for a single provider HTTP request, covering a blip that resolves
 * within a second or so.
 *
 * Deliberately lower than primaryAttempts because the two multiply: a row can
 * make up to httpAttempts x primaryAttempts requests before the fallback is
 * reached. With a genuinely down provider that cost is paid by every row in the
 * import, so the ceiling matters more than the depth.
 */
export function httpAttempts(): number {
  return positiveInt('BOOKS_HTTP_ATTEMPTS', 2);
}

/** Delay between HTTP attempts, multiplied by the attempt number. */
export function httpBackoffMs(): number {
  return positiveInt('BOOKS_HTTP_BACKOFF_MS', 250);
}

/**
 * Attempts against the primary provider before falling back to the secondary.
 *
 * This is the outer loop: each attempt is itself a fully retried HTTP request,
 * so it covers an outage lasting longer than a blip. Worth having because the
 * fallback provider gives materially worse answers — it reports no publisher,
 * does not strictly AND query terms, and is throttled to 1 req/sec — so
 * reaching for it early costs match quality on every row it touches.
 *
 * Only failures are retried. A provider that answers "no results" is believed.
 */
export function primaryAttempts(): number {
  return positiveInt('BOOKS_PRIMARY_ATTEMPTS', 3);
}

/** Delay between primary-provider attempts, multiplied by the attempt number. */
export function primaryBackoffMs(): number {
  return positiveInt('BOOKS_PRIMARY_BACKOFF_MS', 500);
}
