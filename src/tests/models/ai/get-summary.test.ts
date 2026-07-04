import { getSummary } from '../../../models/ai/get-summary';
import * as aiData from '../../../data/ai-data';
import { getAnthropic } from '../../../lib/anthropic';

jest.mock('../../../data/ai-data');
jest.mock('../../../lib/anthropic');

const mockFetchBookContext = aiData.fetchBookContext as jest.Mock;
const mockGetCachedSummary = aiData.getCachedSummary as jest.Mock;
const mockSaveSummary = aiData.saveSummary as jest.Mock;
const mockGetAnthropic = getAnthropic as jest.Mock;

function mockClaudeResponse(text: string) {
  const mockCreate = jest.fn().mockResolvedValue({ content: [{ type: 'text', text }] });
  mockGetAnthropic.mockReturnValue({ messages: { create: mockCreate } });
  return mockCreate;
}

describe('getSummary model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the book does not exist', async () => {
    mockFetchBookContext.mockResolvedValue(null);
    expect(await getSummary(999)).toBeNull();
  });

  it('returns the stored blurb directly without calling Claude or the cache', async () => {
    mockFetchBookContext.mockResolvedValue({
      title: 'A Book',
      author_name: 'Author',
      blurb: 'Catalog blurb text',
    });

    const result = await getSummary(1);

    expect(result).toEqual({ bookId: 1, summary: 'Catalog blurb text', generatedAt: null });
    expect(mockGetCachedSummary).not.toHaveBeenCalled();
    expect(mockGetAnthropic).not.toHaveBeenCalled();
  });

  it('falls back to the ai_summaries cache when there is no blurb', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author', blurb: null });
    mockGetCachedSummary.mockResolvedValue({
      bookId: 1,
      summary: 'Cached AI summary',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await getSummary(1);

    expect(result).toEqual({
      bookId: 1,
      summary: 'Cached AI summary',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(mockGetAnthropic).not.toHaveBeenCalled();
  });

  it('generates via Claude and saves when there is no blurb and no cached summary', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author', blurb: null });
    mockGetCachedSummary.mockResolvedValue(null);
    mockClaudeResponse('Generated summary text');
    mockSaveSummary.mockResolvedValue({
      bookId: 1,
      summary: 'Generated summary text',
      generatedAt: '2026-07-04T00:00:00.000Z',
    });

    const result = await getSummary(1);

    expect(mockSaveSummary).toHaveBeenCalledWith(1, 'Generated summary text');
    expect(result).toEqual({
      bookId: 1,
      summary: 'Generated summary text',
      generatedAt: '2026-07-04T00:00:00.000Z',
    });
  });
});
