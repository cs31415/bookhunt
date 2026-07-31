import { loggedFetch } from '../../../lib/books/logged-fetch';
import { httpAttempts } from '../../../lib/books/books-retry-config';

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
});
