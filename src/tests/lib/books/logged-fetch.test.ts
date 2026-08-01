import { loggedFetch } from '../../../lib/books/logged-fetch';
import { httpAttempts } from '../../../lib/books/books-retry-config';
import { runWithCallStats } from '../../../lib/stats/run-with-call-stats';

// Derived, so tuning the default doesn't break tests describing the behaviour.
const ATTEMPTS = httpAttempts();

function mockFetch(handler: (attempt: number) => any) {
  let attempt = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    attempt += 1;
    return handler(attempt);
  }) as any;
}

describe('loggedFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('identifies itself with a User-Agent', async () => {
    mockFetch(() => Promise.resolve({ ok: true, status: 200 }));

    await loggedFetch('google_books', 'https://example.test/');

    expect((global.fetch as jest.Mock).mock.calls[0][1].headers['User-Agent']).toContain('bookhunt');
  });

  it('returns a successful response without retrying', async () => {
    mockFetch(() => Promise.resolve({ ok: true, status: 200 }));

    const response = await loggedFetch('google_books', 'https://example.test/');

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // Google Books returns intermittent 503s under bursts. One of them silently
  // demoted a lookup to the fallback provider and produced a visibly worse match
  // for a book Google had all along.
  it.each([429, 500, 502, 503, 504])('retries a %i and returns the eventual success', async (status) => {
    mockFetch((attempt) =>
      Promise.resolve(attempt === 1 ? { ok: false, status } : { ok: true, status: 200 }),
    );

    const response = await loggedFetch('google_books', 'https://example.test/');

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured attempts and returns the last failure', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 503 }));

    const response = await loggedFetch('google_books', 'https://example.test/');

    expect(response.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(ATTEMPTS);
  });

  it('does not retry a client error that will not change', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 404 }));

    const response = await loggedFetch('google_books', 'https://example.test/');

    expect(response.status).toBe(404);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a thrown transport error', async () => {
    mockFetch((attempt) =>
      attempt === 1 ? Promise.reject(new Error('ECONNRESET')) : Promise.resolve({ ok: true, status: 200 }),
    );

    const response = await loggedFetch('open_library', 'https://example.test/');

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('rethrows when every attempt throws', async () => {
    mockFetch(() => Promise.reject(new Error('ECONNRESET')));

    await expect(loggedFetch('open_library', 'https://example.test/')).rejects.toThrow('ECONNRESET');
    expect(global.fetch).toHaveBeenCalledTimes(ATTEMPTS);
  });

  it('warns on each retry so flaky providers are visible', async () => {
    mockFetch((attempt) =>
      Promise.resolve(attempt === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 }),
    );

    await loggedFetch('google_books', 'https://example.test/');

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('retrying'));
  });

  describe('call stats', () => {
    // Per request rather than per lookup: a retry spends another slice of the
    // provider's quota, so counting it once would understate what a batch cost.
    it('counts every attempt, retries included', async () => {
      mockFetch((attempt) =>
        Promise.resolve(attempt === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 }),
      );

      const { stats, result } = runWithCallStats(() =>
        loggedFetch('google_books', 'https://example.test/'),
      );
      await result;

      expect(stats.providerCalls.get('google_books')).toBe(2);
    });

    it('attributes the count to the provider that was called', async () => {
      mockFetch(() => Promise.resolve({ ok: true, status: 200 }));

      const { stats, result } = runWithCallStats(() =>
        loggedFetch('open_library', 'https://example.test/'),
      );
      await result;

      expect(stats.providerCalls.get('open_library')).toBe(1);
      expect(stats.providerCalls.get('google_books')).toBeUndefined();
    });

    describe('per-call logging', () => {
      const original = process.env.LOG_BOOKS_PROVIDER_QUERIES;

      beforeEach(() => {
        process.env.LOG_BOOKS_PROVIDER_QUERIES = 'true';
      });

      afterEach(() => {
        if (original === undefined) delete process.env.LOG_BOOKS_PROVIDER_QUERIES;
        else process.env.LOG_BOOKS_PROVIDER_QUERIES = original;
      });

      it('is suppressed inside a scope, which reports its own totals', async () => {
        mockFetch(() => Promise.resolve({ ok: true, status: 200 }));

        const { stats, result } = runWithCallStats(() =>
          loggedFetch('google_books', 'https://example.test/'),
        );
        await result;

        expect(console.log).not.toHaveBeenCalled();
        expect(stats.providerCalls.get('google_books')).toBe(1);
      });

      it('still logs outside a scope', async () => {
        mockFetch(() => Promise.resolve({ ok: true, status: 200 }));

        await loggedFetch('google_books', 'https://example.test/');

        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[books:google_books]'));
      });

      it('keeps warning about retries, which report a provider misbehaving', async () => {
        mockFetch((attempt) =>
          Promise.resolve(attempt === 1 ? { ok: false, status: 503 } : { ok: true, status: 200 }),
        );

        const { result } = runWithCallStats(() =>
          loggedFetch('google_books', 'https://example.test/'),
        );
        await result;

        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('retrying'));
      });
    });

    it('counts the attempts a failed lookup spent before throwing', async () => {
      mockFetch(() => Promise.reject(new Error('ECONNRESET')));

      const { stats, result } = runWithCallStats(() =>
        loggedFetch('google_books', 'https://example.test/'),
      );
      await expect(result).rejects.toThrow('ECONNRESET');

      expect(stats.providerCalls.get('google_books')).toBe(ATTEMPTS);
    });
  });
});
