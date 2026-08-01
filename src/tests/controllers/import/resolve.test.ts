import { Request, Response } from 'express';
import { resolve, MAX_IMPORT_ROWS } from '../../../controllers/import/resolve';
import * as resolveModel from '../../../models/import/resolve-rows';
import { recordProviderCall } from '../../../lib/stats/record-provider-call';
import { recordDbCall } from '../../../lib/stats/record-db-call';

jest.mock('../../../models/import/resolve-rows');

const mockResolveRows = resolveModel.resolveImportRows as jest.Mock;

function makeReq(body: unknown, userId = 1) {
  return { body, user: { id: userId, email: 'a@b.com' } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('import resolve controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveRows.mockResolvedValue([]);
  });

  it('returns 400 when rows is missing', async () => {
    const res = makeRes();
    await resolve(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'rows must be a non-empty array' });
  });

  it('returns 400 when rows is not an array', async () => {
    const res = makeRes();
    await resolve(makeReq({ rows: 'Dune' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when rows is empty', async () => {
    const res = makeRes();
    await resolve(makeReq({ rows: [] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when rows exceeds the cap', async () => {
    const res = makeRes();
    await resolve(makeReq({ rows: Array(MAX_IMPORT_ROWS + 1).fill({ title: 'Dune' }) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: `rows must contain at most ${MAX_IMPORT_ROWS} items`,
    });
  });

  it('accepts a batch at exactly the cap', async () => {
    const res = makeRes();
    await resolve(makeReq({ rows: Array(MAX_IMPORT_ROWS).fill({ title: 'Dune' }) }), res);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it.each([[{}], [{ title: '' }], [{ title: '   ' }], [{ title: 42 }]])(
    'returns 400 when a row has no usable title: %o',
    async (row) => {
      const res = makeRes();
      await resolve(makeReq({ rows: [{ title: 'Fine' }, row] }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'each row must have a non-empty title' });
    },
  );

  it('trims hints and normalises blank optional fields to null', async () => {
    const res = makeRes();
    await resolve(makeReq({ rows: [{ title: '  Hong Kong  ', author: '  ', publisher: " Frommer's " }] }), res);

    expect(mockResolveRows).toHaveBeenCalledWith(
      [{ title: 'Hong Kong', author: null, publisher: "Frommer's", isbn: null }],
      1,
    );
  });

  it('passes an ISBN through for exact matching', async () => {
    const res = makeRes();
    await resolve(makeReq({ rows: [{ title: 'Dune', isbn: ' 978-0-441-01359-3 ' }] }), res);

    expect(mockResolveRows).toHaveBeenCalledWith(
      [{ title: 'Dune', author: null, publisher: null, isbn: '978-0-441-01359-3' }],
      1,
    );
  });

  it('passes the authenticated user through for catalog matching', async () => {
    const res = makeRes();
    await resolve(makeReq({ rows: [{ title: 'Dune' }] }, 77), res);

    expect(mockResolveRows).toHaveBeenCalledWith(expect.anything(), 77);
  });

  it('returns the resolved rows', async () => {
    const rows = [{ title: 'Dune', author: null, publisher: null, candidates: [] }];
    mockResolveRows.mockResolvedValue(rows);
    const res = makeRes();

    await resolve(makeReq({ rows: [{ title: 'Dune' }] }), res);

    expect(res.json).toHaveBeenCalledWith({ rows });
  });

  it('returns 500 on an unexpected model failure', async () => {
    mockResolveRows.mockRejectedValue(new Error('db down'));
    const res = makeRes();

    await resolve(makeReq({ rows: [{ title: 'Dune' }] }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  // What a batch costs externally depends on how many rows are already owned,
  // carry an ISBN, or need the fallback — none of it visible in the response.
  describe('call stats logging', () => {
    it('logs one summary line per batch', async () => {
      await resolve(makeReq({ rows: [{ title: 'Dune' }, { title: 'Emma' }] }), makeRes());

      expect(console.log).toHaveBeenCalledWith(
        '[import] rows=2 google_books=0 open_library=0 db=0 calls, 0 rows []',
      );
    });

    it('counts the calls the model made', async () => {
      mockResolveRows.mockImplementation(async () => {
        recordProviderCall('google_books');
        recordProviderCall('open_library');
        recordDbCall(5);
        return [];
      });

      await resolve(makeReq({ rows: [{ title: 'Dune' }] }), makeRes());

      expect(console.log).toHaveBeenCalledWith(
        '[import] rows=1 google_books=1 open_library=1 db=1 calls, 5 rows [5]',
      );
    });

    it('still reports what a failed batch spent', async () => {
      mockResolveRows.mockImplementation(async () => {
        recordProviderCall('google_books');
        throw new Error('db down');
      });
      const res = makeRes();

      await resolve(makeReq({ rows: [{ title: 'Dune' }] }), res);

      expect(console.log).toHaveBeenCalledWith(
        '[import] rows=1 google_books=1 open_library=0 db=0 calls, 0 rows []',
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('does not log a batch rejected before any work was done', async () => {
      await resolve(makeReq({ rows: [] }), makeRes());

      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
