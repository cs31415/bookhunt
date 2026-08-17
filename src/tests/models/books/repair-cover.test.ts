import { repairCover } from '../../../models/books/repair-cover';
import * as booksData from '../../../data/books-data';
import { getGoogleBooksById, searchGoogleBooks } from '../../../lib/books/google-books-adapter';
import { cacheGet } from '../../../lib/cache/cache-get';
import { cacheSet } from '../../../lib/cache/cache-set';

jest.mock('../../../data/books-data');
jest.mock('../../../lib/books/google-books-adapter');
jest.mock('../../../lib/cache/cache-get');
jest.mock('../../../lib/cache/cache-set');

const mockGetBookBySlug = booksData.getBookBySlug as jest.Mock;
const mockSetBookCover = booksData.setBookCover as jest.Mock;
const mockSearchGoogleBooks = searchGoogleBooks as jest.Mock;
const mockGetGoogleBooksById = getGoogleBooksById as jest.Mock;
const mockCacheGet = cacheGet as jest.Mock;
const mockCacheSet = cacheSet as jest.Mock;

const DEAD_COVER = 'https://covers.openlibrary.org/b/id/13985317-M.jpg';
const GOOGLE_COVER = 'https://books.google.com/books/content?id=abc&img=1';

const book = {
  id: 299,
  slug: 'enlightenment',
  title: 'Enlightenment',
  author_name: 'Ritchie Robertson',
  google_books_id: null,
  cover_url: DEAD_COVER,
};

function googleResult(overrides: Record<string, unknown> = {}) {
  return {
    googleBooksId: 'abc',
    title: 'The Enlightenment: The Pursuit of Happiness',
    authors: ['Ritchie Robertson'],
    coverUrl: GOOGLE_COVER,
    ...overrides,
  };
}

/** Stands in for the HEAD request the model makes against the existing cover. */
function mockCoverReachable(reachable: boolean) {
  global.fetch = jest.fn().mockImplementation(() =>
    reachable ? Promise.resolve({ ok: true }) : Promise.reject(new Error('connect timeout')),
  ) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBookBySlug.mockResolvedValue(book);
  mockSetBookCover.mockResolvedValue(true);
  mockCacheGet.mockResolvedValue(null);
  mockSearchGoogleBooks.mockResolvedValue([googleResult()]);
  mockCoverReachable(false);
});

describe('repairCover', () => {
  it('replaces a dead cover with the Google one and writes it back', async () => {
    const result = await repairCover('enlightenment');

    expect(result).toEqual({ outcome: 'repaired', coverUrl: GOOGLE_COVER });
    expect(mockSetBookCover).toHaveBeenCalledWith(299, GOOGLE_COVER);
  });

  // The client's report is a trigger, not an instruction. Without this check
  // anyone could make the catalog churn by calling the endpoint in a loop.
  it('writes nothing when the existing cover answers after all', async () => {
    mockCoverReachable(true);

    const result = await repairCover('enlightenment');

    expect(result).toEqual({ outcome: 'alive', coverUrl: DEAD_COVER });
    expect(mockSearchGoogleBooks).not.toHaveBeenCalled();
    expect(mockSetBookCover).not.toHaveBeenCalled();
  });

  it('remembers a miss so a shelf of dead covers asks once per book', async () => {
    mockSearchGoogleBooks.mockResolvedValue([]);

    const result = await repairCover('enlightenment');

    expect(result).toEqual({ outcome: 'no_replacement' });
    expect(mockSetBookCover).not.toHaveBeenCalled();
    expect(mockCacheSet).toHaveBeenCalled();
  });

  it('does not search again once a miss is remembered', async () => {
    mockCacheGet.mockResolvedValue(true);

    const result = await repairCover('enlightenment');

    expect(result).toEqual({ outcome: 'no_replacement' });
    expect(mockSearchGoogleBooks).not.toHaveBeenCalled();
  });

  // A bare title search returns plausible books, not the right one. A different
  // edition's cover is the point; a different book's is the failure to avoid.
  it('rejects a result by another author', async () => {
    mockSearchGoogleBooks.mockResolvedValue([googleResult({ authors: ['Peter Gay'] })]);

    const result = await repairCover('enlightenment');

    expect(result).toEqual({ outcome: 'no_replacement' });
    expect(mockSetBookCover).not.toHaveBeenCalled();
  });

  it('rejects a result with an unrelated title', async () => {
    mockSearchGoogleBooks.mockResolvedValue([
      googleResult({ title: 'A History of the Peloponnesian War' }),
    ]);

    expect(await repairCover('enlightenment')).toEqual({ outcome: 'no_replacement' });
  });

  it('takes the subtitled edition, which is the same book', async () => {
    // "Enlightenment" against "The Enlightenment: The Pursuit of Happiness" --
    // a leading article and a subtitle are what a provider adds, not a
    // different book.
    expect(await repairCover('enlightenment')).toMatchObject({ outcome: 'repaired' });
  });

  it('asks for the exact edition when the book has a Google id', async () => {
    mockGetBookBySlug.mockResolvedValue({ ...book, google_books_id: 'gid' });
    mockGetGoogleBooksById.mockResolvedValue(googleResult({ coverUrl: GOOGLE_COVER }));

    const result = await repairCover('enlightenment');

    expect(mockGetGoogleBooksById).toHaveBeenCalledWith('gid');
    expect(mockSearchGoogleBooks).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: 'repaired', coverUrl: GOOGLE_COVER });
  });

  it('leaves the row alone when the provider itself fails', async () => {
    mockSearchGoogleBooks.mockRejectedValue(new Error('provider down'));

    expect(await repairCover('enlightenment')).toEqual({ outcome: 'no_replacement' });
    expect(mockSetBookCover).not.toHaveBeenCalled();
  });

  it('reports a book with no cover as nothing to repair', async () => {
    mockGetBookBySlug.mockResolvedValue({ ...book, cover_url: null });

    expect(await repairCover('enlightenment')).toEqual({ outcome: 'not_found' });
  });

  it('reports an unknown slug as nothing to repair', async () => {
    mockGetBookBySlug.mockResolvedValue(null);

    expect(await repairCover('nope')).toEqual({ outcome: 'not_found' });
  });
});
