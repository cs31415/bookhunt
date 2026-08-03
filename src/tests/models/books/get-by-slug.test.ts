import { resolveBookBySlug } from '../../../models/books/get-by-slug';
import * as booksData from '../../../data/books-data';
import { upsertBook } from '../../../data/library-data';
import { searchBooks } from '../../../models/ai/search';
import { getBooksProviderAdapter } from '../../../lib/books/get-books-provider-adapter';
import { cacheGet } from '../../../lib/cache/cache-get';
import { cacheSet } from '../../../lib/cache/cache-set';

jest.mock('../../../data/books-data');
jest.mock('../../../data/library-data');
jest.mock('../../../models/ai/search');
jest.mock('../../../lib/books/get-books-provider-adapter');
jest.mock('../../../lib/cache/cache-get');
jest.mock('../../../lib/cache/cache-set');

const mockGetBookBySlug = booksData.getBookBySlug as jest.Mock;
const mockUpsertBook = upsertBook as jest.Mock;
const mockSearchBooks = searchBooks as jest.Mock;
const mockGetBooksProviderAdapter = getBooksProviderAdapter as jest.Mock;
const mockCacheGet = cacheGet as jest.Mock;
const mockCacheSet = cacheSet as jest.Mock;
const mockEnrichThinBookRow = booksData.enrichThinBookRow as jest.Mock;

const SEARCH_RESULT_MATCH = {
  googleBooksId: 'gid',
  openLibraryId: null,
  title: 'Economics in One Lesson',
  authors: ['Henry Hazlitt'],
  year: 1946,
  publisher: 'Harper',
  pages: 218,
  rating: 4.5,
  coverUrl: 'https://x/y.jpg',
  isbn13: '9780000000000',
  language: 'en',
  blurb: 'A classic.',
  categories: ['Economics'],
  moods: ['Rigorous'],
  inLibrary: false,
  libraryStatus: null,
  source: 'google_books',
};

// The catalog projection (fn_get_book_by_slug) returned after the book is
// persisted - carries author_name/author_slug the raw upsert row lacks.
const CATALOG_ROW = {
  id: 7,
  slug: 'economics-in-one-lesson',
  title: 'Economics in One Lesson',
  author_id: 3,
  year: 1946,
  publisher: 'Harper',
  pages: 218,
  rating: 4.5,
  subjects: ['Economics'],
  moods: [],
  genres: [],
  themes: [],
  hue: '#6f7a55',
  blurb: 'A classic.',
  cover_url: 'https://x/y.jpg',
  google_books_id: 'gid',
  isbn13: '9780000000000',
  language: 'en',
  related: [],
  author_name: 'Henry Hazlitt',
  author_slug: 'henry-hazlitt',
};

describe('resolveBookBySlug model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
    mockEnrichThinBookRow.mockResolvedValue(true);
  });

  it('returns the catalog row with cataloged: true on an exact slug match', async () => {
    mockGetBookBySlug.mockResolvedValue({
      id: 4,
      slug: 'economics-in-one-lesson',
      title: 'Economics in One Lesson',
      author_slug: 'henry-hazlitt',
      // A provider id is what makes this a normally-cataloged book rather than
      // a thin one, which would be re-resolved (LOS-196). The edition fields are
      // present too, or it would be re-fetched for those instead (LOS-202).
      google_books_id: 'gid',
      blurb: 'A classic.',
      publisher: 'Harper',
      pages: 218,
    });

    const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

    expect(result).toEqual({
      id: 4,
      slug: 'economics-in-one-lesson',
      title: 'Economics in One Lesson',
      author_slug: 'henry-hazlitt',
      google_books_id: 'gid',
      blurb: 'A classic.',
      publisher: 'Harper',
      pages: 218,
      cataloged: true,
    });
    expect(mockSearchBooks).not.toHaveBeenCalled();
    expect(mockUpsertBook).not.toHaveBeenCalled();
  });

  it('ignores a catalog row whose author does not match the hint and resolves live instead', async () => {
    // The reported bug: /books/anthem?a=ayn-rand returned a cataloged
    // "Anthems and Anthem Composers" by an unrelated author that shares the slug.
    mockGetBookBySlug
      .mockResolvedValueOnce({
        id: 135,
        slug: 'anthem',
        title: 'Anthems and Anthem Composers',
        author_slug: 'myles-birket-foster',
      })
      .mockResolvedValueOnce({ ...CATALOG_ROW, slug: 'anthem', author_slug: 'ayn-rand' });
    mockSearchBooks.mockResolvedValue([
      { ...SEARCH_RESULT_MATCH, title: 'Anthem', authors: ['Ayn Rand'] },
    ]);
    mockUpsertBook.mockResolvedValue({ slug: 'anthem' });

    const result = await resolveBookBySlug('anthem', 'ayn-rand');

    // The slug-colliding catalog row is rejected; a live, author-narrowed
    // search resolves and persists the correct book.
    expect(mockSearchBooks).toHaveBeenCalledWith('anthem ayn rand', 5);
    expect(mockUpsertBook).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Anthem', authorName: 'Ayn Rand' }),
    );
    expect(result).toEqual(expect.objectContaining({ author_slug: 'ayn-rand', cataloged: true }));
  });

  it('prefers a candidate credited to the hinted author over a higher-ranked one', async () => {
    mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
    mockSearchBooks.mockResolvedValue([
      { ...SEARCH_RESULT_MATCH, title: 'Economics Explained', authors: ['Robert Heilbroner'] },
      SEARCH_RESULT_MATCH, // by Henry Hazlitt - matches the hint
    ]);
    mockUpsertBook.mockResolvedValue({ slug: 'economics-in-one-lesson' });

    await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

    expect(mockUpsertBook).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Economics in One Lesson', authorName: 'Henry Hazlitt' }),
    );
  });

  it('does a title-only provider search on a miss with no author hint, returning null when nothing matches', async () => {
    mockGetBookBySlug.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([]);

    const result = await resolveBookBySlug('unknown-book');

    // No ?a= hint: search by the deslugified title alone rather than 404ing early.
    expect(mockSearchBooks).toHaveBeenCalledWith('unknown book', 1);
    expect(result).toBeNull();
    expect(mockUpsertBook).not.toHaveBeenCalled();
  });

  it('resolves and persists via a title-only search when no author hint is given (LOS-155)', async () => {
    mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
    mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);
    mockUpsertBook.mockResolvedValue({ slug: 'economics-in-one-lesson' });

    const result = await resolveBookBySlug('economics-in-one-lesson');

    expect(mockSearchBooks).toHaveBeenCalledWith('economics in one lesson', 1);
    expect(mockUpsertBook).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'economics-in-one-lesson', authorName: 'Henry Hazlitt' }),
    );
    expect(result).toEqual({ ...CATALOG_ROW, cataloged: true });
  });

  it("persists 'Unknown' author when there's no hint and the match credits no author", async () => {
    mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
    mockSearchBooks.mockResolvedValue([{ ...SEARCH_RESULT_MATCH, authors: [] }]);
    mockUpsertBook.mockResolvedValue({ slug: 'economics-in-one-lesson' });

    await resolveBookBySlug('economics-in-one-lesson');

    expect(mockUpsertBook).toHaveBeenCalledWith(expect.objectContaining({ authorName: 'Unknown' }));
  });

  it('persists the resolved book and returns the catalog row on a miss with a hint', async () => {
    mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
    mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);
    mockUpsertBook.mockResolvedValue({ slug: 'economics-in-one-lesson' });

    const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

    expect(mockSearchBooks).toHaveBeenCalledWith('economics in one lesson henry hazlitt', 5);
    // The provider match is persisted via the shared upsert helper.
    expect(mockUpsertBook).toHaveBeenCalledWith({
      googleBooksId: 'gid',
      openLibraryId: null,
      source: 'google_books',
      slug: 'economics-in-one-lesson',
      title: 'Economics in One Lesson',
      authorName: 'Henry Hazlitt',
      year: 1946,
      publisher: 'Harper',
      pages: 218,
      rating: 4.5,
      subjects: ['Economics'],
      blurb: 'A classic.',
      coverUrl: 'https://x/y.jpg',
      isbn13: '9780000000000',
      language: 'en',
    });
    // The response is the catalog projection re-read by the persisted slug.
    expect(mockGetBookBySlug).toHaveBeenLastCalledWith('economics-in-one-lesson');
    expect(result).toEqual({ ...CATALOG_ROW, cataloged: true });
  });

  it('persists under an open_library source when only an openLibraryId is present', async () => {
    mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
    mockSearchBooks.mockResolvedValue([
      { ...SEARCH_RESULT_MATCH, googleBooksId: null, openLibraryId: 'OL1W', source: 'open_library' },
    ]);
    mockUpsertBook.mockResolvedValue({ slug: 'economics-in-one-lesson' });

    await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

    expect(mockUpsertBook).toHaveBeenCalledWith(
      expect.objectContaining({ googleBooksId: null, openLibraryId: 'OL1W', source: 'open_library' }),
    );
  });

  it('falls back to the deslugified author-slug hint when the match credits no author', async () => {
    mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
    mockSearchBooks.mockResolvedValue([{ ...SEARCH_RESULT_MATCH, authors: [] }]);
    mockUpsertBook.mockResolvedValue({ slug: 'economics-in-one-lesson' });

    await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

    expect(mockUpsertBook).toHaveBeenCalledWith(expect.objectContaining({ authorName: 'henry hazlitt' }));
  });

  it('returns null when the live search also finds nothing', async () => {
    mockGetBookBySlug.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([]);

    const result = await resolveBookBySlug('unknown-book', 'unknown-author');

    expect(result).toBeNull();
    expect(mockUpsertBook).not.toHaveBeenCalled();
  });

  describe('with a provider id hint', () => {
    it('fetches the exact edition by id instead of falling back to text search', async () => {
      mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
      mockUpsertBook.mockResolvedValue({ slug: 'sapiens' });
      const mockGetById = jest.fn().mockResolvedValue(SEARCH_RESULT_MATCH);
      mockGetBooksProviderAdapter.mockReturnValue({ getById: mockGetById });

      const result = await resolveBookBySlug('sapiens', 'yuval-noah-harari', {
        source: 'google_books',
        id: 'MosvEQAAQBAJ',
      });

      expect(mockGetBooksProviderAdapter).toHaveBeenCalledWith('google_books');
      expect(mockGetById).toHaveBeenCalledWith('MosvEQAAQBAJ');
      expect(mockSearchBooks).not.toHaveBeenCalled();
      expect(mockUpsertBook).toHaveBeenCalled();
      expect(result?.google_books_id).toBe('gid');
      expect(result?.cataloged).toBe(true);
    });

    it('falls back to text search when getById returns null', async () => {
      mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
      mockUpsertBook.mockResolvedValue({ slug: 'sapiens' });
      const mockGetById = jest.fn().mockResolvedValue(null);
      mockGetBooksProviderAdapter.mockReturnValue({ getById: mockGetById });
      mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);

      const result = await resolveBookBySlug('sapiens', 'yuval-noah-harari', {
        source: 'google_books',
        id: 'missing-id',
      });

      expect(mockSearchBooks).toHaveBeenCalledWith('sapiens yuval noah harari', 5);
      expect(result?.google_books_id).toBe('gid');
    });

    it('falls back to text search when getById throws', async () => {
      mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
      mockUpsertBook.mockResolvedValue({ slug: 'sapiens' });
      const mockGetById = jest.fn().mockRejectedValue(new Error('network error'));
      mockGetBooksProviderAdapter.mockReturnValue({ getById: mockGetById });
      mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);

      const result = await resolveBookBySlug('sapiens', 'yuval-noah-harari', {
        source: 'google_books',
        id: 'bad-id',
      });

      expect(mockSearchBooks).toHaveBeenCalled();
      expect(result?.google_books_id).toBe('gid');
    });

    it('falls back to text search when the adapter has no getById', async () => {
      mockGetBookBySlug.mockResolvedValueOnce(null).mockResolvedValueOnce(CATALOG_ROW);
      mockUpsertBook.mockResolvedValue({ slug: 'sapiens' });
      mockGetBooksProviderAdapter.mockReturnValue({});
      mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);

      const result = await resolveBookBySlug('sapiens', 'yuval-noah-harari', {
        source: 'open_library',
        id: 'OL123M',
      });

      expect(mockSearchBooks).toHaveBeenCalled();
      expect(result?.google_books_id).toBe('gid');
    });
  });

  // A book created from a title and an author alone, by an import row that
  // matched no provider (LOS-196). The live-resolve path above only runs on a
  // catalog miss, and a thin row is a hit -- so without this it would stay a
  // bare title forever.
  describe('a thin book, carrying no provider id', () => {
    const THIN_ROW = {
      id: 12,
      slug: 'economics-in-one-lesson',
      title: 'Economics in One Lesson',
      author_name: 'Henry Hazlitt',
      author_slug: 'henry-hazlitt',
      google_books_id: null,
      openlibrary_id: null,
      subjects: [],
    };

    it('looks it up again and folds in what the provider had', async () => {
      mockGetBookBySlug.mockResolvedValueOnce(THIN_ROW).mockResolvedValueOnce(CATALOG_ROW);
      mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);

      const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

      expect(mockEnrichThinBookRow).toHaveBeenCalledWith(
        12,
        expect.objectContaining({ googleBooksId: 'gid', coverUrl: 'https://x/y.jpg' }),
      );
      expect(result?.google_books_id).toBe('gid');
      expect(result?.cataloged).toBe(true);
    });

    // upsertBook matches on provider id, which a thin row has none of, so it
    // takes the INSERT branch and stores a *second* book under a suffixed slug
    // while the row the library entry points at stays thin. Caught end-to-end;
    // this pins it.
    it('updates the existing row rather than inserting a second book', async () => {
      mockGetBookBySlug.mockResolvedValueOnce(THIN_ROW).mockResolvedValueOnce(CATALOG_ROW);
      mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);

      await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

      expect(mockUpsertBook).not.toHaveBeenCalled();
      expect(mockEnrichThinBookRow).toHaveBeenCalledWith(12, expect.anything());
    });

    // Another book already holds that provider id, so this thin row duplicates
    // one the catalog has properly. Merging them is a bigger job.
    it('leaves the row alone and remembers the miss when the provider id is taken', async () => {
      mockGetBookBySlug.mockResolvedValue(THIN_ROW);
      mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);
      mockEnrichThinBookRow.mockResolvedValue(false);

      const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

      expect(mockCacheSet).toHaveBeenCalledWith(expect.stringContaining('books:resolve-miss'), true, expect.any(Number));
      expect(result?.id).toBe(12);
    });

    it('remembers a miss so the next view costs nothing', async () => {
      mockGetBookBySlug.mockResolvedValue(THIN_ROW);
      mockSearchBooks.mockResolvedValue([]);

      const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

      expect(mockEnrichThinBookRow).not.toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalledWith(expect.stringContaining('books:resolve-miss'), true, expect.any(Number));
      // Still a usable page: the thin book itself.
      expect(result?.id).toBe(12);
    });

    it('does not ask again while a miss is remembered', async () => {
      mockGetBookBySlug.mockResolvedValue(THIN_ROW);
      mockCacheGet.mockResolvedValue(true);

      const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

      expect(mockSearchBooks).not.toHaveBeenCalled();
      expect(result?.id).toBe(12);
    });

    // A provider being down must not take the detail page with it, and must not
    // be remembered as "no such book" either.
    it('returns the thin book and forgets nothing when the lookup throws', async () => {
      mockGetBookBySlug.mockResolvedValue(THIN_ROW);
      mockSearchBooks.mockRejectedValue(new Error('provider down'));

      const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

      expect(result?.id).toBe(12);
      expect(mockCacheSet).not.toHaveBeenCalled();
    });
  });
});

/**
 * A book catalogued from a search result: it knows its edition, but the search
 * response never carried the publisher, and an import does not stop to fetch it
 * (LOS-202). The blanks are filled the first time someone opens the book.
 */
describe('filling edition details on first view', () => {
  const IMPORTED = {
    id: 7,
    slug: 'dune',
    title: 'Dune',
    author_slug: 'frank-herbert',
    google_books_id: 'gid',
    openlibrary_id: null,
    blurb: '',
    publisher: null,
    pages: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    mockEnrichThinBookRow.mockResolvedValue(true);
  });

  it('fetches the edition by id rather than searching again', async () => {
    const getEditionDetails = jest
      .fn()
      .mockResolvedValue({ description: 'A classic.', publisher: 'Ace', pages: 412 });
    mockGetBooksProviderAdapter.mockReturnValue({ getEditionDetails });
    mockGetBookBySlug
      .mockResolvedValueOnce(IMPORTED)
      .mockResolvedValueOnce({ ...IMPORTED, blurb: 'A classic.', publisher: 'Ace', pages: 412 });

    const result = await resolveBookBySlug('dune');

    expect(getEditionDetails).toHaveBeenCalledWith('gid');
    expect(mockSearchBooks).not.toHaveBeenCalled();
    expect(mockEnrichThinBookRow).toHaveBeenCalledWith(7, {
      blurb: 'A classic.',
      publisher: 'Ace',
      pages: 412,
    });
    expect(result).toMatchObject({ publisher: 'Ace', pages: 412 });
  });

  it('leaves a complete book alone', async () => {
    const getEditionDetails = jest.fn();
    mockGetBooksProviderAdapter.mockReturnValue({ getEditionDetails });
    mockGetBookBySlug.mockResolvedValue({
      ...IMPORTED,
      blurb: 'Already here.',
      publisher: 'Ace',
      pages: 412,
    });

    await resolveBookBySlug('dune');

    expect(getEditionDetails).not.toHaveBeenCalled();
  });

  // Otherwise a book the provider has nothing more to say about costs a request
  // on every single view.
  it('remembers a miss instead of asking again', async () => {
    const getEditionDetails = jest
      .fn()
      .mockResolvedValue({ description: null, publisher: null, pages: null });
    mockGetBooksProviderAdapter.mockReturnValue({ getEditionDetails });
    mockGetBookBySlug.mockResolvedValue(IMPORTED);

    await resolveBookBySlug('dune');

    expect(mockCacheSet).toHaveBeenCalled();
    expect(mockEnrichThinBookRow).not.toHaveBeenCalled();
  });

  it('does not ask again once a miss is remembered', async () => {
    const getEditionDetails = jest.fn();
    mockGetBooksProviderAdapter.mockReturnValue({ getEditionDetails });
    mockGetBookBySlug.mockResolvedValue(IMPORTED);
    mockCacheGet.mockResolvedValue(true);

    await resolveBookBySlug('dune');

    expect(getEditionDetails).not.toHaveBeenCalled();
  });

  // A provider being down must not take the detail page with it.
  it('returns the book unchanged when the provider throws', async () => {
    mockGetBooksProviderAdapter.mockReturnValue({
      getEditionDetails: jest.fn().mockRejectedValue(new Error('down')),
    });
    mockGetBookBySlug.mockResolvedValue(IMPORTED);

    const result = await resolveBookBySlug('dune');

    expect(result).toMatchObject({ slug: 'dune', cataloged: true });
    expect(mockEnrichThinBookRow).not.toHaveBeenCalled();
  });
});
