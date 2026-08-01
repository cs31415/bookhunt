import { resolveImportRows } from '../../../models/import/resolve-rows';
import { getBooksProviderAdapter } from '../../../lib/books/get-books-provider-adapter';
import { searchBooks as searchCatalog } from '../../../models/search/search-books';
import { SearchResult } from '../../../lib/books/books-types';
import { BooksProviderError } from '../../../lib/books/books-provider-error';
import { primaryAttempts } from '../../../lib/books/books-retry-config';
import { resetCircuits } from '../../../lib/books/provider-circuit';

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
    resetCircuits();
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

    // An ISBN that Google cannot match still gets Google's fuzzy query before
    // the fallback: Google is the better provider, so it is worth a second ask
    // before paying Open Library's throttle for a worse answer.
    it('tries the fuzzy query then falls back by ISBN when the ISBN misses', async () => {
      googleSearch.mockResolvedValue([]);
      openLibrarySearch.mockResolvedValue([result({ openLibraryId: 'OL1M', title: 'Dune' })]);

      await resolveImportRows([{ title: 'Dune', isbn: '9780441013593' }], 1);

      expect(googleSearch).toHaveBeenNthCalledWith(1, 'isbn:9780441013593', 5);
      expect(googleSearch).toHaveBeenNthCalledWith(2, 'intitle:"Dune"', 5);
      expect(openLibrarySearch).toHaveBeenCalledWith('isbn:9780441013593', 5);
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

    // Every row of a Goodreads export carries both an ISBN and a publisher, and
    // Google routinely omits publisher from search results — so without this the
    // whole file serialises through Open Library's 1 req/sec throttle.
    it('does not consult Open Library to confirm a publisher the ISBN already settled', async () => {
      googleSearch.mockResolvedValue([
        result({ googleBooksId: 'g1', title: 'Dune', isbn13: '9780441013593' }),
      ]);

      await resolveImportRows([{ title: 'Dune', publisher: 'Ace', isbn: '9780441013593' }], 1);

      expect(openLibrarySearch).not.toHaveBeenCalled();
    });

    it('tolerates the ISBN-10/13 split when deciding the row is settled', async () => {
      googleSearch.mockResolvedValue([
        result({ googleBooksId: 'g1', title: 'Dune', isbn13: '9780441013593' }),
      ]);

      await resolveImportRows([{ title: 'Dune', publisher: 'Ace', isbn: '0441013597' }], 1);

      expect(openLibrarySearch).not.toHaveBeenCalled();
    });

    // A row whose ISBN nothing came back for is still unsettled: the publisher
    // is the only signal left, so it earns its throttle slot.
    it('still consults Open Library when no candidate carries the supplied ISBN', async () => {
      googleSearch.mockResolvedValue([
        result({ googleBooksId: 'g1', title: 'Dune', isbn13: '9999999999999' }),
      ]);

      await resolveImportRows([{ title: 'Dune', publisher: 'Ace', isbn: '9780441013593' }], 1);

      expect(openLibrarySearch).toHaveBeenCalled();
    });
  });

  // Google matches inpublisher against one publisher string per volume, so a
  // file naming a different-but-correct one excludes the book outright:
  // intitle:"Tools of Titans" inauthor:"Tim Ferriss" inpublisher:"HMH" returns
  // nothing, while the same query without the qualifier returns five. An author
  // narrows the search on its own, and scoreCandidate ranks by publisher after.
  it('narrows by author and leaves the publisher to local ranking', async () => {
    await resolveImportRows([{ title: 'Hong Kong', author: 'Reiber', publisher: "Frommer's" }], 1);

    expect(googleSearch).toHaveBeenCalledWith('intitle:"Hong Kong" inauthor:"Reiber"', 5);
  });

  // Without an author it is the only thing narrowing a generic title, which is
  // the case it was added for (LOS-168).
  it('narrows by publisher when the row has no author', async () => {
    await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(googleSearch).toHaveBeenCalledWith(
      'intitle:"Hong Kong" inpublisher:"Frommer\'s"',
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

  // Every row sent to Open Library costs a second of the import's wall clock, so
  // it goes only where the publisher is what identifies the book. A title and
  // author agreeing already identify it.
  describe('rows the author settles', () => {
    const cosmos = { title: 'Cosmos', author: 'Carl Sagan', publisher: 'Ballantine Books' };

    it('does not consult Open Library when title and author both match', async () => {
      googleSearch.mockResolvedValue([
        result({ googleBooksId: 'g1', title: 'Cosmos', authors: ['Carl Sagan'] }),
      ]);

      await resolveImportRows([cosmos], 1);

      expect(openLibrarySearch).not.toHaveBeenCalled();
    });

    // Google's publisher on search results routinely names another edition of
    // the right book, so a disagreement is not evidence of a wrong match.
    it('does not consult Open Library when the candidate names a different publisher', async () => {
      googleSearch.mockResolvedValue([
        result({
          googleBooksId: 'g1',
          title: 'Cosmos',
          authors: ['Carl Sagan'],
          publishers: ['Random House'],
        }),
      ]);

      await resolveImportRows([cosmos], 1);

      expect(openLibrarySearch).not.toHaveBeenCalled();
    });

    // The case the fallback exists for (LOS-168): dozens of editions share the
    // title, and with no author only the publisher tells them apart.
    it('still consults Open Library for an author-less row', async () => {
      googleSearch.mockResolvedValue([
        result({ googleBooksId: 'g1', title: 'Hong Kong', publishers: ['Lonely Planet'] }),
      ]);

      await resolveImportRows([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

      expect(openLibrarySearch).toHaveBeenCalled();
    });

    it('still consults Open Library when no candidate confirms the author', async () => {
      googleSearch.mockResolvedValue([
        result({ googleBooksId: 'g1', title: 'Cosmos', authors: ['Ann Druyan'] }),
      ]);

      await resolveImportRows([cosmos], 1);

      expect(openLibrarySearch).toHaveBeenCalled();
    });

    it('still consults Open Library when the candidate lists no author', async () => {
      googleSearch.mockResolvedValue([result({ googleBooksId: 'g1', title: 'Cosmos' })]);

      await resolveImportRows([cosmos], 1);

      expect(openLibrarySearch).toHaveBeenCalled();
    });

    it('still consults Open Library when the titles barely overlap', async () => {
      googleSearch.mockResolvedValue([
        result({ googleBooksId: 'g1', title: 'Chronicle', authors: ['Haruki Murakami'] }),
      ]);

      await resolveImportRows(
        [
          {
            title: 'The Wind-Up Bird Chronicle',
            author: 'Haruki Murakami',
            publisher: 'Vintage',
          },
        ],
        1,
      );

      expect(openLibrarySearch).toHaveBeenCalled();
    });
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

    // Retries are batch-level: a failing row goes onto a list and the pass moves
    // on, so healthy rows never wait behind a flaky one's backoff.
    describe('batch level', () => {
      it('retries only the rows that failed, not the whole batch', async () => {
        googleSearch.mockImplementation(async (query: string) => {
          if (!query.includes('Flaky')) return [result({ googleBooksId: 'ok', title: 'Fine' })];
          throw new BooksProviderError('google_books', 503);
        });

        await resolveImportRows([{ title: 'Fine One' }, { title: 'Flaky' }, { title: 'Fine Two' }], 1);

        const queried = googleSearch.mock.calls.map((c) => c[0] as string);
        // Two healthy rows asked once each; the failing one asked every round.
        expect(queried.filter((q) => q.includes('Fine One'))).toHaveLength(1);
        expect(queried.filter((q) => q.includes('Fine Two'))).toHaveLength(1);
        expect(queried.filter((q) => q.includes('Flaky'))).toHaveLength(primaryAttempts());
      });

      it('keeps a row that succeeds on a later round', async () => {
        let attempts = 0;
        googleSearch.mockImplementation(async () => {
          attempts += 1;
          if (attempts === 1) throw new BooksProviderError('google_books', 503);
          return [result({ googleBooksId: 'g1', title: 'India: A History' })];
        });

        const [row] = await resolveImportRows([{ title: 'India: a history' }], 1);

        expect(row.candidates[0].title).toBe('India: A History');
        expect(openLibrarySearch).not.toHaveBeenCalled();
      });

      it('preserves input order even when rows resolve across different rounds', async () => {
        googleSearch.mockImplementation(async (query: string) => {
          if (query.includes('Second')) throw new BooksProviderError('google_books', 503);
          return [result({ googleBooksId: 'ok', title: 'x' })];
        });

        const rows = await resolveImportRows(
          [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }],
          1,
        );

        expect(rows.map((r) => r.title)).toEqual(['First', 'Second', 'Third']);
      });

      // Google's free tier is 1,000 queries a day and a large import can spend
      // it. Once it starts refusing, retrying every row would burn the rest of
      // the budget learning the same thing.
      it('stops asking Google for the rest of the batch once it rations us', async () => {
        googleSearch.mockRejectedValue(new BooksProviderError('google_books', 429));
        openLibrarySearch.mockResolvedValue([result({ openLibraryId: 'OL1M', title: 'x' })]);

        const rows = Array.from({ length: 10 }, (_, i) => ({ title: `Book ${i}` }));
        await resolveImportRows(rows, 1);

        // Without the circuit this would be rows x primaryAttempts requests, all
        // failing. The circuit opens partway through the first round, so even
        // some of that round's rows never ask.
        expect(googleSearch.mock.calls.length).toBeLessThanOrEqual(rows.length);
        expect(googleSearch.mock.calls.length).toBeLessThan(rows.length * primaryAttempts());
        // Every row still gets an answer from the fallback.
        expect(openLibrarySearch).toHaveBeenCalledTimes(rows.length);
      });

      it('still returns fallback candidates while Google is rationing us', async () => {
        googleSearch.mockRejectedValue(new BooksProviderError('google_books', 429));
        openLibrarySearch.mockResolvedValue([result({ openLibraryId: 'OL1M', title: 'Dune' })]);

        const [row] = await resolveImportRows([{ title: 'Dune' }], 1);

        expect(row.candidates[0].openLibraryId).toBe('OL1M');
      });

      // A 503 is a blip, not a budget: those should still get their retries.
      it('keeps retrying a non-429 failure', async () => {
        googleSearch.mockRejectedValue(new BooksProviderError('google_books', 503));

        await resolveImportRows([{ title: 'Dune' }], 1);

        expect(googleSearch).toHaveBeenCalledTimes(primaryAttempts());
      });

      it('falls back for rows still failing after every round', async () => {
        googleSearch.mockImplementation(async (query: string) => {
          if (query.includes('Doomed')) throw new BooksProviderError('google_books', 503);
          return [result({ googleBooksId: 'ok', title: 'Fine' })];
        });
        openLibrarySearch.mockResolvedValue([result({ openLibraryId: 'OL1M', title: 'Doomed' })]);

        const rows = await resolveImportRows([{ title: 'Fine' }, { title: 'Doomed' }], 1);

        // Only the doomed row reaches Open Library's 1 req/sec queue.
        expect(openLibrarySearch).toHaveBeenCalledTimes(1);
        expect(rows[1].candidates[0].openLibraryId).toBe('OL1M');
      });
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

    // The catalog search already returned everything needed to render the book,
    // so a client holding only the id would have to ask for it straight back.
    it('returns the matched book ready to render', async () => {
      mockSearchCatalog.mockResolvedValue({
        books: [
          {
            book_id: 42,
            slug: 'dune',
            title: 'Dune',
            author_name: 'Frank Herbert',
            author_slug: 'frank-herbert',
            year: 1965,
            rating: '4.5',
            cover_url: 'https://example.test/dune.jpg',
            hue: '#6f7a55',
            publisher: 'Ace',
          },
        ],
      });

      const [row] = await resolveImportRows([{ title: 'Dune', author: 'Frank Herbert' }], 1);

      expect(row.matchedBook).toEqual({
        id: 42,
        slug: 'dune',
        title: 'Dune',
        authorName: 'Frank Herbert',
        authorSlug: 'frank-herbert',
        year: 1965,
        rating: '4.5',
        coverUrl: 'https://example.test/dune.jpg',
        hue: '#6f7a55',
      });
    });

    it('omits the matched book when nothing in the catalog matches', async () => {
      mockSearchCatalog.mockResolvedValue({ books: [] });

      const [row] = await resolveImportRows([{ title: 'Dune' }], 1);

      expect(row.matchedBook).toBeUndefined();
      expect(row.matchedBookId).toBeUndefined();
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

  // Re-importing an export against a library that already holds most of it is
  // the case this exists to serve: those rows render inert in the review list,
  // so any lookup spent on them is spent on something nobody will ever see.
  describe('rows already in the library', () => {
    const owned = {
      book_id: 42,
      title: 'Dune',
      author_name: 'Frank Herbert',
      publisher: 'Ace',
      in_library: true,
    };

    it('skips both providers entirely', async () => {
      mockSearchCatalog.mockResolvedValue({ books: [owned] });

      const [row] = await resolveImportRows([{ title: 'Dune', author: 'Frank Herbert' }], 1);

      expect(googleSearch).not.toHaveBeenCalled();
      expect(openLibrarySearch).not.toHaveBeenCalled();
      expect(row.matchedBookId).toBe(42);
      expect(row.candidates).toEqual([]);
    });

    it('still looks up a catalog match the caller does not own', async () => {
      mockSearchCatalog.mockResolvedValue({ books: [{ ...owned, in_library: false }] });

      const [row] = await resolveImportRows([{ title: 'Dune', author: 'Frank Herbert' }], 1);

      expect(googleSearch).toHaveBeenCalled();
      expect(row.matchedBookId).toBe(42);
    });

    // The client aligns results to CSV lines by index, so skipping a row must
    // not shift the ones around it.
    it('keeps unowned rows resolved and in position around a skipped one', async () => {
      mockSearchCatalog.mockImplementation(async (query: { q: string }) =>
        query.q === 'Dune' ? { books: [owned] } : { books: [] },
      );
      googleSearch.mockResolvedValue([result({ googleBooksId: 'g1', title: 'Hyperion' })]);

      const rows = await resolveImportRows(
        [{ title: 'Hyperion' }, { title: 'Dune' }, { title: 'Hyperion' }],
        1,
      );

      expect(googleSearch).toHaveBeenCalledTimes(2);
      expect(rows.map((row) => row.title)).toEqual(['Hyperion', 'Dune', 'Hyperion']);
      expect(rows[0].candidates).toHaveLength(1);
      expect(rows[1].candidates).toEqual([]);
      expect(rows[2].candidates).toHaveLength(1);
    });
  });
});
