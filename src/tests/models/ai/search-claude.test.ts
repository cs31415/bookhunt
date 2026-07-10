import { searchBooksWithClaude } from '../../../models/ai/search-claude';
import { completeText } from '../../../lib/llm/complete-text';
import { LlmUnavailableError } from '../../../lib/llm/llm-errors';

jest.mock('../../../lib/llm/complete-text');

const mockCompleteText = completeText as jest.Mock;

function mockLlmResponse(text: string) {
  mockCompleteText.mockImplementation(async (_prompt, options) =>
    options.transform ? options.transform(text) : text,
  );
}

describe('searchBooksWithClaude', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps title/author suggestions into placeholder SearchResults with source: claude', async () => {
    mockLlmResponse('[{"title":"Grief Is the Thing with Feathers","author":"Max Porter"}]');

    const result = await searchBooksWithClaude('books about grief', 5);

    expect(result).toEqual([
      {
        googleBooksId: null,
        openLibraryId: null,
        title: 'Grief Is the Thing with Feathers',
        authors: ['Max Porter'],
        year: null,
        publisher: null,
        pages: null,
        rating: null,
        coverUrl: null,
        isbn13: null,
        language: null,
        blurb: null,
        inLibrary: false,
        libraryStatus: null,
        source: 'claude',
      },
    ]);
  });

  it('sets authors to an empty array when author is null', async () => {
    mockLlmResponse('[{"title":"Anonymous Work","author":null}]');

    const [book] = await searchBooksWithClaude('anonymous books', 5);
    expect(book.authors).toEqual([]);
  });

  it('parses a markdown-fenced JSON reply', async () => {
    mockLlmResponse('```json\n[{"title":"Fenced Book","author":"Someone"}]\n```');

    const result = await searchBooksWithClaude('query', 5);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Fenced Book');
  });

  it('filters out entries with no title', async () => {
    mockLlmResponse('[{"title":"Has Title","author":"A"},{"author":"No Title"}]');

    const result = await searchBooksWithClaude('query', 5);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Has Title');
  });

  it('returns [] when all LLM models fail', async () => {
    mockCompleteText.mockRejectedValue(new LlmUnavailableError('All configured LLM models failed', []));

    expect(await searchBooksWithClaude('query', 5)).toEqual([]);
  });

  it('returns [] when the response is not valid JSON', async () => {
    mockLlmResponse('not json at all');

    expect(await searchBooksWithClaude('query', 5)).toEqual([]);
  });

  it('includes the requested limit in the prompt, clamped between 1 and 40', async () => {
    mockLlmResponse('[]');

    await searchBooksWithClaude('query', 100);
    expect(mockCompleteText.mock.calls[0][0]).toContain('up to 40 books');

    await searchBooksWithClaude('query', 0);
    expect(mockCompleteText.mock.calls[1][0]).toContain('up to 1 books');
  });

  it('requests up to 1536 tokens', async () => {
    mockLlmResponse('[]');

    await searchBooksWithClaude('query', 5);
    expect(mockCompleteText.mock.calls[0][1].maxTokens).toBe(1536);
  });
});
