import { findCatalogMatches } from '../../../models/import/find-catalog-matches';
import { matchImportRows } from '../../../data/import-data';

jest.mock('../../../data/import-data');

const mockMatchRows = matchImportRows as jest.Mock;

function row(overrides: Record<string, unknown>) {
  return {
    row_index: 0,
    book_id: 1,
    slug: 'a-book',
    title: 'A Book',
    author_name: 'Anon',
    author_slug: 'anon',
    year: 2000,
    rating: '4.0',
    cover_url: null,
    hue: '#6f7a55',
    publisher: null,
    isbn13: null,
    in_library: false,
    ...overrides,
  };
}

describe('findCatalogMatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMatchRows.mockResolvedValue([]);
  });

  // One query for the batch is the point: a 372-row import used to issue 372.
  it('asks the catalog once for the whole batch', async () => {
    await findCatalogMatches([{ title: 'Dune' }, { title: 'Hyperion' }], 7);

    expect(mockMatchRows).toHaveBeenCalledTimes(1);
    expect(mockMatchRows).toHaveBeenCalledWith({
      terms: ['dune', 'hyperion'],
      phrases: ['dune', 'hyperion'],
      userId: 7,
      limit: 5,
    });
  });

  // Stop words are dropped for scoring but must not leave a row searching for
  // nothing, which is what tokenizeQuery guarantees and what the SQL relies on.
  it('sends tokenised terms alongside the full phrase', async () => {
    await findCatalogMatches([{ title: 'The Origin of Species' }, { title: 'The' }], null);

    expect(mockMatchRows).toHaveBeenCalledWith(
      expect.objectContaining({
        terms: ['origin species', 'the'],
        phrases: ['the origin of species', 'the'],
      }),
    );
  });

  it('does not query at all for an empty batch', async () => {
    expect(await findCatalogMatches([], 1)).toEqual([]);
    expect(mockMatchRows).not.toHaveBeenCalled();
  });

  // The client aligns results to CSV lines by index, so a row that matches
  // nothing has to hold its place.
  it('returns one entry per hint, in order, with gaps preserved', async () => {
    mockMatchRows.mockResolvedValue([
      row({ row_index: 2, book_id: 30, title: 'Ubik' }),
      row({ row_index: 0, book_id: 10, title: 'Dune' }),
    ]);

    const matches = await findCatalogMatches(
      [{ title: 'Dune' }, { title: 'Nothing Here' }, { title: 'Ubik' }],
      1,
    );

    expect(matches.map((m) => m?.bookId ?? null)).toEqual([10, null, 30]);
  });

  it('picks the best-scoring candidate for its own row', async () => {
    mockMatchRows.mockResolvedValue([
      row({ row_index: 0, book_id: 1, title: 'Hong Kong', publisher: 'Lonely Planet' }),
      row({ row_index: 0, book_id: 2, title: 'Hong Kong', publisher: "Frommer's" }),
    ]);

    const [match] = await findCatalogMatches([{ title: 'Hong Kong', publisher: "Frommer's" }], 1);

    expect(match?.bookId).toBe(2);
  });

  it('rejects a candidate whose title is only loosely related', async () => {
    mockMatchRows.mockResolvedValue([
      row({ book_id: 9, title: 'A History of Everything Else' }),
    ]);

    const [match] = await findCatalogMatches([{ title: 'Hong Kong' }], 1);

    expect(match).toBeNull();
  });

  it('reports whether the caller already holds the book', async () => {
    mockMatchRows.mockResolvedValue([row({ book_id: 5, title: 'Dune', in_library: true })]);

    const [match] = await findCatalogMatches([{ title: 'Dune' }], 1);

    expect(match).toMatchObject({ bookId: 5, inLibrary: true });
  });

  it('returns the book ready to render', async () => {
    mockMatchRows.mockResolvedValue([
      row({
        book_id: 5,
        slug: 'dune',
        title: 'Dune',
        author_name: 'Frank Herbert',
        author_slug: 'frank-herbert',
        year: 1965,
        rating: '4.5',
        cover_url: 'https://example.test/dune.jpg',
      }),
    ]);

    const [match] = await findCatalogMatches([{ title: 'Dune' }], 1);

    expect(match?.book).toEqual({
      id: 5,
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
});
