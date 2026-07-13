import { Request, Response } from 'express';
import { getMetadata } from '../../../controllers/search/get-metadata';
import * as searchModel from '../../../models/ai/search';

jest.mock('../../../models/ai/search');

const mockSearchBooks = searchModel.searchBooks as jest.Mock;
const mockMatchLibraryEntries = searchModel.matchLibraryEntries as jest.Mock;

function makeReq(body: object, user?: { id: number; email: string }) {
  return { body, user } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('getMetadata controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when books is missing', async () => {
    const res = makeRes();
    await getMetadata(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when books is not an array', async () => {
    const res = makeRes();
    await getMetadata(makeReq({ books: 'not an array' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when books is empty', async () => {
    const res = makeRes();
    await getMetadata(makeReq({ books: [] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('builds the query as "title author" (no literal "by") when author is given', async () => {
    mockSearchBooks.mockResolvedValue([{ title: 'A Book', googleBooksId: 'g1' }]);
    const res = makeRes();
    await getMetadata(makeReq({ books: [{ title: 'A Book', author: 'Some Author' }] }), res);
    expect(mockSearchBooks).toHaveBeenCalledWith('A Book Some Author', 1);
  });

  it('builds the query as just the title when author is omitted', async () => {
    mockSearchBooks.mockResolvedValue([{ title: 'A Book', googleBooksId: 'g1' }]);
    const res = makeRes();
    await getMetadata(makeReq({ books: [{ title: 'A Book' }] }), res);
    expect(mockSearchBooks).toHaveBeenCalledWith('A Book', 1);
  });

  it('resolves each entry in order and maps unmatched entries to null', async () => {
    mockSearchBooks
      .mockResolvedValueOnce([{ title: 'First', googleBooksId: 'g1' }])
      .mockResolvedValueOnce([]);
    const res = makeRes();
    await getMetadata(
      makeReq({ books: [{ title: 'First' }, { title: 'Second' }] }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith({
      books: [{ title: 'First', googleBooksId: 'g1' }, null],
    });
  });

  it('calls searchBooks concurrently rather than one at a time', async () => {
    const order: string[] = [];
    mockSearchBooks.mockImplementation(async (query: string) => {
      order.push(`start:${query}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`end:${query}`);
      return [];
    });
    const res = makeRes();
    await getMetadata(makeReq({ books: [{ title: 'A' }, { title: 'B' }] }), res);
    expect(order).toEqual(['start:A', 'start:B', 'end:A', 'end:B']);
  });

  it('preserves input order in the response even if results resolve out of order', async () => {
    mockSearchBooks.mockImplementation(async (query: string) => {
      const delay = query === 'First' ? 10 : 0;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return [{ title: query, googleBooksId: `g-${query}` }];
    });
    const res = makeRes();
    await getMetadata(makeReq({ books: [{ title: 'First' }, { title: 'Second' }] }), res);
    expect(res.json).toHaveBeenCalledWith({
      books: [
        { title: 'First', googleBooksId: 'g-First' },
        { title: 'Second', googleBooksId: 'g-Second' },
      ],
    });
  });

  it('truncates the batch to the first 40 entries', async () => {
    mockSearchBooks.mockResolvedValue([]);
    const books = Array.from({ length: 50 }, (_, i) => ({ title: `Book ${i}` }));
    const res = makeRes();
    await getMetadata(makeReq({ books }), res);
    expect(mockSearchBooks).toHaveBeenCalledTimes(40);
  });

  it('calls matchLibraryEntries with resolved books when authenticated', async () => {
    mockSearchBooks.mockResolvedValue([{ title: 'A Book', googleBooksId: 'g1' }]);
    const res = makeRes();
    await getMetadata(makeReq({ books: [{ title: 'A Book' }] }, { id: 1, email: 'a@b.com' }), res);
    expect(mockMatchLibraryEntries).toHaveBeenCalledWith(1, [{ title: 'A Book', googleBooksId: 'g1' }]);
  });

  it('skips matchLibraryEntries when unauthenticated', async () => {
    mockSearchBooks.mockResolvedValue([{ title: 'A Book', googleBooksId: 'g1' }]);
    const res = makeRes();
    await getMetadata(makeReq({ books: [{ title: 'A Book' }] }), res);
    expect(mockMatchLibraryEntries).not.toHaveBeenCalled();
  });

  it('skips matchLibraryEntries when authenticated but nothing resolved', async () => {
    mockSearchBooks.mockResolvedValue([]);
    const res = makeRes();
    await getMetadata(makeReq({ books: [{ title: 'A Book' }] }, { id: 1, email: 'a@b.com' }), res);
    expect(mockMatchLibraryEntries).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockSearchBooks.mockRejectedValue(new Error('network'));
    const res = makeRes();
    await getMetadata(makeReq({ books: [{ title: 'A Book' }] }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
