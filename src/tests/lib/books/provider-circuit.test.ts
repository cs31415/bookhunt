import { isCircuitOpen, openCircuit, resetCircuits } from '../../../lib/books/provider-circuit';

describe('provider circuit', () => {
  beforeEach(() => {
    resetCircuits();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('starts closed', () => {
    expect(isCircuitOpen('google_books')).toBe(false);
  });

  it('opens when a provider reports it is out of capacity', () => {
    openCircuit('google_books');
    expect(isCircuitOpen('google_books')).toBe(true);
  });

  it('does not affect the other provider', () => {
    openCircuit('google_books');
    expect(isCircuitOpen('open_library')).toBe(false);
  });

  it('closes again after the cooldown', () => {
    jest.useFakeTimers();
    openCircuit('google_books');
    expect(isCircuitOpen('google_books')).toBe(true);

    jest.advanceTimersByTime(61_000);
    expect(isCircuitOpen('google_books')).toBe(false);
  });

  it('warns once rather than on every subsequent failure', () => {
    openCircuit('google_books');
    openCircuit('google_books');
    openCircuit('google_books');

    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
