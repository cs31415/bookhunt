import { Request, Response } from 'express';
import { bulkAddToLibrary } from '../../../controllers/library/bulk-add-to-library';
import * as bulkModel from '../../../models/library/bulk-add-to-library';

jest.mock('../../../models/library/bulk-add-to-library');

const mockBulkAdd = bulkModel.bulkAddToLibrary as jest.Mock;

const VALID_BOOK = {
  googleBooksId: 'gid1',
  slug: 'a-book',
  title: 'A Book',
  authorName: 'Author',
};

function makeReq(body: unknown) {
  return { body, user: { id: 1, email: 'a@b.com' } } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('bulkAddToLibrary controller', () => {
  it('returns 400 when books is missing', async () => {
    const res = makeRes();
    await bulkAddToLibrary(makeReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'books must be a non-empty array' });
  });

  it('returns 400 when books is not an array', async () => {
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: 'not-array' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'books must be a non-empty array' });
  });

  it('returns 400 when books is an empty array', async () => {
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: [] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'books must be a non-empty array' });
  });

  it('returns 400 when books exceeds 20 items', async () => {
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: Array(21).fill(VALID_BOOK) }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'books must contain at most 20 items' });
  });

  it('returns 400 when a book is missing a required field', async () => {
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: [{ googleBooksId: 'x', slug: 'x', title: 'x' }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'each book requires (googleBooksId or openLibraryId), slug, title, and authorName' });
  });

  it('returns 400 when a book has neither googleBooksId nor openLibraryId', async () => {
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: [{ slug: 'x', title: 'x', authorName: 'x' }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'each book requires (googleBooksId or openLibraryId), slug, title, and authorName' });
  });

  it('accepts a book with only openLibraryId (no googleBooksId)', async () => {
    mockBulkAdd.mockResolvedValue({ entries: [{ id: 1 }], errors: [] });
    const res = makeRes();
    await bulkAddToLibrary(
      makeReq({ books: [{ openLibraryId: 'OL1M', slug: 'x', title: 'x', authorName: 'x' }] }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 when a book has an invalid status', async () => {
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: [{ ...VALID_BOOK, status: 'invalid' }] }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'invalid status: invalid' });
  });

  it('returns 201 with entries and empty errors on all-success', async () => {
    const entries = [{ id: 1 }, { id: 2 }];
    mockBulkAdd.mockResolvedValue({ entries, errors: [] });
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: [VALID_BOOK, { ...VALID_BOOK, googleBooksId: 'gid2' }] }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ entries, errors: [] });
  });

  it('returns 207 when some books fail', async () => {
    const entries = [{ id: 1 }];
    const errors = [{ index: 1, googleBooksId: 'gid2', reason: 'not found' }];
    mockBulkAdd.mockResolvedValue({ entries, errors });
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: [VALID_BOOK, { ...VALID_BOOK, googleBooksId: 'gid2' }] }), res);
    expect(res.status).toHaveBeenCalledWith(207);
    expect(res.json).toHaveBeenCalledWith({ entries, errors });
  });

  it('returns 500 on unexpected model error', async () => {
    mockBulkAdd.mockRejectedValue(new Error('db down'));
    const res = makeRes();
    await bulkAddToLibrary(makeReq({ books: [VALID_BOOK] }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
