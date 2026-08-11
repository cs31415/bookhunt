/**
 * Catalog/provider lookups in flight at once while resolving imported rows.
 *
 * Bounded so a large CSV cannot fan out into an unbounded burst of provider
 * calls; the per-request row cap in the import route depends on this ceiling to
 * keep the server-side cost of a request predictable.
 */
export const RESOLUTION_CONCURRENCY = 8;
