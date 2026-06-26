import { searchBooks, matchLibraryEntries } from '../../../models/ai/search';
import * as aiData from '../../../data/ai-data';

jest.mock('../../../data/ai-data');

const mockMatchData = aiData.matchLibraryEntries as jest.Mock;

describe('searchBooks', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns empty array when fetch throws', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network'));
    expect(await searchBooks('cats', 5)).toEqual([]);
  });

  it('returns empty array when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    expect(await searchBooks('cats', 5)).toEqual([]);
  });

  it('returns empty array when API returns no items', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    expect(await searchBooks('unknown', 5)).toEqual([]);
  });

  it('maps Google Books API response to SearchResult shape', async () => {
    const item = {
      id: 'abc123',
      volumeInfo: {
        title: 'Cat Science',
        authors: ['Dr Cat'],
        publishedDate: '2020-05-10',
        publisher: 'CatPress',
        pageCount: 200,
        averageRating: 4.5,
        imageLinks: { thumbnail: 'http://example.com/cover.jpg' },
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781234567890' }],
        language: 'en',
        description: 'About cats',
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [item] }),
    });

    const result = await searchBooks('cats', 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      googleBooksId: 'abc123',
      title: 'Cat Science',
      authors: ['Dr Cat'],
      year: 2020,
      publisher: 'CatPress',
      pages: 200,
      rating: 4.5,
      coverUrl: 'https://example.com/cover.jpg',
      isbn13: '9781234567890',
      language: 'en',
      blurb: 'About cats',
      inLibrary: false,
      libraryStatus: null,
    });
  });

  it('upgrades cover URL from http to https', async () => {
    const item = {
      id: 'x',
      volumeInfo: {
        imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
      },
    };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ items: [item] }),
    });
    const [book] = await searchBooks('x', 1);
    expect(book.coverUrl).toMatch(/^https:/);
  });

  it('clamps limit to max of 40', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await searchBooks('q', 100);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('maxResults=40');
  });

  it('clamps limit to min of 1', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    await searchBooks('q', 0);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('maxResults=1');
  });
});

describe('matchLibraryEntries', () => {
  it('marks books as inLibrary when matched by googleBooksId', async () => {
    mockMatchData.mockResolvedValue([
      { google_books_id: 'gid1', isbn13: null, status: 'read' },
    ]);
    const books: any[] = [
      { googleBooksId: 'gid1', isbn13: null, inLibrary: false, libraryStatus: null },
      { googleBooksId: 'gid2', isbn13: null, inLibrary: false, libraryStatus: null },
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
      { googleBooksId: 'unknown', isbn13: '9781234567890', inLibrary: false, libraryStatus: null },
    ];
    await matchLibraryEntries(1, books);
    expect(books[0].inLibrary).toBe(true);
    expect(books[0].libraryStatus).toBe('queued');
  });

  it('passes correct userId and id arrays to data layer', async () => {
    mockMatchData.mockResolvedValue([]);
    const books: any[] = [
      { googleBooksId: 'g1', isbn13: '111', inLibrary: false, libraryStatus: null },
      { googleBooksId: 'g2', isbn13: null, inLibrary: false, libraryStatus: null },
    ];
    await matchLibraryEntries(5, books);
    expect(mockMatchData).toHaveBeenCalledWith(5, ['g1', 'g2'], ['111']);
  });
});
