import { searchBooksWithClaude } from '../../../models/ai/search-claude';
import { completeTextWithModel } from '../../../lib/llm/complete-text';
import { LlmUnavailableError } from '../../../lib/llm/llm-errors';

jest.mock('../../../lib/llm/complete-text');

const mockCompleteTextWithModel = completeTextWithModel as jest.Mock;

const defaultModel = { provider: 'google', model: 'gemini-3.1-flash-lite' };

function mockLlmResponse(text: string, model = defaultModel) {
  mockCompleteTextWithModel.mockImplementation(async (_prompt, options) => ({
    result: options.transform ? options.transform(text) : text,
    model,
  }));
}

describe('searchBooksWithClaude', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps title/author/categories/moods suggestions into placeholder SearchResults with source: <model name>', async () => {
    mockLlmResponse(
      '[{"title":"Grief Is the Thing with Feathers","author":"Max Porter","categories":["Fiction","Grief Lit"],"moods":["Devastating","Tender"]}]',
    );

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
        categories: ['Fiction', 'Grief Lit'],
        moods: ['Devastating', 'Tender'],
        inLibrary: false,
        libraryStatus: null,
        source: 'gemini-3.1-flash-lite',
      },
    ]);
  });

  it('defaults categories and moods to an empty array when the LLM omits them', async () => {
    mockLlmResponse('[{"title":"A Book","author":"An Author"}]');

    const [book] = await searchBooksWithClaude('query', 5);
    expect(book.categories).toEqual([]);
    expect(book.moods).toEqual([]);
  });

  it('sets source to whichever model actually answered', async () => {
    mockLlmResponse('[{"title":"A Book","author":"An Author"}]', {
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    });

    const [book] = await searchBooksWithClaude('query', 5);
    expect(book.source).toBe('claude-haiku-4-5');
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
    mockCompleteTextWithModel.mockRejectedValue(new LlmUnavailableError('All configured LLM models failed', []));

    expect(await searchBooksWithClaude('query', 5)).toEqual([]);
  });

  it('returns [] when the response is not valid JSON', async () => {
    mockLlmResponse('not json at all');

    expect(await searchBooksWithClaude('query', 5)).toEqual([]);
  });

  it('includes the requested limit in the prompt, clamped between 1 and 20', async () => {
    mockLlmResponse('[]');

    await searchBooksWithClaude('query', 100);
    expect(mockCompleteTextWithModel.mock.calls[0][0]).toContain('up to 20 books');

    await searchBooksWithClaude('query', 0);
    expect(mockCompleteTextWithModel.mock.calls[1][0]).toContain('up to 1 books');
  });

  it('requests up to 2048 tokens', async () => {
    mockLlmResponse('[]');

    await searchBooksWithClaude('query', 5);
    expect(mockCompleteTextWithModel.mock.calls[0][1].maxTokens).toBe(2048);
  });
});
