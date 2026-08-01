import { AsyncLocalStorage } from 'node:async_hooks';
import { BooksProvider } from '../books/books-types';

/** Tally of the external work one request performed. */
export interface CallStats {
  /** HTTP requests issued per provider, retries included. */
  providerCalls: Map<BooksProvider, number>;
  /** Rows returned by each database query, in the order the queries completed. */
  dbRowCounts: number[];
}

/**
 * Counters are request-scoped rather than threaded through arguments: the
 * places worth counting (loggedFetch, the pool proxy) sit several layers below
 * the route, and passing a tally down to them would put a logging concern in
 * every signature on the path. AsyncLocalStorage also keeps concurrent requests
 * from tallying into each other, which a module-level counter would not.
 */
const storage = new AsyncLocalStorage<CallStats>();

export function newCallStats(): CallStats {
  return { providerCalls: new Map(), dbRowCounts: [] };
}

/** Undefined outside a runWithCallStats() scope, which is most of the app. */
export function currentCallStats(): CallStats | undefined {
  return storage.getStore();
}

export function runInCallStatsScope<T>(stats: CallStats, fn: () => T): T {
  return storage.run(stats, fn);
}
