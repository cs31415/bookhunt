import { CallStats, newCallStats, runInCallStatsScope } from './call-stats-store';

/**
 * Runs `fn` with a fresh set of counters and hands them back alongside its
 * result. The stats object is the same one the recorders write into, so a
 * caller that catches a rejection can still read what was spent before the
 * failure — hold onto it rather than reading it only on the happy path.
 */
export function runWithCallStats<T>(fn: () => Promise<T>): {
  stats: CallStats;
  result: Promise<T>;
} {
  const stats = newCallStats();
  return { stats, result: runInCallStatsScope(stats, fn) };
}
