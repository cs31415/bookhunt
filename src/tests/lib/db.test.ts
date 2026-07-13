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
});
