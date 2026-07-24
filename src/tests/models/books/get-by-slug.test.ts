import { resolveBookBySlug } from '../../../models/books/get-by-slug';
import * as booksData from '../../../data/books-data';
import { searchBooks } from '../../../models/ai/search';
import { getBooksProviderAdapter } from '../../../lib/books/get-books-provider-adapter';

jest.mock('../../../data/books-data');
jest.mock('../../../models/ai/search');
jest.mock('../../../lib/books/get-books-provider-adapter');

const mockGetBookBySlug = booksData.getBookBySlug as jest.Mock;
const mockSearchBooks = searchBooks as jest.Mock;
const mockGetBooksProviderAdapter = getBooksProviderAdapter as jest.Mock;

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

describe('resolveBookBySlug model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the catalog row with cataloged: true on an exact slug match', async () => {
    mockGetBookBySlug.mockResolvedValue({ id: 4, slug: 'economics-in-one-lesson', title: 'Economics in One Lesson' });

    const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

    expect(result).toEqual({
      id: 4,
      slug: 'economics-in-one-lesson',
      title: 'Economics in One Lesson',
      cataloged: true,
    });
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('returns null on a miss with no author hint', async () => {
    mockGetBookBySlug.mockResolvedValue(null);

    const result = await resolveBookBySlug('unknown-book');

    expect(result).toBeNull();
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('de-slugifies title and author into a search query and returns an ephemeral result on a miss with a hint', async () => {
    mockGetBookBySlug.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);

    const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

    expect(mockSearchBooks).toHaveBeenCalledWith('economics in one lesson henry hazlitt', 1);
    expect(result).toEqual({
      id: 0,
      slug: 'economics-in-one-lesson',
      title: 'Economics in One Lesson',
      author_id: 0,
      year: 1946,
      publisher: 'Harper',
      pages: 218,
      rating: 4.5,
      subjects: ['Economics'],
      moods: ['Rigorous'],
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
      cataloged: false,
    });
  });

  it('returns null when the live search also finds nothing', async () => {
    mockGetBookBySlug.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([]);

    const result = await resolveBookBySlug('unknown-book', 'unknown-author');

    expect(result).toBeNull();
  });

  describe('with a provider id hint', () => {
    it('fetches the exact edition by id instead of falling back to text search', async () => {
      mockGetBookBySlug.mockResolvedValue(null);
      const mockGetById = jest.fn().mockResolvedValue(SEARCH_RESULT_MATCH);
      mockGetBooksProviderAdapter.mockReturnValue({ getById: mockGetById });

      const result = await resolveBookBySlug('sapiens', 'yuval-noah-harari', {
        source: 'google_books',
        id: 'MosvEQAAQBAJ',
      });

      expect(mockGetBooksProviderAdapter).toHaveBeenCalledWith('google_books');
      expect(mockGetById).toHaveBeenCalledWith('MosvEQAAQBAJ');
      expect(mockSearchBooks).not.toHaveBeenCalled();
      expect(result?.google_books_id).toBe('gid');
      expect(result?.cataloged).toBe(false);
    });

    it('falls back to text search when getById returns null', async () => {
      mockGetBookBySlug.mockResolvedValue(null);
      const mockGetById = jest.fn().mockResolvedValue(null);
      mockGetBooksProviderAdapter.mockReturnValue({ getById: mockGetById });
      mockSearchBooks.mockResolvedValue([SEARCH_RESULT_MATCH]);

      const result = await resolveBookBySlug('sapiens', 'yuval-noah-harari', {
        source: 'google_books',
        id: 'missing-id',
      });

      expect(mockSearchBooks).toHaveBeenCalledWith('sapiens yuval noah harari', 1);
      expect(result?.google_books_id).toBe('gid');
    });

    it('falls back to text search when getById throws', async () => {
      mockGetBookBySlug.mockResolvedValue(null);
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
      mockGetBookBySlug.mockResolvedValue(null);
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
});
