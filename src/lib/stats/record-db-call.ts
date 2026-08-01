import { currentCallStats } from './call-stats-store';

/** Counts one database query and what it returned. No-op outside a scope. */
export function recordDbCall(rowCount: number): void {
  currentCallStats()?.dbRowCounts.push(rowCount);
}
