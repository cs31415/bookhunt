import { BooksProvider } from './books-types';

/**
 * Stops hammering a provider that has told us it is out of capacity.
 *
 * Google Books' free tier is 1,000 queries a day, and a large CSV import can
 * spend all of it. Once exhausted it answers 429 to everything, and without
 * this each row would still burn its full retry budget — six futile requests
 * apiece, plus backoff, for an answer that cannot change.
 *
 * Deliberately coarse: any 429 opens the circuit. A burst limit and a spent
 * daily quota are indistinguishable without parsing Google's prose, and the
 * right response to both is the same — back off entirely and use the fallback
 * provider for a while.
 */

const COOLDOWN_MS = 60_000;

const openedAt = new Map<BooksProvider, number>();

/** Whether the provider is currently being skipped. */
export function isCircuitOpen(provider: BooksProvider): boolean {
  const opened = openedAt.get(provider);
  if (opened === undefined) return false;
  if (Date.now() - opened < COOLDOWN_MS) return true;
  openedAt.delete(provider);
  return false;
}

/** Called when a provider reports it is out of capacity. */
export function openCircuit(provider: BooksProvider): void {
  if (!isCircuitOpen(provider)) {
    console.warn(
      `[books:${provider}] out of capacity; skipping it for ${COOLDOWN_MS / 1000}s and using the fallback`,
    );
  }
  openedAt.set(provider, Date.now());
}

/** Test-only: forget any open circuits between cases. */
export function resetCircuits(): void {
  openedAt.clear();
}
