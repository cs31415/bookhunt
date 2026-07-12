export const OPENLIBRARY_API_URL = process.env.OPENLIBRARY_API_URL || 'https://openlibrary.org';
export const OPENLIBRARY_COVERS_URL = process.env.OPENLIBRARY_COVERS_URL || 'https://covers.openlibrary.org';

let lastCallTime = 0;
let queue: Promise<void> = Promise.resolve();

/**
 * Callers may run concurrently (e.g. a batch resolved via Promise.all), so the
 * wait/update below is chained onto a shared queue rather than executed
 * independently per call — otherwise concurrent callers would all read the
 * same stale lastCallTime before any of them updated it, letting multiple
 * requests through within the same window.
 */
export function throttleOpenLibrary(): Promise<void> {
  const turn = queue.then(async () => {
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < 1000) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000 - elapsed));
    }
    lastCallTime = Date.now();
  });
  queue = turn.catch(() => {});
  return turn;
}

export function resetRateLimiter(): void {
  lastCallTime = 0;
  queue = Promise.resolve();
}
