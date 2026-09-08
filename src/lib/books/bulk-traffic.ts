import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Marks the work of a bulk job, so provider requests made under it can be paced
 * while interactive ones are not (LOS-395).
 *
 * A CSV import spends hundreds of provider requests and nobody watches it row
 * by row; a search spends one and somebody is waiting for it. Pacing both from
 * one queue would put every search behind a running import — minutes, on a
 * large file. So the import is paced to a rate that leaves the rest of the
 * quota free, and interactive traffic keeps going straight out.
 *
 * Scoped rather than passed as an argument for the reason call-stats-store
 * gives: loggedFetch sits several layers below the route, and threading a flag
 * down would put a quota concern in every signature on the path.
 */
const storage = new AsyncLocalStorage<true>();

/** Runs `fn` with every provider request it makes marked as bulk traffic. */
export function runAsBulkTraffic<T>(fn: () => T): T {
  return storage.run(true, fn);
}

/** False outside a runAsBulkTraffic() scope, which is most of the app. */
export function isBulkTraffic(): boolean {
  return storage.getStore() === true;
}
