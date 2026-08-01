import { loggedFetch } from '../../../lib/books/logged-fetch';
import { cacheGet } from '../../../lib/cache/cache-get';
import { cacheSet } from '../../../lib/cache/cache-set';
import { isCacheEnabled } from '../../../lib/cache/redis-client';
import { runWithCallStats } from '../../../lib/stats/run-with-call-stats';

jest.mock('../../../lib/cache/cache-get');
jest.mock('../../../lib/cache/cache-set');
jest.mock('../../../lib/cache/redis-client');

const mockCacheGet = cacheGet as jest.Mock;
const mockCacheSet = cacheSet as jest.Mock;
const mockIsCacheEnabled = isCacheEnabled as jest.Mock;

const DAY = 24 * 60 * 60;

function mockFetch(response: any) {
  global.fetch = jest.fn().mockResolvedValue(response) as any;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('loggedFetch caching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockIsCacheEnabled.mockReturnValue(true);
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves a hit without touching the network', async () => {
    mockCacheGet.mockResolvedValue({ status: 200, body: '{"totalItems":1}' });
    mockFetch(jsonResponse({}));

    const response = await loggedFetch('google_books', 'https://example.test/volumes/abc');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ totalItems: 1 });
  });

  // A hit consumed no quota, so counting it would overstate what the provider
  // actually saw.
  it('does not count a hit as a provider call', async () => {
    mockCacheGet.mockResolvedValue({ status: 200, body: '{}' });

    const { stats, result } = runWithCallStats(() =>
      loggedFetch('google_books', 'https://example.test/volumes/abc'),
    );
    await result;

    expect(stats.providerCalls.get('google_books')).toBeUndefined();
  });

  it('stores a success and still hands the body to the caller', async () => {
    mockFetch(jsonResponse({ totalItems: 2 }));

    const response = await loggedFetch('google_books', 'https://example.test/volumes?q=sagan');

    expect(mockCacheSet).toHaveBeenCalledTimes(1);
    const [key, value] = mockCacheSet.mock.calls[0];
    expect(key).toMatch(/^books:fetch:v1:/);
    expect(value).toEqual({ status: 200, body: '{"totalItems":2}' });
    // Reading the body to cache it consumes it, so the caller gets a fresh one.
    await expect(response.json()).resolves.toEqual({ totalItems: 2 });
  });

  // These are exactly the transient failures the retry loop exists to paper
  // over; caching one would keep serving it for the whole TTL.
  it.each([429, 500, 503, 404])('does not cache a %s', async (status) => {
    mockFetch(jsonResponse({ error: true }, status));

    await loggedFetch('google_books', 'https://example.test/volumes/abc');

    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it('holds an edition lookup longer than a search', async () => {
    mockFetch(jsonResponse({}));
    await loggedFetch('google_books', 'https://example.test/volumes/abc123');
    expect(mockCacheSet.mock.calls[0][2]).toBe(7 * DAY);

    mockCacheSet.mockClear();
    mockFetch(jsonResponse({}));
    await loggedFetch('google_books', 'https://example.test/search.json?q=sagan');
    expect(mockCacheSet.mock.calls[0][2]).toBe(DAY);
  });

  it('keys different urls separately', async () => {
    mockFetch(jsonResponse({}));
    await loggedFetch('google_books', 'https://example.test/volumes/a');
    mockFetch(jsonResponse({}));
    await loggedFetch('google_books', 'https://example.test/volumes/b');

    expect(mockCacheSet.mock.calls[0][0]).not.toBe(mockCacheSet.mock.calls[1][0]);
  });

  // Local dev and the test suite run with no Redis, and that path has to behave
  // exactly as it did before the cache existed — including not consuming the
  // response body.
  describe('when the cache is not configured', () => {
    beforeEach(() => {
      mockIsCacheEnabled.mockReturnValue(false);
    });

    it('neither reads nor writes, and returns the original response', async () => {
      const original = { ok: true, status: 200 };
      mockFetch(original);

      const response = await loggedFetch('google_books', 'https://example.test/volumes/abc');

      expect(mockCacheGet).not.toHaveBeenCalled();
      expect(mockCacheSet).not.toHaveBeenCalled();
      expect(response).toBe(original as any);
    });
  });
});
