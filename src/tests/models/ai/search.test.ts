import { searchBooks, matchLibraryEntries } from '../../../models/ai/search';
import * as aiData from '../../../data/ai-data';
import { searchWithFallback } from '../../../lib/books/search-with-fallback';
import { parseBooksProviderConfig } from '../../../lib/books/parse-books-provider-config';

jest.mock('../../../data/ai-data');
jest.mock('../../../lib/books/search-with-fallback');
jest.mock('../../../lib/books/parse-books-provider-config');

const mockMatchData = aiData.matchLibraryEntries as jest.Mock;
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
});
