import { BooksProvider } from './books-types';

/**
 * Spaces out requests to one provider, so a bulk job asks at a rate the
 * provider accepts rather than as fast as the network allows.
 *
 * Concurrency limits do not do this job. RESOLUTION_CONCURRENCY bounds requests
 * in flight, and eight in flight against a provider answering in 200ms is over
 * 2,000 requests a minute — which is how a 372-row import spent one 429 and
 * then skipped 148 rows behind an open circuit (LOS-395).
 *
 * The circuit breaker is the shock absorber; this is the budget.
 */

const lastCallAt = new Map<BooksProvider, number>();
const queues = new Map<BooksProvider, Promise<void>>();

/**
 * Resolves when the caller may issue its request, at least `intervalMs` after
 * the previous one to the same provider.
 *
 * Callers run concurrently, so the wait/update below is chained onto a queue
 * shared per provider rather than executed independently per call — otherwise
 * concurrent callers would all read the same stale timestamp before any of them
 * updated it, letting the whole batch through inside one window.
 */
export function pace(provider: BooksProvider, intervalMs: number): Promise<void> {
  const turn = (queues.get(provider) ?? Promise.resolve()).then(async () => {
    const elapsed = Date.now() - (lastCallAt.get(provider) ?? 0);
    if (elapsed < intervalMs) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs - elapsed));
    }
    lastCallAt.set(provider, Date.now());
  });
  queues.set(
    provider,
    turn.catch(() => {}),
  );
  return turn;
}

/** Test-only: forget every provider's queue and last call. */
export function resetPacers(): void {
  lastCallAt.clear();
  queues.clear();
}
