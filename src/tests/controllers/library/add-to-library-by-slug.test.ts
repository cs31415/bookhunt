import { Request, Response } from 'express';
import { addToLibraryBySlug } from '../../../controllers/library/add-to-library-by-slug';
import * as booksData from '../../../data/books-data';
import * as addExistingToLibraryModel from '../../../models/library/add-existing-to-library';
import * as addToLibraryModel from '../../../models/library/add-to-library';

jest.mock('../../../data/books-data');
jest.mock('../../../models/library/add-existing-to-library');
jest.mock('../../../models/library/add-to-library');

const mockGetBookBySlug = booksData.getBookBySlug as jest.Mock;
const mockAddExistingToLibrary = addExistingToLibraryModel.addExistingToLibrary as jest.Mock;
const mockAddToLibrary = addToLibraryModel.addToLibrary as jest.Mock;

function makeReq(slug: string, body: Record<string, unknown> = {}, userId = 7) {
  return {
    params: { slug },
    body,
    user: { id: userId, email: 'a@b.com' },
  } as unknown as Request;
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('addToLibraryBySlug controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when the slug matches an existing catalog book', () => {
    it('adds it directly (idempotent, no upsert) and defaults status to queued', async () => {
      mockGetBookBySlug.mockResolvedValue({ id: 5, slug: 'a-book' });
      const entry = { user_id: 7, book_id: 5, status: 'queued' };
      mockAddExistingToLibrary.mockResolvedValue(entry);
      const res = makeRes();

      await addToLibraryBySlug(makeReq('a-book'), res);

      expect(mockAddExistingToLibrary).toHaveBeenCalledWith(7, 5, 'queued');
      expect(mockAddToLibrary).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ entry, book: { id: 5, slug: 'a-book' } });
    });

    it('passes through an explicit valid status', async () => {
      mockGetBookBySlug.mockResolvedValue({ id: 5, slug: 'a-book' });
      mockAddExistingToLibrary.mockResolvedValue({});
      const res = makeRes();

      await addToLibraryBySlug(makeReq('a-book', { status: 'reading' }), res);

      expect(mockAddExistingToLibrary).toHaveBeenCalledWith(7, 5, 'reading');
    });
  });

  describe('when the slug does not match an existing catalog book', () => {
    it('upserts a new catalog row from the request body and adds it', async () => {
      mockGetBookBySlug.mockResolvedValue(null);
      const entry = { user_id: 7, book_id: 9, status: 'queued' };
      const book = { id: 9, slug: 'a-new-book' };
      mockAddToLibrary.mockResolvedValue({ entry, book });
      const res = makeRes();

      await addToLibraryBySlug(
        makeReq('a-new-book', { title: 'A New Book', authorName: 'New Author', googleBooksId: 'gid' }),
        res,
      );

      expect(mockAddToLibrary).toHaveBeenCalledWith(7, {
        title: 'A New Book',
        authorName: 'New Author',
        googleBooksId: 'gid',
        slug: 'a-new-book',
      });
      expect(mockAddExistingToLibrary).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ entry, book: { id: 9, slug: 'a-new-book' } });
    });

    it('returns 400 when title is missing', async () => {
      mockGetBookBySlug.mockResolvedValue(null);
      const res = makeRes();

      await addToLibraryBySlug(makeReq('a-new-book', { authorName: 'A', googleBooksId: 'gid' }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockAddToLibrary).not.toHaveBeenCalled();
    });

    // The CSV client offers exactly this shape for a row nothing matched, and
    // requiring a provider id made every such row 400 and be reported to the
    // reader as an error (LOS-196). resolveBookBySlug fills in the rest when
    // the book's page is opened.
    it('creates a thin book from title and author alone', async () => {
      mockGetBookBySlug.mockResolvedValue(null);
      mockAddToLibrary.mockResolvedValue({ entry: { book_id: 9 }, book: { id: 9, slug: 'a-new-book' } });
      const res = makeRes();

      await addToLibraryBySlug(makeReq('a-new-book', { title: 'T', authorName: 'A' }), res);

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(mockAddToLibrary).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ title: 'T', authorName: 'A', slug: 'a-new-book' }),
      );
    });

    it('still returns 400 without a title or an author, which is nothing to create from', async () => {
      mockGetBookBySlug.mockResolvedValue(null);
      const res = makeRes();

      await addToLibraryBySlug(makeReq('a-new-book', { title: 'T' }), res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockAddToLibrary).not.toHaveBeenCalled();
    });
  });

  it('returns 400 for an invalid status', async () => {
    const res = makeRes();

    await addToLibraryBySlug(makeReq('a-book', { status: 'bogus' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockGetBookBySlug).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetBookBySlug.mockRejectedValue(new Error('db fail'));
    const res = makeRes();

    await addToLibraryBySlug(makeReq('a-book'), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
