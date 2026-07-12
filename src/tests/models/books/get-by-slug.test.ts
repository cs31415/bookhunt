import { resolveBookBySlug } from '../../../models/books/get-by-slug';
import * as booksData from '../../../data/books-data';
import { searchBooks } from '../../../models/ai/search';

jest.mock('../../../data/books-data');
jest.mock('../../../models/ai/search');

const mockGetBookBySlug = booksData.getBookBySlug as jest.Mock;
const mockSearchBooks = searchBooks as jest.Mock;

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
    mockSearchBooks.mockResolvedValue([
      {
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
        inLibrary: false,
        libraryStatus: null,
        source: 'google_books',
      },
    ]);

    const result = await resolveBookBySlug('economics-in-one-lesson', 'henry-hazlitt');

    expect(mockSearchBooks).toHaveBeenCalledWith('economics in one lesson by henry hazlitt', 1);
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
      cataloged: false,
    });
  });

  it('returns null when the live search also finds nothing', async () => {
    mockGetBookBySlug.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([]);

    const result = await resolveBookBySlug('unknown-book', 'unknown-author');

    expect(result).toBeNull();
  });
});
