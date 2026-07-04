import { detectBooksFromImage } from '../../../models/upload/scan';
import * as uploadData from '../../../data/upload-data';
import * as aiSearch from '../../../models/ai/search';

jest.mock('../../../lib/anthropic', () => ({
  anthropic: { messages: { create: jest.fn() } },
}));
jest.mock('../../../data/upload-data');
jest.mock('../../../models/ai/search');

const { anthropic } = require('../../../lib/anthropic');
const mockFindBookByTitle = uploadData.findBookByTitle as jest.Mock;
const mockSearchBooks = aiSearch.searchBooks as jest.Mock;

const googleBook = {
  googleBooksId: 'gb1',
  title: 'Cat Science',
  authors: ['Dr Cat'],
  year: 2020,
  publisher: null,
  pages: null,
  rating: null,
  coverUrl: null,
  isbn13: null,
  language: null,
  blurb: null,
  inLibrary: false,
  libraryStatus: null,
  source: 'google_books' as const,
};

const olBook = {
  googleBooksId: '',
  title: 'Marjada',
  authors: ['Arsha Sattar'],
  year: 2022,
  publisher: null,
  pages: null,
  rating: null,
  coverUrl: 'https://covers.openlibrary.org/b/id/99-M.jpg',
  isbn13: '9781234567890',
  language: null,
  blurb: null,
  inLibrary: false,
  libraryStatus: null,
  source: 'open_library' as const,
};

function mockClaude(books: { title: string; author: string | null }[]) {
  anthropic.messages.create.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(books) }],
  });
}

describe('detectBooksFromImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
  });

  it('returns matchedBookId for books already in DB, skipping search', async () => {
    mockClaude([{ title: 'Known Book', author: 'Author A' }]);
    mockFindBookByTitle.mockResolvedValue(42);

    const result = await detectBooksFromImage('img.jpg');

    expect(result).toEqual([{ title: 'Known Book', author: 'Author A', matchedBookId: 42 }]);
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('resolves unmatched books with "title by author" query when author present', async () => {
    mockClaude([{ title: 'Marjada', author: 'Arsha Sattar' }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([olBook]);

    const result = await detectBooksFromImage('img.jpg');

    expect(mockSearchBooks).toHaveBeenCalledWith('Marjada by Arsha Sattar', 1);
    expect((result[0] as any).resolvedBook).toMatchObject({ title: 'Marjada', source: 'open_library' });
  });

  it('resolves unmatched books with just title when author is null', async () => {
    mockClaude([{ title: 'Unknown Book', author: null }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([googleBook]);

    const result = await detectBooksFromImage('img.jpg');

    expect(mockSearchBooks).toHaveBeenCalledWith('Unknown Book', 1);
    expect((result[0] as any).resolvedBook).toMatchObject({ source: 'google_books' });
  });

  it('omits resolvedBook when search returns no results', async () => {
    mockClaude([{ title: 'Obscure Book', author: null }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([]);

    const result = await detectBooksFromImage('img.jpg');

    expect(result[0]).toEqual({ title: 'Obscure Book', author: null });
    expect(result[0]).not.toHaveProperty('resolvedBook');
  });

  it('handles a mix of DB-matched and search-resolved books', async () => {
    mockClaude([
      { title: 'Known', author: 'A' },
      { title: 'Marjada', author: 'Arsha Sattar' },
    ]);
    mockFindBookByTitle
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(null);
    mockSearchBooks.mockResolvedValue([olBook]);

    const result = await detectBooksFromImage('img.jpg');

    expect(result[0]).toEqual({ title: 'Known', author: 'A', matchedBookId: 10 });
    expect((result[1] as any).resolvedBook).toMatchObject({ source: 'open_library' });
    expect(mockSearchBooks).toHaveBeenCalledTimes(1);
  });

  it('processes books sequentially to respect OpenLibrary rate limit', async () => {
    const calls: number[] = [];
    mockClaude([
      { title: 'Book A', author: null },
      { title: 'Book B', author: null },
    ]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockSearchBooks.mockImplementation(async () => {
      calls.push(Date.now());
      return [];
    });

    await detectBooksFromImage('img.jpg');

    expect(mockSearchBooks).toHaveBeenCalledTimes(2);
    expect(mockSearchBooks).toHaveBeenNthCalledWith(1, 'Book A', 1);
    expect(mockSearchBooks).toHaveBeenNthCalledWith(2, 'Book B', 1);
  });

  it('returns empty array when Claude returns no books', async () => {
    mockClaude([]);
    const result = await detectBooksFromImage('img.jpg');
    expect(result).toEqual([]);
  });
});
