import { runWithCallStats } from '../../../lib/stats/run-with-call-stats';
import { recordProviderCall } from '../../../lib/stats/record-provider-call';
import { recordDbCall } from '../../../lib/stats/record-db-call';
import { formatCallStats } from '../../../lib/stats/format-call-stats';
import { newCallStats } from '../../../lib/stats/call-stats-store';

function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('call stats', () => {
  it('records nothing, and throws nothing, outside a scope', () => {
    expect(() => {
      recordProviderCall('google_books');
      recordDbCall(5);
    }).not.toThrow();
  });

  it('counts provider calls per provider and db calls with their row counts', async () => {
    const { stats, result } = runWithCallStats(async () => {
      recordProviderCall('google_books');
      recordProviderCall('google_books');
      recordProviderCall('open_library');
      recordDbCall(5);
      recordDbCall(0);
      return 'done';
    });

    await expect(result).resolves.toBe('done');
    expect(stats.providerCalls.get('google_books')).toBe(2);
    expect(stats.providerCalls.get('open_library')).toBe(1);
    expect(stats.dbRowCounts).toEqual([5, 0]);
  });

  it('survives async boundaries, which is the whole point of the scope', async () => {
    const { stats, result } = runWithCallStats(async () => {
      await tick();
      recordDbCall(3);
      await Promise.all([tick().then(() => recordProviderCall('google_books')), tick()]);
    });

    await result;
    expect(stats.dbRowCounts).toEqual([3]);
    expect(stats.providerCalls.get('google_books')).toBe(1);
  });

  it('keeps concurrent scopes from tallying into each other', async () => {
    const one = runWithCallStats(async () => {
      recordProviderCall('google_books');
      await tick(10);
      recordDbCall(1);
    });
    const two = runWithCallStats(async () => {
      await tick(5);
      recordProviderCall('open_library');
      recordDbCall(2);
    });

    await Promise.all([one.result, two.result]);

    expect(one.stats.providerCalls.get('open_library')).toBeUndefined();
    expect(one.stats.dbRowCounts).toEqual([1]);
    expect(two.stats.providerCalls.get('google_books')).toBeUndefined();
    expect(two.stats.dbRowCounts).toEqual([2]);
  });

  it('reports what was spent even when the scope rejects', async () => {
    const { stats, result } = runWithCallStats(async () => {
      recordProviderCall('google_books');
      recordDbCall(4);
      throw new Error('provider exploded');
    });

    await expect(result).rejects.toThrow('provider exploded');
    expect(stats.providerCalls.get('google_books')).toBe(1);
    expect(stats.dbRowCounts).toEqual([4]);
  });

  describe('formatCallStats', () => {
    it('summarises providers, db calls, and per-call row counts', () => {
      const stats = newCallStats();
      stats.providerCalls.set('google_books', 37);
      stats.providerCalls.set('open_library', 4);
      stats.dbRowCounts.push(5, 5, 0, 3);

      expect(formatCallStats('import', stats, 40)).toBe(
        '[import] rows=40 google_books=37 open_library=4 db=4 calls, 13 rows [5,5,0,3]',
      );
    });

    it('reports zero for providers that were never called', () => {
      expect(formatCallStats('import', newCallStats(), 2)).toBe(
        '[import] rows=2 google_books=0 open_library=0 db=0 calls, 0 rows []',
      );
    });

    it('omits the row count when there is none to report', () => {
      expect(formatCallStats('import', newCallStats())).toBe(
        '[import] google_books=0 open_library=0 db=0 calls, 0 rows []',
      );
    });
  });
});
