import { cacheGet } from '../../../lib/cache/cache-get';
import { cacheSet } from '../../../lib/cache/cache-set';
import { cacheKey } from '../../../lib/cache/cache-key';
import { getRedis, isCacheEnabled, resetRedis } from '../../../lib/cache/redis-client';
import { resetCacheLogging } from '../../../lib/cache/log-cache';

jest.mock('ioredis');

const MockRedis = jest.requireMock('ioredis').default ?? jest.requireMock('ioredis');

const ORIGINAL_URL = process.env.REDIS_URL;
const ORIGINAL_LOG = process.env.LOG_CACHE_QUERIES;

afterEach(() => {
  resetRedis();
  resetCacheLogging();
  if (ORIGINAL_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_URL;
  if (ORIGINAL_LOG === undefined) delete process.env.LOG_CACHE_QUERIES;
  else process.env.LOG_CACHE_QUERIES = ORIGINAL_LOG;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('cacheKey', () => {
  it('namespaces and versions the key, and is stable for the same parts', () => {
    const key = cacheKey('ai:search', 1, 'sagan', 20);

    expect(key).toMatch(/^ai:search:v1:[0-9a-f]{64}$/);
    expect(cacheKey('ai:search', 1, 'sagan', 20)).toBe(key);
  });

  it('separates different parts, versions and namespaces', () => {
    const base = cacheKey('ai:search', 1, 'sagan', 20);

    expect(cacheKey('ai:search', 1, 'dune', 20)).not.toBe(base);
    expect(cacheKey('ai:search', 1, 'sagan', 10)).not.toBe(base);
    // The whole invalidation story: a bump orphans every old entry at once.
    expect(cacheKey('ai:search', 2, 'sagan', 20)).not.toBe(base);
    expect(cacheKey('books:fetch', 1, 'sagan', 20)).not.toBe(base);
  });

  it('treats null and undefined parts as empty rather than throwing', () => {
    expect(() => cacheKey('ai:search', 1, 'sagan', null, undefined)).not.toThrow();
  });
});

// Local dev and the whole test suite run with no Redis at all.
describe('with REDIS_URL unset', () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });

  it('reports the cache as disabled and never builds a client', () => {
    expect(isCacheEnabled()).toBe(false);
    expect(getRedis()).toBeNull();
    expect(MockRedis).not.toHaveBeenCalled();
  });

  it('reads as a miss and writes as a no-op', async () => {
    await expect(cacheGet('any-key')).resolves.toBeNull();
    await expect(cacheSet('any-key', { a: 1 }, 60)).resolves.toBeUndefined();
  });
});

describe('with REDIS_URL set', () => {
  let client: { get: jest.Mock; set: jest.Mock; on: jest.Mock; disconnect: jest.Mock };

  beforeEach(() => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    client = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      disconnect: jest.fn(),
    };
    MockRedis.mockImplementation(() => client);
  });

  it('builds the client lazily and reuses it', () => {
    expect(MockRedis).not.toHaveBeenCalled();

    getRedis();
    getRedis();

    expect(MockRedis).toHaveBeenCalledTimes(1);
  });

  // A cache slower than the call it stands in for is worse than no cache.
  it('bounds both connect and command time', () => {
    getRedis();

    expect(MockRedis).toHaveBeenCalledWith(
      'redis://localhost:6379',
      expect.objectContaining({
        connectTimeout: 200,
        commandTimeout: 200,
        maxRetriesPerRequest: 1,
      }),
    );
  });

  // An unhandled 'error' event on the client crashes the process.
  it('subscribes to error events', () => {
    getRedis();

    expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('round-trips a value', async () => {
    await cacheSet('k', { title: 'Cosmos' }, 3600);
    expect(client.set).toHaveBeenCalledWith('k', '{"title":"Cosmos"}', 'EX', 3600);

    client.get.mockResolvedValue('{"title":"Cosmos"}');
    await expect(cacheGet('k')).resolves.toEqual({ title: 'Cosmos' });
  });

  it('reports a key that is not there as a miss', async () => {
    client.get.mockResolvedValue(null);

    await expect(cacheGet('k')).resolves.toBeNull();
  });

  // Redis being unreachable must degrade to a miss, never fail the request the
  // cache was standing in front of.
  it('treats a failing read as a miss', async () => {
    client.get.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(cacheGet('k')).resolves.toBeNull();
  });

  it('swallows a failing write', async () => {
    client.set.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(cacheSet('k', { a: 1 }, 60)).resolves.toBeUndefined();
  });

  // A stored value whose shape changed should not take a request down.
  it('treats an unparseable value as a miss', async () => {
    client.get.mockResolvedValue('not json');

    await expect(cacheGet('k')).resolves.toBeNull();
  });
});

// The cache's failure modes are all shaped like a miss, so these logs are the
// only way to tell a dead cache from a cold one.
describe('cache logging', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
    // Silences the outage warning from reportCacheFailure in the failing-read
    // case below, which is asserted on elsewhere.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  function lines(): string[] {
    return log.mock.calls.map((call) => String(call[0]));
  }

  describe('with LOG_CACHE_QUERIES unset', () => {
    it('says nothing at all', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      MockRedis.mockImplementation(() => ({
        get: jest.fn().mockResolvedValue('{"a":1}'),
        set: jest.fn().mockResolvedValue('OK'),
        on: jest.fn(),
        disconnect: jest.fn(),
      }));

      await cacheGet('k');
      await cacheSet('k', { a: 1 }, 60);

      expect(lines()).toHaveLength(0);
    });
  });

  describe('with LOG_CACHE_QUERIES=true', () => {
    beforeEach(() => {
      process.env.LOG_CACHE_QUERIES = 'true';
    });

    it('reports the cache as disabled exactly once, not once per call', async () => {
      delete process.env.REDIS_URL;

      await cacheGet('a');
      await cacheGet('b');
      await cacheSet('c', { a: 1 }, 60);

      const disabled = lines().filter((line) => line.includes('disabled'));
      expect(disabled).toHaveLength(1);
      expect(disabled[0]).toContain('REDIS_URL');
    });

    describe('with Redis up', () => {
      let client: { get: jest.Mock; set: jest.Mock; on: jest.Mock; disconnect: jest.Mock };

      beforeEach(() => {
        process.env.REDIS_URL = 'redis://localhost:6379';
        client = {
          get: jest.fn(),
          set: jest.fn().mockResolvedValue('OK'),
          on: jest.fn(),
          disconnect: jest.fn(),
        };
        MockRedis.mockImplementation(() => client);
      });

      it('distinguishes a miss from a hit, and names the key', async () => {
        const key = cacheKey('ai:search', 2, 'ada lovelace');

        client.get.mockResolvedValue(null);
        await cacheGet(key);
        client.get.mockResolvedValue('[{"title":"Ada"}]');
        await cacheGet(key);

        expect(lines()[0]).toContain(`miss ${key}`);
        expect(lines()[1]).toContain(`hit ${key}`);
        expect(lines()[0]).toMatch(/\d+ms$/);
      });

      // A key written with the wrong duration is indistinguishable from a correct
      // one until it expires, which is far too late to notice.
      it('records the TTL on a write', async () => {
        await cacheSet('k', { a: 1 }, 2592000);

        expect(lines()[0]).toContain('set k ttl=2592000s');
      });

      // withTimeout resolves to its fallback instead of rejecting, so a refused
      // or timed-out write never reaches the catch. Reporting it as a set would
      // make a dead cache look like a working one.
      it('does not claim a write succeeded when it did not', async () => {
        client.set.mockResolvedValue(null);

        await cacheSet('k', { a: 1 }, 60);

        expect(lines()[0]).toContain('set-failed k');
        expect(lines()[0]).not.toMatch(/\bset k\b/);
      });

      it('logs a rejected write as a failure', async () => {
        client.set.mockRejectedValue(new Error('ECONNREFUSED'));

        await cacheSet('k', { a: 1 }, 60);

        expect(lines()[0]).toContain('set-failed k');
      });

      it('logs a failing read as a miss rather than a hit', async () => {
        client.get.mockRejectedValue(new Error('ECONNREFUSED'));

        await cacheGet('k');

        expect(lines()[0]).toContain('miss k');
      });

      // Saying "hit" here would point an investigation at the wrong place.
      it('logs an unparseable value as a miss', async () => {
        client.get.mockResolvedValue('not json');

        await cacheGet('k');

        expect(lines()[0]).toContain('miss k');
      });

      it('never logs the cached value', async () => {
        client.get.mockResolvedValue('{"secret":"cosmos"}');

        await cacheGet('k');

        expect(lines().join('\n')).not.toContain('cosmos');
      });
    });
  });
});
