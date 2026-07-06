import { searchBooksWithClaude } from '../../../models/ai/search-claude';
import { getAnthropic } from '../../../lib/anthropic';

jest.mock('../../../lib/anthropic');

const mockGetAnthropic = getAnthropic as jest.Mock;

function mockClaudeResponse(text: string) {
  const mockCreate = jest.fn().mockResolvedValue({ content: [{ type: 'text', text }] });
  mockGetAnthropic.mockReturnValue({ messages: { create: mockCreate } });
  return mockCreate;
}

describe('searchBooksWithClaude', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps title/author suggestions into placeholder SearchResults with source: claude', async () => {
    mockClaudeResponse('[{"title":"Grief Is the Thing with Feathers","author":"Max Porter"}]');

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
    mockClaudeResponse('[{"title":"Anonymous Work","author":null}]');

    const [book] = await searchBooksWithClaude('anonymous books', 5);
    expect(book.authors).toEqual([]);
  });

  it('parses a markdown-fenced JSON reply', async () => {
    mockClaudeResponse('```json\n[{"title":"Fenced Book","author":"Someone"}]\n```');

    const result = await searchBooksWithClaude('query', 5);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Fenced Book');
  });

  it('filters out entries with no title', async () => {
    mockClaudeResponse('[{"title":"Has Title","author":"A"},{"author":"No Title"}]');

    const result = await searchBooksWithClaude('query', 5);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Has Title');
  });

  it('returns [] when Claude throws', async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error('claude down'));
    mockGetAnthropic.mockReturnValue({ messages: { create: mockCreate } });

    expect(await searchBooksWithClaude('query', 5)).toEqual([]);
  });

  it('returns [] when the response is not valid JSON', async () => {
    mockClaudeResponse('not json at all');

    expect(await searchBooksWithClaude('query', 5)).toEqual([]);
  });

  it('includes the requested limit in the prompt, clamped between 1 and 40', async () => {
    const mockCreate = mockClaudeResponse('[]');

    await searchBooksWithClaude('query', 100);
    expect(mockCreate.mock.calls[0][0].messages[0].content).toContain('up to 40 books');

    await searchBooksWithClaude('query', 0);
    expect(mockCreate.mock.calls[1][0].messages[0].content).toContain('up to 1 books');
  });
});
