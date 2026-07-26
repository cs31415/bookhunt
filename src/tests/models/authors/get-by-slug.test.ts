import { resolveProviderAuthor } from '../../../models/authors/get-by-slug';
import { searchBooks, matchLibraryEntries } from '../../../models/ai/search';
import { getAuthorDetailsWithFallback } from '../../../lib/books/get-author-details-with-fallback';
import { generateAuthorDetails } from '../../../models/ai/get-author-details';
import { parseBooksProviderConfig } from '../../../lib/books/parse-books-provider-config';
import { createAuthor } from '../../../data/authors-data';

jest.mock('../../../models/ai/search');
jest.mock('../../../lib/books/get-author-details-with-fallback');
jest.mock('../../../models/ai/get-author-details');
jest.mock('../../../lib/books/parse-books-provider-config');
jest.mock('../../../data/authors-data');

const mockSearchBooks = searchBooks as jest.Mock;
const mockMatchLibraryEntries = matchLibraryEntries as jest.Mock;
const mockGetAuthorDetailsWithFallback = getAuthorDetailsWithFallback as jest.Mock;
const mockGenerateAuthorDetails = generateAuthorDetails as jest.Mock;
const mockParseBooksProviderConfig = parseBooksProviderConfig as jest.Mock;
const mockCreateAuthor = createAuthor as jest.Mock;

function makeResult(overrides: Record<string, unknown> = {}) {
  return {
    googleBooksId: 'g1',
    openLibraryId: null,
    title: 'Your Inner Fish',
    authors: ['Neil Shubin'],
    year: 2008,
    publisher: 'Pantheon',
    pages: 237,
    rating: 4.2,
    coverUrl: 'https://x/y.jpg',
    isbn13: '9780000000001',
    language: 'en',
    blurb: 'Evolution and the human body.',
    categories: ['Science'],
    moods: ['Informative'],
    inLibrary: false,
    libraryStatus: null,
    source: 'google_books',
    ...overrides,
  };
}

describe('resolveProviderAuthor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseBooksProviderConfig.mockReturnValue(['google_books', 'open_library']);
    mockGetAuthorDetailsWithFallback.mockResolvedValue({ birthYear: null, bio: null });
    mockGenerateAuthorDetails.mockResolvedValue({ birthYear: null, country: null, bio: null });
    // Echo the persisted row back the way the stored proc would, with a real id.
    mockCreateAuthor.mockImplementation(async ({ slug, name, birthYear, country, bio }) => ({
      id: 101,
      slug,
      name,
      birth_year: birthYear,
      country,
      bio,
    }));
  });

  it('returns null (→ 404) when no provider knows the author', async () => {
    mockSearchBooks.mockResolvedValue([]);

    const result = await resolveProviderAuthor('nobody-at-all');

    expect(mockSearchBooks).toHaveBeenCalledWith('inauthor:"nobody at all"', 40);
    expect(result).toBeNull();
  });

  it('returns null for an empty slug without hitting the provider', async () => {
    const result = await resolveProviderAuthor('');

    expect(result).toBeNull();
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('resolves a provider author by slug, enriching details and returning works', async () => {
    mockSearchBooks.mockResolvedValue([makeResult(), makeResult({ googleBooksId: 'g2', title: 'The Universe Within' })]);
    mockGetAuthorDetailsWithFallback.mockResolvedValue({ birthYear: 1960, bio: 'A paleontologist.' });
    mockGenerateAuthorDetails.mockResolvedValue({ birthYear: null, country: 'United States', bio: null });

    const result = await resolveProviderAuthor('neil-shubin');

    expect(result?.author).toEqual({
      id: 101,
      slug: 'neil-shubin',
      name: 'Neil Shubin',
      birth_year: 1960,
      country: 'United States',
      bio: 'A paleontologist.',
    });
    // The resolved author is persisted so later requests hit the catalog path.
    expect(mockCreateAuthor).toHaveBeenCalledWith({
      slug: 'neil-shubin',
      name: 'Neil Shubin',
      birthYear: 1960,
      country: 'United States',
      bio: 'A paleontologist.',
    });
    expect(result?.books).toHaveLength(2);
    // Provider works carry no catalog identity.
    expect(result?.books.every((b) => b.bookId === null && b.slug === null)).toBe(true);
    // Country isn't returned by provider adapters, so AI fills the gap.
    expect(mockGenerateAuthorDetails).toHaveBeenCalledWith('Neil Shubin', {
      birthYear: 1960,
      country: null,
      bio: 'A paleontologist.',
    });
  });

  it('recovers the canonical name from the credited author matching the slug', async () => {
    // The de-slugified query is lowercase; the credited name restores casing.
    mockSearchBooks.mockResolvedValue([
      makeResult({ authors: ['Some Co-Author'] }),
      makeResult({ authors: ['Neil Shubin'] }),
      makeResult({ authors: ['Neil Shubin'] }),
    ]);

    const result = await resolveProviderAuthor('neil-shubin');

    expect(result?.author.name).toBe('Neil Shubin');
  });

  it('marks library matches and orders in-library works first', async () => {
    mockSearchBooks.mockResolvedValue([
      makeResult({ googleBooksId: 'g1', title: 'First' }),
      makeResult({ googleBooksId: 'g2', title: 'Owned' }),
    ]);
    mockMatchLibraryEntries.mockImplementation((_userId: number, books: any[]) => {
      books[1].inLibrary = true;
      books[1].libraryStatus = 'reading';
    });

    const result = await resolveProviderAuthor('neil-shubin', 42);

    expect(mockMatchLibraryEntries).toHaveBeenCalledWith(42, expect.any(Array));
    expect(result?.books[0].title).toBe('Owned');
    expect(result?.books[0].inLibrary).toBe(true);
  });

  it('degrades to null details (still returning works) when enrichment fails', async () => {
    mockSearchBooks.mockResolvedValue([makeResult()]);
    mockGetAuthorDetailsWithFallback.mockRejectedValue(new Error('provider down'));

    const result = await resolveProviderAuthor('neil-shubin');

    expect(result?.author).toEqual({
      id: 101,
      slug: 'neil-shubin',
      name: 'Neil Shubin',
      birth_year: null,
      country: null,
      bio: null,
    });
    // Still persisted (with null details) so the row exists for later top-up.
    expect(mockCreateAuthor).toHaveBeenCalledWith({
      slug: 'neil-shubin',
      name: 'Neil Shubin',
      birthYear: null,
      country: null,
      bio: null,
    });
    expect(result?.books).toHaveLength(1);
  });
});
