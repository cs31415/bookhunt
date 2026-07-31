import { detectBooksFromImages } from '../../../models/upload/scan';
import * as uploadData from '../../../data/upload-data';
import * as resolveDetected from '../../../models/upload/resolve-detected-book';
import { LlmUnavailableError } from '../../../lib/llm/llm-errors';
import { IMAGES_PER_VISION_CALL, VISION_MAX_TOKENS } from '../../../lib/upload-constraints';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));
jest.mock('../../../lib/s3', () => ({
  getS3: jest.fn(() => ({})),
}));
jest.mock('../../../lib/llm/complete-vision');
jest.mock('../../../data/upload-data');
jest.mock('../../../models/upload/resolve-detected-book');
jest.mock('../../../models/upload/validate-image-keys', () => ({
  validateImageKeys: jest.fn().mockResolvedValue(undefined),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { completeVision } from '../../../lib/llm/complete-vision';

const mockGetSignedUrl = getSignedUrl as jest.Mock;
const mockCompleteVision = completeVision as jest.Mock;
const mockFindBookByTitle = uploadData.findBookByTitle as jest.Mock;
const mockResolveDetectedBook = resolveDetected.resolveDetectedBook as jest.Mock;

const googleBook = {
  googleBooksId: 'gb1', openLibraryId: null, title: 'Cat Science', authors: ['Dr Cat'], year: 2020,
  publisher: null, pages: null, rating: null, coverUrl: null, isbn13: null,
  language: null, blurb: null, inLibrary: false, libraryStatus: null,
  source: 'google_books' as const,
};

const olBook = {
  googleBooksId: null, openLibraryId: 'OL7170815M', title: 'Marjada', authors: ['Arsha Sattar'], year: 2022,
  publisher: null, pages: null, rating: null,
  coverUrl: 'https://covers.openlibrary.org/b/id/99-M.jpg',
  isbn13: '9781234567890', language: null, blurb: null,
  inLibrary: false, libraryStatus: null, source: 'open_library' as const,
};

function mockVisionResponse(books: { title: string; author: string | null }[]) {
  mockCompleteVision.mockImplementation(async (_imageUrls, _prompt, options) =>
    options.transform ? options.transform(JSON.stringify(books)) : JSON.stringify(books),
  );
}

describe('detectBooksFromImages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    mockGetSignedUrl.mockResolvedValue('https://s3.example.com/img');
    mockResolveDetectedBook.mockResolvedValue(null);
  });

  it('generates a signed URL for each image key', async () => {
    mockGetSignedUrl
      .mockResolvedValueOnce('https://s3.example.com/img1')
      .mockResolvedValueOnce('https://s3.example.com/img2');
    mockVisionResponse([]);
    await detectBooksFromImages(['uploads/1/a', 'uploads/1/b'], 1);
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('passes the signed URL for each key to the vision LLM', async () => {
    mockGetSignedUrl
      .mockResolvedValueOnce('https://s3.example.com/img1')
      .mockResolvedValueOnce('https://s3.example.com/img2');
    mockVisionResponse([]);
    await detectBooksFromImages(['uploads/1/a', 'uploads/1/b'], 1);
    expect(mockCompleteVision.mock.calls[0][0]).toEqual([
      'https://s3.example.com/img1',
      'https://s3.example.com/img2',
    ]);
  });

  it('deduplicates books with matching title and author across photos', async () => {
    mockVisionResponse([
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Foundation', author: 'Isaac Asimov' },
    ]);
    mockFindBookByTitle.mockResolvedValue(null);
    const result = await detectBooksFromImages(['uploads/1/a'], 1);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Dune');
    expect(result[1].title).toBe('Foundation');
  });

  it('calls findBookByTitle once per unique book', async () => {
    mockVisionResponse([
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Dune', author: 'Frank Herbert' },
      { title: 'Foundation', author: 'Isaac Asimov' },
    ]);
    mockFindBookByTitle.mockResolvedValue(null);
    await detectBooksFromImages(['uploads/1/a'], 1);
    expect(mockFindBookByTitle).toHaveBeenCalledTimes(2);
    expect(mockFindBookByTitle).toHaveBeenCalledWith('Dune');
    expect(mockFindBookByTitle).toHaveBeenCalledWith('Foundation');
  });

  it('returns matchedBookId for DB-matched books and skips search', async () => {
    mockVisionResponse([{ title: 'Known Book', author: 'Author A' }]);
    mockFindBookByTitle.mockResolvedValue(42);
    const result = await detectBooksFromImages(['uploads/1/a'], 1);
    expect(result).toEqual([{ title: 'Known Book', author: 'Author A', matchedBookId: 42 }]);
    expect(mockResolveDetectedBook).not.toHaveBeenCalled();
  });

  it('resolves unmatched books with the detected title and author', async () => {
    mockVisionResponse([{ title: 'Marjada', author: 'Arsha Sattar' }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockResolveDetectedBook.mockResolvedValue(olBook);
    const result = await detectBooksFromImages(['uploads/1/a'], 1);
    expect(mockResolveDetectedBook).toHaveBeenCalledWith('Marjada', 'Arsha Sattar');
    expect((result[0] as any).resolvedBook).toMatchObject({ title: 'Marjada', source: 'open_library' });
  });

  it('resolves unmatched books with a null author', async () => {
    mockVisionResponse([{ title: 'Unknown Book', author: null }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockResolveDetectedBook.mockResolvedValue(googleBook);
    const result = await detectBooksFromImages(['uploads/1/a'], 1);
    expect(mockResolveDetectedBook).toHaveBeenCalledWith('Unknown Book', null);
    expect((result[0] as any).resolvedBook).toMatchObject({ source: 'google_books' });
  });

  it('omits resolvedBook when resolution finds no acceptable match', async () => {
    mockVisionResponse([{ title: 'Obscure Book', author: null }]);
    mockFindBookByTitle.mockResolvedValue(null);
    mockResolveDetectedBook.mockResolvedValue(null);
    const result = await detectBooksFromImages(['uploads/1/a'], 1);
    expect(result[0]).toEqual({ title: 'Obscure Book', author: null });
    expect(result[0]).not.toHaveProperty('resolvedBook');
  });

  it('handles a mix of DB-matched and search-resolved books', async () => {
    mockVisionResponse([
      { title: 'Known', author: 'A' },
      { title: 'Marjada', author: 'Arsha Sattar' },
    ]);
    mockFindBookByTitle.mockResolvedValueOnce(10).mockResolvedValueOnce(null);
    mockResolveDetectedBook.mockResolvedValue(olBook);
    const result = await detectBooksFromImages(['uploads/1/a'], 1);
    expect(result[0]).toEqual({ title: 'Known', author: 'A', matchedBookId: 10 });
    expect((result[1] as any).resolvedBook).toMatchObject({ source: 'open_library' });
    expect(mockResolveDetectedBook).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when the LLM returns no books', async () => {
    mockVisionResponse([]);
    expect(await detectBooksFromImages(['uploads/1/a'], 1)).toEqual([]);
  });

  it('validates image keys against the requesting user before calling the LLM', async () => {
    const { validateImageKeys } = jest.requireMock('../../../models/upload/validate-image-keys');
    mockVisionResponse([]);
    await detectBooksFromImages(['uploads/7/a'], 7);
    expect(validateImageKeys).toHaveBeenCalledWith(['uploads/7/a'], 7);
  });
});

describe('detectBooksFromImages chunking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    mockResolveDetectedBook.mockResolvedValue(null);
    mockFindBookByTitle.mockResolvedValue(null);
  });

  function keys(n: number) {
    return Array.from({ length: n }, (_, i) => `uploads/1/img${i}`);
  }

  /** Distinct signed URLs, so assertions can tell which chunk received which image. */
  function signDistinctUrls() {
    let i = 0;
    mockGetSignedUrl.mockImplementation(async () => `https://s3.example.com/img${i++}`);
  }

  // Derived from the constant rather than hardcoded, so tuning the chunk size
  // for recall doesn't break the tests that describe chunking as a behaviour.
  it('splits a batch into vision calls of at most IMAGES_PER_VISION_CALL', async () => {
    signDistinctUrls();
    mockVisionResponse([]);

    // A count that divides unevenly, so the trailing partial chunk is covered.
    const count = IMAGES_PER_VISION_CALL * 3 + 1;
    await detectBooksFromImages(keys(count), 1);

    const sizes = mockCompleteVision.mock.calls.map((call) => call[0].length);
    expect(sizes).toEqual([...Array(3).fill(IMAGES_PER_VISION_CALL), 1]);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(count);
  });

  it('makes a single vision call when the batch fits in one chunk', async () => {
    signDistinctUrls();
    mockVisionResponse([]);

    await detectBooksFromImages(keys(IMAGES_PER_VISION_CALL), 1);

    expect(mockCompleteVision).toHaveBeenCalledTimes(1);
    expect(mockCompleteVision.mock.calls[0][0]).toHaveLength(IMAGES_PER_VISION_CALL);
  });

  it('asks for the full vision token budget, not a per-call fraction of it', async () => {
    signDistinctUrls();
    mockVisionResponse([]);

    await detectBooksFromImages(keys(IMAGES_PER_VISION_CALL * 2), 1);

    for (const call of mockCompleteVision.mock.calls) {
      expect(call[2].maxTokens).toBe(VISION_MAX_TOKENS);
    }
  });

  it('gives each chunk only its own image URLs, with none repeated or dropped', async () => {
    signDistinctUrls();
    mockVisionResponse([]);

    await detectBooksFromImages(keys(20), 1);

    const allUrls = mockCompleteVision.mock.calls.flatMap((call) => call[0]);
    expect(allUrls).toHaveLength(20);
    expect(new Set(allUrls).size).toBe(20);
  });

  it('deduplicates a book that appears in more than one chunk', async () => {
    signDistinctUrls();
    // Chunk 1 and chunk 2 both see Dune.
    mockCompleteVision
      .mockImplementationOnce(async (_urls, _prompt, options) =>
        options.transform(JSON.stringify([{ title: 'Dune', author: 'Frank Herbert' }])),
      )
      .mockImplementationOnce(async (_urls, _prompt, options) =>
        options.transform(
          JSON.stringify([
            { title: 'Dune', author: 'Frank Herbert' },
            { title: 'Foundation', author: 'Isaac Asimov' },
          ]),
        ),
      );

    const result = await detectBooksFromImages(keys(16), 1);

    expect(result.map((b) => b.title)).toEqual(['Dune', 'Foundation']);
    expect(mockFindBookByTitle).toHaveBeenCalledTimes(2);
  });

  it('preserves detection order across chunks despite parallel resolution', async () => {
    signDistinctUrls();
    mockCompleteVision
      .mockImplementationOnce(async (_urls, _prompt, options) =>
        options.transform(JSON.stringify([{ title: 'First', author: 'A' }])),
      )
      .mockImplementationOnce(async (_urls, _prompt, options) =>
        options.transform(
          JSON.stringify([
            { title: 'Second', author: 'B' },
            { title: 'Third', author: 'C' },
          ]),
        ),
      );
    // Resolve out of order: the last book settles first.
    mockFindBookByTitle.mockImplementation(async (title: string) => {
      await new Promise((r) => setTimeout(r, title === 'First' ? 20 : 1));
      return null;
    });

    const result = await detectBooksFromImages(keys(16), 1);

    expect(result.map((b) => b.title)).toEqual(['First', 'Second', 'Third']);
  });

  it('fails the whole scan when any chunk exhausts its model chain', async () => {
    signDistinctUrls();
    mockCompleteVision
      .mockImplementationOnce(async (_urls, _prompt, options) =>
        options.transform(JSON.stringify([{ title: 'Dune', author: 'Frank Herbert' }])),
      )
      .mockRejectedValueOnce(new LlmUnavailableError('all models failed', []));

    await expect(detectBooksFromImages(keys(16), 1)).rejects.toThrow(LlmUnavailableError);
  });

  it('signs every key in the batch', async () => {
    signDistinctUrls();
    mockVisionResponse([]);

    await detectBooksFromImages(keys(20), 1);

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(20);
  });
});
