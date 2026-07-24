import { Request, Response } from 'express';
import { getBySlug } from '../../../controllers/books/get-by-slug';
import * as getBySlugModel from '../../../models/books/get-by-slug';

jest.mock('../../../models/books/get-by-slug');

const mockResolveBookBySlug = getBySlugModel.resolveBookBySlug as jest.Mock;
const mockGetLibraryEntry = getBySlugModel.getLibraryEntry as jest.Mock;

function makeReq(params: Record<string, string>, query: Record<string, string> = {}, user?: { id: number }) {
  return { params, query, user } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('getBySlug controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when the book cannot be resolved', async () => {
    mockResolveBookBySlug.mockResolvedValue(null);
    const res = makeRes();

    await getBySlug(makeReq({ slug: 'missing' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('passes the ?a= query param through as the author slug hint', async () => {
    mockResolveBookBySlug.mockResolvedValue({ id: 1, slug: 'x', cataloged: true });
    const res = makeRes();

    await getBySlug(makeReq({ slug: 'economics-in-one-lesson' }, { a: 'henry-hazlitt' }), res);

    expect(mockResolveBookBySlug).toHaveBeenCalledWith('economics-in-one-lesson', 'henry-hazlitt', undefined);
  });

  it('parses ?pid=g:<id> into a google_books provider id hint', async () => {
    mockResolveBookBySlug.mockResolvedValue({ id: 1, slug: 'x', cataloged: false });
    const res = makeRes();

    await getBySlug(makeReq({ slug: 'sapiens' }, { a: 'yuval-noah-harari', pid: 'g:MosvEQAAQBAJ' }), res);

    expect(mockResolveBookBySlug).toHaveBeenCalledWith('sapiens', 'yuval-noah-harari', {
      source: 'google_books',
      id: 'MosvEQAAQBAJ',
    });
  });

  it('parses ?pid=o:<id> into an open_library provider id hint', async () => {
    mockResolveBookBySlug.mockResolvedValue({ id: 1, slug: 'x', cataloged: false });
    const res = makeRes();

    await getBySlug(makeReq({ slug: 'sapiens' }, { a: 'yuval-noah-harari', pid: 'o:OL123M' }), res);

    expect(mockResolveBookBySlug).toHaveBeenCalledWith('sapiens', 'yuval-noah-harari', {
      source: 'open_library',
      id: 'OL123M',
    });
  });

  it('ignores a malformed pid and falls back to no provider id hint', async () => {
    mockResolveBookBySlug.mockResolvedValue({ id: 1, slug: 'x', cataloged: false });
    const res = makeRes();

    await getBySlug(makeReq({ slug: 'sapiens' }, { a: 'yuval-noah-harari', pid: 'xyz' }), res);

    expect(mockResolveBookBySlug).toHaveBeenCalledWith('sapiens', 'yuval-noah-harari', undefined);
  });

  it('checks the library entry for a cataloged book when authenticated', async () => {
    mockResolveBookBySlug.mockResolvedValue({ id: 4, slug: 'x', cataloged: true });
    mockGetLibraryEntry.mockResolvedValue({ status: 'reading' });
    const res = makeRes();

    await getBySlug(makeReq({ slug: 'x' }, {}, { id: 7 }), res);

    expect(mockGetLibraryEntry).toHaveBeenCalledWith(7, 4);
    expect(res.json).toHaveBeenCalledWith({
      book: { id: 4, slug: 'x', cataloged: true },
      inLibrary: true,
      libraryEntry: { status: 'reading' },
    });
  });

  it('does not check the library entry for an ephemeral (not-yet-cataloged) book', async () => {
    mockResolveBookBySlug.mockResolvedValue({ id: 0, slug: 'x', cataloged: false });
    const res = makeRes();

    await getBySlug(makeReq({ slug: 'x' }, { a: 'someone' }, { id: 7 }), res);

    expect(mockGetLibraryEntry).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      book: { id: 0, slug: 'x', cataloged: false },
      inLibrary: false,
    });
  });

  it('returns 500 on unexpected error', async () => {
    mockResolveBookBySlug.mockRejectedValue(new Error('db fail'));
    const res = makeRes();

    await getBySlug(makeReq({ slug: 'x' }), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
