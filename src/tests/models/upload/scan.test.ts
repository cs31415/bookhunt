import { detectBooksFromImages } from '../../../models/upload/scan';
import * as uploadData from '../../../data/upload-data';
import * as aiSearch from '../../../models/ai/search';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));
jest.mock('../../../lib/s3', () => ({
  getS3: jest.fn(() => ({})),
}));
jest.mock('../../../lib/anthropic', () => ({
  getAnthropic: jest.fn(),
}));
jest.mock('../../../data/upload-data');
jest.mock('../../../models/ai/search');

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getAnthropic } from '../../../lib/anthropic';

const mockGetSignedUrl = getSignedUrl as jest.Mock;
const mockGetAnthropic = getAnthropic as jest.Mock;
const mockFindBookByTitle = uploadData.findBookByTitle as jest.Mock;
const mockSearchBooks = aiSearch.searchBooks as jest.Mock;

const googleBook = {
  googleBooksId: 'gb1', title: 'Cat Science', authors: ['Dr Cat'], year: 2020,
  publisher: null, pages: null, rating: null, coverUrl: null, isbn13: null,
  language: null, blurb: null, inLibrary: false, libraryStatus: null,
  source: 'google_books' as const,
};

const olBook = {
  googleBooksId: '', title: 'Marjada', authors: ['Arsha Sattar'], year: 2022,
  publisher: null, pages: null, rating: null,
  coverUrl: 'https://covers.openlibrary.org/b/id/99-M.jpg',
  isbn13: '9781234567890', language: null, blurb: null,
  inLibrary: false, libraryStatus: null, source: 'open_library' as const,
};

function makeAnthropicResponse(books: { title: string; author: string | null }[]) {
  const mockCreate = jest.fn().mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(books) }],
  });
  mockGetAnthropic.mockReturnValue({ messages: { create: mockCreate } });
  return mockCreate;
}

describe('detectBooksFromImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    mockGetSignedUrl.mockResolvedValue('https://s3.example.com/img');
    mockSearchBooks.mockResolvedValue([]);
  });

  it('generates a signed URL for each image key', async () => {
    mockGetSignedUrl
      .mockResolvedValueOnce('https://s3.example.com/img1')
      .mockResolvedValueOnce('https://s3.example.com/img2');
    makeAnthropicResponse([]);
    await detectBooksFromImages(['uploads/1/a', 'uploads/1/b']);
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('sends one image block per key to Claude', async () => {
    mockGetSignedUrl
      .mockResolvedValueOnce('https://s3.example.com/img1')
      .mockResolvedValueOnce('https://s3.example.com/img2');
    const mockCreate = makeAnthropicResponse([]);
    await detectBooksFromImages(['uploads/1/a', 'uploads/1/b']);
    const content = mockCreate.mock.calls[0][0].messages[0].content;
    const imageBlocks = content.filter((b: { type: string }) => b.type === 'image');
    expect(imageBlocks).toHaveLength(2);
    expect(imageBlocks[0].source.url).toBe('https://s3.example.com/img1');
    expect(imageBlocks[1].source.url).toBe('https://s3.example.com/img2');
  });

  it('deduplicates books with matching title and author across photos', async () => {
    makeAnthropicResponse([
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Foundation', author: 'Isaac Asimov' },
    ]);
    mockFindBookByTitle.mockResolvedValue(null);
    const result = await detectBooksFromImages(['uploads/1/a']);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Dune');
    expect(result[1].title).toBe('Foundation');
  });

  it('calls findBookByTitle once per unique book', async () => {
    makeAnthropicResponse([
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Foundation', author: 'Isaac Asimov' },
    ]);
    mockFindBookByTitle.mockResolvedValue(null);
    await detectBooksFromImages(['uploads/1/a']);
    expect(mockFindBookByTitle).toHaveBeenCalledTimes(2);
    expect(mockFindBookByTitle).toHaveBeenCalledWith('Dune');
    expect(mockFindBookByTitle).toHaveBeenCalledWith('Foundation');
  });

  it('returns matchedBookId for DB-matched books and skips search', async () => {
    makeAnthropicResponse([{ title: 'Known Book', author: 'Author A' }]);
    mockFindBookByTitle.mockResolvedValue(42);
    const result = await detectBooksFromImages(['uploads/1/a']);
    expect(result).toEqual([{ title: 'Known Book', author: 'Author A', matchedBookId: 42 }]);
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('resolves unmatched books with "title by author" query when author present', async () => {
    makeAnthropicResponse([{ title: 'Marjada', author: 'Arsha Sattar' }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([olBook]);
    const result = await detectBooksFromImages(['uploads/1/a']);
    expect(mockSearchBooks).toHaveBeenCalledWith('Marjada by Arsha Sattar', 1);
    expect((result[0] as any).resolvedBook).toMatchObject({ title: 'Marjada', source: 'open_library' });
  });

  it('resolves unmatched books with just title when author is null', async () => {
    makeAnthropicResponse([{ title: 'Unknown Book', author: null }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([googleBook]);
    const result = await detectBooksFromImages(['uploads/1/a']);
    expect(mockSearchBooks).toHaveBeenCalledWith('Unknown Book', 1);
    expect((result[0] as any).resolvedBook).toMatchObject({ source: 'google_books' });
  });

  it('omits resolvedBook when search returns no results', async () => {
    makeAnthropicResponse([{ title: 'Obscure Book', author: null }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockSearchBooks.mockResolvedValue([]);
    const result = await detectBooksFromImages(['uploads/1/a']);
    expect(result[0]).toEqual({ title: 'Obscure Book', author: null });
    expect(result[0]).not.toHaveProperty('resolvedBook');
  });

  it('handles a mix of DB-matched and search-resolved books', async () => {
    makeAnthropicResponse([
      { title: 'Known', author: 'A' },
      { title: 'Marjada', author: 'Arsha Sattar' },
    ]);
    mockFindBookByTitle.mockResolvedValueOnce(10).mockResolvedValueOnce(null);
    mockSearchBooks.mockResolvedValue([olBook]);
    const result = await detectBooksFromImages(['uploads/1/a']);
    expect(result[0]).toEqual({ title: 'Known', author: 'A', matchedBookId: 10 });
    expect((result[1] as any).resolvedBook).toMatchObject({ source: 'open_library' });
    expect(mockSearchBooks).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when Claude returns no books', async () => {
    makeAnthropicResponse([]);
    expect(await detectBooksFromImages(['uploads/1/a'])).toEqual([]);
  });
});
