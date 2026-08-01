import { cacheGet } from '../../../lib/cache/cache-get';
import { cacheSet } from '../../../lib/cache/cache-set';
import { cacheKey } from '../../../lib/cache/cache-key';
import { getRedis, isCacheEnabled, resetRedis } from '../../../lib/cache/redis-client';

jest.mock('ioredis');

const MockRedis = jest.requireMock('ioredis').default ?? jest.requireMock('ioredis');

const ORIGINAL_URL = process.env.REDIS_URL;

afterEach(() => {
  resetRedis();
  if (ORIGINAL_URL === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = ORIGINAL_URL;
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
