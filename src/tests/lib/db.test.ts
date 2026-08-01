const mockQuery = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({ query: mockQuery })),
}));

describe('db pool query logging', () => {
  const originalEnv = process.env.LOG_DB_QUERIES;

  beforeEach(() => {
    jest.resetModules();
    mockQuery.mockReset();
  });

  afterEach(() => {
    process.env.LOG_DB_QUERIES = originalEnv;
  });

  it('does not log when LOG_DB_QUERIES is unset', async () => {
    delete process.env.LOG_DB_QUERIES;
    mockQuery.mockResolvedValue({ rows: [] });
    const { pool } = await import('../../lib/db');

    await pool.query('SELECT 1');

    expect(console.log).not.toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
  });

  it('logs the query text, params, and duration when LOG_DB_QUERIES=true', async () => {
    process.env.LOG_DB_QUERIES = 'true';
    mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });
    const { pool } = await import('../../lib/db');

    const result = await pool.query('SELECT * FROM books WHERE id = $1', [1]);

    expect(result).toEqual({ rows: [{ id: 1 }] });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\[db\] query "SELECT \* FROM books WHERE id = \$1" params: \[1\], \d+ms$/),
    );
  });

  // Recording is independent of LOG_DB_QUERIES: a route that reports its own
  // cost shouldn't need the verbose per-query log turned on to do it.
  describe('call stats', () => {
    beforeEach(() => {
      delete process.env.LOG_DB_QUERIES;
    });

    it('records each query with the number of rows it returned', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { pool } = await import('../../lib/db');
      const { runWithCallStats } = await import('../../lib/stats/run-with-call-stats');

      const { stats, result } = runWithCallStats(async () => {
        await pool.query('SELECT 1');
        await pool.query('SELECT 2');
      });
      await result;

      expect(stats.dbRowCounts).toEqual([2, 0]);
      expect(console.log).not.toHaveBeenCalled();
    });

    it('suppresses the per-query log inside a scope, which reports its own totals', async () => {
      process.env.LOG_DB_QUERIES = 'true';
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
      const { pool } = await import('../../lib/db');
      const { runWithCallStats } = await import('../../lib/stats/run-with-call-stats');

      const { stats, result } = runWithCallStats(() => pool.query('SELECT 1'));
      await result;

      expect(console.log).not.toHaveBeenCalled();
      expect(stats.dbRowCounts).toEqual([1]);
    });

    it('still logs per query outside a scope', async () => {
      process.env.LOG_DB_QUERIES = 'true';
      mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
      const { pool } = await import('../../lib/db');

      await pool.query('SELECT 1');

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[db] query'));
    });

    it('falls back to the row array when the driver reports no rowCount', async () => {
      mockQuery.mockResolvedValue({ rows: [{ id: 1 }] });
      const { pool } = await import('../../lib/db');
      const { runWithCallStats } = await import('../../lib/stats/run-with-call-stats');

      const { stats, result } = runWithCallStats(() => pool.query('SELECT 1'));
      await result;

      expect(stats.dbRowCounts).toEqual([1]);
    });
  });
});
