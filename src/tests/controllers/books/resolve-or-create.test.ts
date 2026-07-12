import { Request, Response } from 'express';
import { resolveOrCreate } from '../../../controllers/books/resolve-or-create';
import * as resolveOrCreateModel from '../../../models/books/resolve-or-create';

jest.mock('../../../models/books/resolve-or-create');

const mockResolveOrCreateBook = resolveOrCreateModel.resolveOrCreateBook as jest.Mock;

function makeReq(body: Record<string, unknown>) {
  return { body } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('resolveOrCreate controller', () => {
  it('returns 400 when title is missing', async () => {
    const res = makeRes();
    await resolveOrCreate(makeReq({ authorName: 'A', googleBooksId: 'g' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockResolveOrCreateBook).not.toHaveBeenCalled();
  });

  it('returns 400 when authorName is missing', async () => {
    const res = makeRes();
    await resolveOrCreate(makeReq({ title: 'T', googleBooksId: 'g' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when neither googleBooksId nor openLibraryId is present', async () => {
    const res = makeRes();
    await resolveOrCreate(makeReq({ title: 'T', authorName: 'A' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockResolveOrCreateBook).not.toHaveBeenCalled();
  });

  it('returns only id and slug on success', async () => {
    mockResolveOrCreateBook.mockResolvedValue({ id: 7, slug: 'a-book', title: 'A Book', blurb: 'ignored' });
    const res = makeRes();

    await resolveOrCreate(makeReq({ title: 'A Book', authorName: 'Author', googleBooksId: 'gid' }), res);

    expect(res.json).toHaveBeenCalledWith({ book: { id: 7, slug: 'a-book' } });
  });

  it('returns 500 on unexpected error', async () => {
    mockResolveOrCreateBook.mockRejectedValue(new Error('db fail'));
    const res = makeRes();

    await resolveOrCreate(makeReq({ title: 'T', authorName: 'A', googleBooksId: 'g' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
