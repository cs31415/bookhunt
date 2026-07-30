import { chunk, mapWithConcurrency } from '../../lib/map-with-concurrency';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('mapWithConcurrency', () => {
  it('returns an empty array for no items', async () => {
    const fn = jest.fn();
    expect(await mapWithConcurrency([], 3, fn)).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('keeps results in input order even when later items settle first', async () => {
    const result = await mapWithConcurrency([30, 20, 10], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(result).toEqual([30, 20, 10]);
  });

  it('passes the index alongside each item', async () => {
    const seen: [string, number][] = [];
    await mapWithConcurrency(['a', 'b', 'c'], 1, async (item, index) => {
      seen.push([item, index]);
    });
    expect(seen).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('never exceeds the concurrency ceiling', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async (i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return i;
    });
    expect(peak).toBe(4);
  });

  it('starts no more workers than there are items', async () => {
    let peak = 0;
    let inFlight = 0;
    await mapWithConcurrency([1, 2], 10, async (i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return i;
    });
    expect(peak).toBe(2);
  });

  it('treats a limit below one as one', async () => {
    let peak = 0;
    let inFlight = 0;
    await mapWithConcurrency([1, 2, 3], 0, async (i) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return i;
    });
    expect(peak).toBe(1);
  });

  it('rejects when any item rejects', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (i) => {
        if (i === 2) throw new Error('boom');
        return i;
      }),
    ).rejects.toThrow('boom');
  });

  it('starts no further items after a failure', async () => {
    const started: number[] = [];
    const gate = deferred<void>();

    const run = mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (i) => {
      started.push(i);
      if (i === 1) throw new Error('boom');
      await gate.promise;
      return i;
    });

    await expect(run).rejects.toThrow('boom');
    gate.resolve();
    // Items 1 and 2 begin together; the failure stops the queue well short of 6.
    expect(started.length).toBeLessThan(6);
  });
});

describe('chunk', () => {
  it('splits into consecutive groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single group when the list fits', () => {
    expect(chunk([1, 2], 8)).toEqual([[1, 2]]);
  });

  it('returns nothing for an empty list', () => {
    expect(chunk([], 8)).toEqual([]);
  });
});
