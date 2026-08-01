import { searchBooks, matchLibraryEntries } from '../../../models/ai/search';
import * as aiData from '../../../data/ai-data';
import { searchWithFallback } from '../../../lib/books/search-with-fallback';
import { parseBooksProviderConfig } from '../../../lib/books/parse-books-provider-config';

jest.mock('../../../data/ai-data');
jest.mock('../../../lib/books/search-with-fallback');
jest.mock('../../../lib/books/parse-books-provider-config');

const mockMatchData = aiData.matchLibraryEntries as jest.Mock;
const mockMatchByTitleData = aiData.matchLibraryEntriesByTitle as jest.Mock;
const mockSearchWithFallback = searchWithFallback as jest.Mock;
const mockParseBooksProviderConfig = parseBooksProviderConfig as jest.Mock;

describe('searchBooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseBooksProviderConfig.mockReturnValue(['google_books', 'open_library']);
    mockSearchWithFallback.mockResolvedValue([]);
  });

  it('builds the provider chain from BOOKS_SEARCH_PROVIDERS and delegates to searchWithFallback', async () => {
    await searchBooks('cats', 5);

    expect(mockParseBooksProviderConfig).toHaveBeenCalledWith('BOOKS_SEARCH_PROVIDERS');
    expect(mockSearchWithFallback).toHaveBeenCalledWith(['google_books', 'open_library'], 'cats', 5);
  });

  it('returns whatever searchWithFallback resolves', async () => {
    const results = [{ title: 'Cat Science' }];
    mockSearchWithFallback.mockResolvedValue(results);

    expect(await searchBooks('cats', 5)).toBe(results);
  });

  it('clamps limit to max of 40', async () => {
    await searchBooks('q', 100);
    expect(mockSearchWithFallback).toHaveBeenCalledWith(['google_books', 'open_library'], 'q', 40);
  });

  it('clamps limit to min of 1', async () => {
    await searchBooks('q', 0);
    expect(mockSearchWithFallback).toHaveBeenCalledWith(['google_books', 'open_library'], 'q', 1);
  });
});

describe('matchLibraryEntries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchByTitleData.mockResolvedValue([]);
  });

  it('marks books as inLibrary when matched by googleBooksId', async () => {
    mockMatchData.mockResolvedValue([
      { google_books_id: 'gid1', isbn13: null, status: 'read' },
    ]);
    const books: any[] = [
      { googleBooksId: 'gid1', isbn13: null, inLibrary: false, libraryStatus: null, source: 'google_books' },
      { googleBooksId: 'gid2', isbn13: null, inLibrary: false, libraryStatus: null, source: 'google_books' },
    ];
    await matchLibraryEntries(1, books);
    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('read');
    expect(books[1].inLibrary).toBe(false);
  });

  it('marks books as inLibrary when matched by isbn13', async () => {
    mockMatchData.mockResolvedValue([
      { google_books_id: null, isbn13: '9781234567890', status: 'queued' },
    ]);
    const books: any[] = [
      { googleBooksId: 'unknown', isbn13: '9781234567890', inLibrary: false, libraryStatus: null, source: 'google_books' },
    ];
    await matchLibraryEntries(1, books);
    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('queued');
  });

  it('matches OpenLibrary books by isbn13 (googleBooksId is null)', async () => {
    mockMatchData.mockResolvedValue([
      { google_books_id: null, isbn13: '9789999999999', status: 'reading' },
    ]);
    const books: any[] = [
      { googleBooksId: null, isbn13: '9789999999999', inLibrary: false, libraryStatus: null, source: 'open_library' },
    ];
    await matchLibraryEntries(1, books);
    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('reading');
  });

  it('passes correct userId and id arrays to data layer', async () => {
    mockMatchData.mockResolvedValue([]);
    const books: any[] = [
      { googleBooksId: 'g1', isbn13: '111', inLibrary: false, libraryStatus: null, source: 'google_books' },
      { googleBooksId: 'g2', isbn13: null, inLibrary: false, libraryStatus: null, source: 'google_books' },
    ];
    await matchLibraryEntries(5, books);
    expect(mockMatchData).toHaveBeenCalledWith(5, ['g1', 'g2'], ['111']);
  });

  it('excludes null googleBooksId from the ids passed to data layer', async () => {
    mockMatchData.mockResolvedValue([]);
    const books: any[] = [
      { googleBooksId: null, isbn13: '9789999999999', inLibrary: false, libraryStatus: null, source: 'open_library' },
    ];
    await matchLibraryEntries(1, books);
    expect(mockMatchData).toHaveBeenCalledWith(1, [], ['9789999999999']);
  });

  // LLM suggestions arrive with no ids at all — the shape the id-only match
  // could never answer for, which is what took "In my library only" down.
  const llmBook = (title: string, author: string | null) => ({
    googleBooksId: null,
    isbn13: null,
    title,
    authors: author ? [author] : [],
    inLibrary: false,
    libraryStatus: null,
    source: 'gemini-3.1-flash-lite',
  });

  it('marks an id-less book as inLibrary when title and author match a library entry', async () => {
    mockMatchByTitleData.mockResolvedValue([
      { row_index: 0, book_id: 7, title: 'Cosmos', author_name: 'Carl Sagan', isbn13: null, status: 'read' },
    ]);
    const books: any[] = [llmBook('Cosmos', 'Carl Sagan')];

    await matchLibraryEntries(1, books);

    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('read');
  });

  it('skips the id query entirely when no book carries an id', async () => {
    const books: any[] = [llmBook('Cosmos', 'Carl Sagan')];

    await matchLibraryEntries(1, books);

    expect(mockMatchData).not.toHaveBeenCalled();
    expect(mockMatchByTitleData).toHaveBeenCalledWith({
      userId: 1,
      terms: ['cosmos'],
      phrases: ['cosmos'],
      limit: 5,
    });
  });

  it('matches when the LLM supplies a subtitle the catalog row omits', async () => {
    mockMatchByTitleData.mockResolvedValue([
      {
        row_index: 0,
        book_id: 339,
        title: "Broca's Brain",
        author_name: 'Carl Sagan',
        isbn13: null,
        status: 'queued',
      },
    ]);
    const books: any[] = [
      llmBook("Broca's Brain: Reflections on the Romance of Science", 'Carl Sagan'),
    ];

    await matchLibraryEntries(1, books);

    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('queued');
  });

  it('does not match when the author disagrees', async () => {
    mockMatchByTitleData.mockResolvedValue([
      { row_index: 0, book_id: 9, title: 'Contact', author_name: 'Jodie Foster', isbn13: null, status: 'read' },
    ]);
    const books: any[] = [llmBook('Contact', 'Carl Sagan')];

    await matchLibraryEntries(1, books);

    expect(books[0].inLibrary).toBe(false);
    expect(books[0].libraryStatus).toBeNull();
  });

  it('does not match when the titles are only loosely similar', async () => {
    mockMatchByTitleData.mockResolvedValue([
      {
        row_index: 0,
        book_id: 11,
        title: 'The Demon-Haunted World',
        author_name: 'Carl Sagan',
        isbn13: null,
        status: 'read',
      },
    ]);
    const books: any[] = [llmBook('The Dragons of Eden', 'Carl Sagan')];

    await matchLibraryEntries(1, books);

    expect(books[0].inLibrary).toBe(false);
  });

  it('does not match an id-less book whose author the LLM left out', async () => {
    mockMatchByTitleData.mockResolvedValue([
      { row_index: 0, book_id: 7, title: 'Cosmos', author_name: 'Carl Sagan', isbn13: null, status: 'read' },
    ]);
    const books: any[] = [llmBook('Cosmos', null)];

    await matchLibraryEntries(1, books);

    expect(books[0].inLibrary).toBe(false);
  });

  it('picks the best-scoring confirmed candidate among several', async () => {
    mockMatchByTitleData.mockResolvedValue([
      {
        row_index: 0,
        book_id: 1,
        title: 'Cosmos: A Personal Voyage Companion',
        author_name: 'Carl Sagan',
        isbn13: null,
        status: 'queued',
      },
      { row_index: 0, book_id: 2, title: 'Cosmos', author_name: 'Carl Sagan', isbn13: null, status: 'read' },
    ]);
    const books: any[] = [llmBook('Cosmos', 'Carl Sagan')];

    await matchLibraryEntries(1, books);

    expect(books[0].libraryStatus).toBe('read');
  });

  it('keeps row alignment when only some books need the title pass', async () => {
    mockMatchData.mockResolvedValue([{ google_books_id: 'gid1', isbn13: null, status: 'reading' }]);
    mockMatchByTitleData.mockResolvedValue([
      { row_index: 1, book_id: 7, title: 'Contact', author_name: 'Carl Sagan', isbn13: null, status: 'read' },
    ]);
    const books: any[] = [
      { ...llmBook('Cosmos', 'Carl Sagan'), googleBooksId: 'gid1' },
      llmBook('Pale Blue Dot', 'Carl Sagan'),
      llmBook('Contact', 'Carl Sagan'),
    ];

    await matchLibraryEntries(1, books);

    // The matched-by-id book is left out of the title pass, so row_index 1 is
    // the third book, not the second.
    expect(mockMatchByTitleData).toHaveBeenCalledWith(
      expect.objectContaining({ phrases: ['pale blue dot', 'contact'] }),
    );
    expect(books[0].libraryStatus).toBe('reading');
    expect(books[1].inLibrary).toBe(false);
    expect(books[2].libraryStatus).toBe('read');
  });

  it('marks a library entry with no status as owned', async () => {
    mockMatchByTitleData.mockResolvedValue([
      { row_index: 0, book_id: 7, title: 'Cosmos', author_name: 'Carl Sagan', isbn13: null, status: null },
    ]);
    const books: any[] = [llmBook('Cosmos', 'Carl Sagan')];

    await matchLibraryEntries(1, books);

    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBeNull();
  });

  it('issues no queries at all for an empty batch', async () => {
    await matchLibraryEntries(1, []);

    expect(mockMatchData).not.toHaveBeenCalled();
    expect(mockMatchByTitleData).not.toHaveBeenCalled();
  });
});
