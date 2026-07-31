import { resolveImportRows } from '../../../models/import/resolve-rows';
import { getBooksProviderAdapter } from '../../../lib/books/get-books-provider-adapter';
import { searchBooks as searchCatalog } from '../../../models/search/search-books';
import { SearchResult } from '../../../lib/books/books-types';
import { BooksProviderError } from '../../../lib/books/books-provider-error';
import { primaryAttempts } from '../../../lib/books/books-retry-config';

jest.mock('../../../lib/books/get-books-provider-adapter');
jest.mock('../../../models/search/search-books');

const mockGetAdapter = getBooksProviderAdapter as jest.Mock;
const mockSearchCatalog = searchCatalog as jest.Mock;

const googleSearch = jest.fn();
const openLibrarySearch = jest.fn();

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    googleBooksId: null,
    openLibraryId: null,
    title: 'Untitled',
    authors: [],
    year: null,
    publisher: null,
    publishers: [],
    pages: null,
    rating: null,
    coverUrl: null,
    isbn13: null,
    language: null,
    blurb: null,
    categories: [],
    moods: [],
    inLibrary: false,
    libraryStatus: null,
    source: 'google_books',
    ...overrides,
  };
}

describe('resolveImportRows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    googleSearch.mockResolvedValue([]);
    openLibrarySearch.mockResolvedValue([]);
    mockSearchCatalog.mockResolvedValue({ books: [] });
    mockGetAdapter.mockImplementation((provider: string) =>
      provider === 'google_books'
        ? { provider, search: googleSearch }
        : { provider, search: openLibrarySearch },
    );
  });

  describe('isbn', () => {
    // An ISBN names one edition, so there is nothing to disambiguate and no
    // reason to spend the fuzzy queries or Open Library's 1 req/sec throttle.
    it('queries by ISBN and skips the fuzzy search when it lands', async () => {
      googleSearch.mockResolvedValue([result({ googleBooksId: 'g1', title: 'Dune' })]);

      await resolveImportRows([{ title: 'Doon', isbn: '978-0-441-01359-3' }], 1);

      expect(googleSearch).toHaveBeenCalledTimes(1);
      expect(googleSearch).toHaveBeenCalledWith('isbn:9780441013593', 5);
      expect(openLibrarySearch).not.toHaveBeenCalled();
    });

    it('falls back to Open Library by ISBN before trying the fuzzy search', async () => {
      googleSearch.mockResolvedValue([]);
      openLibrarySearch.mockResolvedValue([result({ openLibraryId: 'OL1M', title: 'Dune' })]);

      await resolveImportRows([{ title: 'Dune', isbn: '9780441013593' }], 1);

      expect(openLibrarySearch).toHaveBeenCalledWith('isbn:9780441013593', 5);
      expect(googleSearch).toHaveBeenCalledTimes(1);
    });

    it('falls through to the fuzzy search when the ISBN finds nothing', async () => {
      googleSearch.mockResolvedValue([]);
      openLibrarySearch.mockResolvedValue([]);

      await resolveImportRows([{ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593' }], 1);

      expect(googleSearch).toHaveBeenCalledWith('isbn:9780441013593', 5);
      expect(googleSearch).toHaveBeenCalledWith('intitle:"Dune" inauthor:"Frank Herbert"', 5);
    });

    it('ignores an unparseable ISBN and searches normally', async () => {
      googleSearch.mockResolvedValue([result({ googleBooksId: 'g1', title: 'Dune' })]);

      await resolveImportRows([{ title: 'Dune', isbn: 'n/a' }], 1);

      expect(googleSearch).toHaveBeenCalledWith('intitle:"Dune"', 5);
    });

    it('echoes the normalised ISBN back on the row', async () => {
      googleSearch.mockResolvedValue([result({ googleBooksId: 'g1', title: 'Dune' })]);

      const [row] = await resolveImportRows([{ title: 'Dune', isbn: '978-0-441-01359-3' }], 1);

      expect(row.isbn).toBe('9780441013593');
    });

    it('ranks an ISBN match above a better-looking title match', async () => {
      googleSearch.mockResolvedValue([
        result({ googleBooksId: 'g1', title: 'Dune', isbn13: '9999999999999' }),
        result({ googleBooksId: 'g2', title: 'Dune Messiah', isbn13: '9780441013593' }),
      ]);

      const [row] = await resolveImportRows([{ title: 'Dune', isbn: '9780441013593' }], 1);

      expect(row.candidates[0].googleBooksId).toBe('g2');
    });
  });

  it('sends a fielded Google query using every hint supplied', async () => {
    await resolveImportRows([{ title: 'Hong Kong', author: 'Reiber', publisher: "Frommer's" }], 1);

    expect(googleSearch).toHaveBeenCalledWith(
      'intitle:"Hong Kong" inauthor:"Reiber" inpublisher:"Frommer\'s"',
      5,
    );
  });

  it('omits qualifiers for hints that were not supplied', async () => {
    await resolveImportRows([{ title: 'Dune' }], 1);

    expect(googleSearch).toHaveBeenCalledWith('intitle:"Dune"', 5);
  });

  it('does not consult Open Library when Google confirms the publisher', async () => {
    googleSearch.mockResolvedValue([
      result({ googleBooksId: 'g1', title: "Frommer's Hong Kong", publishers: ["Frommer's"] }),
    ]);

    await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(openLibrarySearch).not.toHaveBeenCalled();
  });

  // Open Library is throttled to 1 req/sec process-wide, so it must stay off the
  // common path — but it's the only provider that reliably reports publisher.
  it('consults Open Library when Google returns nothing confirming the publisher', async () => {
    googleSearch.mockResolvedValue([
      result({ googleBooksId: 'g1', title: 'Hong Kong', publishers: ['Lonely Planet'] }),
    ]);

    await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(openLibrarySearch).toHaveBeenCalledWith('title:"Hong Kong" publisher:"Frommer\'s"', 5);
  });

  it('consults Open Library when Google returns nothing at all', async () => {
    googleSearch.mockResolvedValue([]);

    await resolveImportRows([{ title: 'Obscure Title' }], 1);

    expect(openLibrarySearch).toHaveBeenCalled();
  });

  it('does not consult Open Library for a publisher-less row Google answered', async () => {
    googleSearch.mockResolvedValue([result({ googleBooksId: 'g1', title: 'Dune' })]);

    await resolveImportRows([{ title: 'Dune', author: 'Frank Herbert' }], 1);

    expect(openLibrarySearch).not.toHaveBeenCalled();
  });

  it('ranks the publisher-matching candidate first', async () => {
    googleSearch.mockResolvedValue([
      result({ googleBooksId: 'g1', title: 'Hong Kong', publishers: ['Lonely Planet'] }),
      result({ googleBooksId: 'g2', title: 'Hong Kong', publishers: ["Frommer's"] }),
    ]);

    const [row] = await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(row.candidates[0].googleBooksId).toBe('g2');
  });

  it('merges providers and collapses the same edition seen twice', async () => {
    googleSearch.mockResolvedValue([result({ googleBooksId: 'g1', title: 'Hong Kong' })]);
    openLibrarySearch.mockResolvedValue([
      result({ googleBooksId: 'g1', title: 'Hong Kong', source: 'open_library' }),
      result({ openLibraryId: 'OL1M', title: 'Hong Kong', source: 'open_library' }),
    ]);

    const [row] = await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(row.candidates).toHaveLength(2);
  });

  // publishers[0] is arbitrary across a work's editions, so a Frommer's guide can
  // report "Prentice-Hall" — the one publisher the caller did not ask about.
  it('displays the publisher the caller asked about, not just the first listed', async () => {
    googleSearch.mockResolvedValue([]);
    openLibrarySearch.mockResolvedValue([
      result({
        openLibraryId: 'OL1M',
        title: "Frommer's Hong Kong",
        publisher: 'Prentice-Hall',
        publishers: ['Prentice-Hall', 'Hungry Minds', "Frommer's"],
        source: 'open_library',
      }),
    ]);

    const [row] = await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(row.candidates[0].publisher).toBe("Frommer's");
  });

  it('matches a publisher spelled differently from the hint', async () => {
    googleSearch.mockResolvedValue([]);
    openLibrarySearch.mockResolvedValue([
      result({ openLibraryId: 'OL2M', title: 'Hong Kong', publisher: 'Wiley', publishers: ['Wiley', '*Frommers'] }),
    ]);

    const [row] = await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(row.candidates[0].publisher).toBe('*Frommers');
  });

  it('leaves the publisher alone when none of the work’s publishers match', async () => {
    googleSearch.mockResolvedValue([]);
    openLibrarySearch.mockResolvedValue([
      result({ openLibraryId: 'OL3M', title: 'Hong Kong', publisher: 'Lonely Planet', publishers: ['Lonely Planet'] }),
    ]);

    const [row] = await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(row.candidates[0].publisher).toBe('Lonely Planet');
  });

  it('caps candidates at five', async () => {
    googleSearch.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => result({ googleBooksId: `g${i}`, title: 'Hong Kong' })),
    );

    const [row] = await resolveImportRows([{ title: 'Hong Kong' }], 1);

    expect(row.candidates).toHaveLength(5);
  });

  it('echoes the hint back on each row, normalising blanks to null', async () => {
    const [row] = await resolveImportRows([{ title: 'Hong Kong', author: null }], 1);

    expect(row).toMatchObject({ title: 'Hong Kong', author: null, publisher: null });
  });

  it('preserves input order when rows resolve out of order', async () => {
    googleSearch.mockImplementation(async (query: string) => {
      await new Promise((r) => setTimeout(r, query.includes('First') ? 20 : 1));
      return [result({ googleBooksId: query, title: 'x' })];
    });

    const rows = await resolveImportRows(
      [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }],
      1,
    );

    expect(rows.map((r) => r.title)).toEqual(['First', 'Second', 'Third']);
  });

  describe('primary provider retries', () => {
    // A single transient 503 used to demote a lookup to Open Library and return
    // a visibly worse match for a book Google had all along ("India: a history").
    it('retries Google before falling back, and uses the retry that succeeds', async () => {
      googleSearch
        .mockRejectedValueOnce(new BooksProviderError('google_books', 503))
        .mockResolvedValueOnce([result({ googleBooksId: 'g1', title: 'India: A History' })]);

      const [row] = await resolveImportRows([{ title: 'India: a history' }], 1);

      expect(googleSearch).toHaveBeenCalledTimes(2);
      expect(openLibrarySearch).not.toHaveBeenCalled();
      expect(row.candidates[0].title).toBe('India: A History');
    });

    it('falls back only after the configured attempts are spent', async () => {
      googleSearch.mockRejectedValue(new BooksProviderError('google_books', 503));

      const [row] = await resolveImportRows([{ title: 'Dune' }], 1);

      expect(googleSearch).toHaveBeenCalledTimes(primaryAttempts());
      expect(openLibrarySearch).toHaveBeenCalled();
      expect(row.candidates).toEqual([]);
    });

    // An obscure title genuinely absent shouldn't cost N round trips to learn
    // what the first answer already said.
    it('does not retry when the provider legitimately found nothing', async () => {
      googleSearch.mockResolvedValue([]);

      await resolveImportRows([{ title: 'Nonexistent Xyzzy' }], 1);

      expect(googleSearch).toHaveBeenCalledTimes(1);
      expect(openLibrarySearch).toHaveBeenCalled();
    });

    it('gives the fallback a single attempt', async () => {
      googleSearch.mockRejectedValue(new BooksProviderError('google_books', 503));
      openLibrarySearch.mockRejectedValue(new BooksProviderError('open_library', 500));

      const [row] = await resolveImportRows([{ title: 'Dune' }], 1);

      expect(openLibrarySearch).toHaveBeenCalledTimes(1);
      expect(row.candidates).toEqual([]);
    });

    // A non-provider error is a bug in our own code, not a flaky network.
    it('does not swallow an unexpected error', async () => {
      googleSearch.mockRejectedValue(new TypeError('undefined is not a function'));

      await expect(resolveImportRows([{ title: 'Dune' }], 1)).rejects.toThrow(TypeError);
    });
  });

  describe('catalog matching', () => {
    it('sets matchedBookId when a catalog row matches well', async () => {
      mockSearchCatalog.mockResolvedValue({
        books: [{ book_id: 42, title: 'Dune', author_name: 'Frank Herbert', publisher: 'Ace' }],
      });

      const [row] = await resolveImportRows([{ title: 'Dune', author: 'Frank Herbert' }], 1);

      expect(row.matchedBookId).toBe(42);
    });

    it('leaves matchedBookId unset when the best catalog row is a weak match', async () => {
      mockSearchCatalog.mockResolvedValue({
        books: [{ book_id: 7, title: 'A History of Everything Else', author_name: 'Someone' }],
      });

      const [row] = await resolveImportRows([{ title: 'Hong Kong' }], 1);

      expect(row.matchedBookId).toBeUndefined();
    });

    it('prefers the publisher-matching catalog row among same-titled ones', async () => {
      mockSearchCatalog.mockResolvedValue({
        books: [
          { book_id: 1, title: 'Hong Kong', author_name: 'Piera Chen', publisher: 'Lonely Planet' },
          { book_id: 2, title: 'Hong Kong', author_name: 'Beth Reiber', publisher: "Frommer's" },
        ],
      });

      const [row] = await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

      expect(row.matchedBookId).toBe(2);
    });
  });
});
