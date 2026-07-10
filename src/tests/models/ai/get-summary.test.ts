import { getSummary } from '../../../models/ai/get-summary';
import * as aiData from '../../../data/ai-data';
import { completeText } from '../../../lib/llm/complete-text';

jest.mock('../../../data/ai-data');
jest.mock('../../../lib/llm/complete-text');

const mockFetchBookContext = aiData.fetchBookContext as jest.Mock;
const mockGetCachedSummary = aiData.getCachedSummary as jest.Mock;
const mockSaveSummary = aiData.saveSummary as jest.Mock;
const mockCompleteText = completeText as jest.Mock;

describe('getSummary model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the book does not exist', async () => {
    mockFetchBookContext.mockResolvedValue(null);
    expect(await getSummary(999)).toBeNull();
  });

  it('returns the stored blurb directly without calling the LLM or the cache', async () => {
    mockFetchBookContext.mockResolvedValue({
      title: 'A Book',
      author_name: 'Author',
      blurb: 'Catalog blurb text',
    });

    const result = await getSummary(1);

    expect(result).toEqual({ bookId: 1, summary: 'Catalog blurb text', generatedAt: null });
    expect(mockGetCachedSummary).not.toHaveBeenCalled();
    expect(mockCompleteText).not.toHaveBeenCalled();
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
    expect(mockCompleteText).not.toHaveBeenCalled();
  });

  it('generates via the LLM and saves when there is no blurb and no cached summary', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author', blurb: null });
    mockGetCachedSummary.mockResolvedValue(null);
    mockCompleteText.mockResolvedValue('Generated summary text');
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
