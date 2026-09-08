import { pace, resetPacers } from '../../../lib/books/provider-pacer';

/**
 * Timers are faked so the suite does not spend real seconds waiting, and each
 * pending wait is advanced explicitly — which is also how the ordering below is
 * observed at all.
 */
describe('pace', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetPacers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /** Runs the microtask queue so a resolved promise records its order. */
  const flush = () => Promise.resolve().then(() => Promise.resolve());

  it('lets the first call through without waiting', async () => {
    const done = jest.fn();
    pace('google_books', 1000).then(done);

    await flush();

    expect(done).toHaveBeenCalled();
  });

  it('holds the next call for the interval', async () => {
    await pace('google_books', 1000);

    const done = jest.fn();
    pace('google_books', 1000).then(done);
    await flush();
    expect(done).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    await flush();
    expect(done).toHaveBeenCalled();
  });

  /**
   * The reason the waits are chained rather than taken independently: eight
   * import workers ask at once, and without a shared queue every one of them
   * reads the same stale timestamp and goes out inside one window.
   */
  it('serialises concurrent callers instead of releasing them together', async () => {
    const released: number[] = [];
    for (let i = 0; i < 4; i++) pace('google_books', 1000).then(() => released.push(i));

    await flush();
    expect(released).toEqual([0]);

    jest.advanceTimersByTime(1000);
    await flush();
    expect(released).toEqual([0, 1]);

    jest.advanceTimersByTime(1000);
    await flush();
    expect(released).toEqual([0, 1, 2]);
  });

  it('paces each provider on its own clock', async () => {
    await pace('google_books', 1000);

    const done = jest.fn();
    pace('open_library', 1000).then(done);
    await flush();

    expect(done).toHaveBeenCalled();
  });
});
