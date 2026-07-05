import { generateThemes } from '../../../models/ai/generate-themes';
import * as aiData from '../../../data/ai-data';
import { getAnthropic } from '../../../lib/anthropic';

jest.mock('../../../data/ai-data');
jest.mock('../../../lib/anthropic');

const mockFetchBookContext = aiData.fetchBookContext as jest.Mock;
const mockGetBookGenresThemes = aiData.getBookGenresThemes as jest.Mock;
const mockUpdateBookAiMetadata = aiData.updateBookAiMetadata as jest.Mock;
const mockGetAnthropic = getAnthropic as jest.Mock;

function mockClaudeResponse(text: string) {
  const mockCreate = jest.fn().mockResolvedValue({ content: [{ type: 'text', text }] });
  mockGetAnthropic.mockReturnValue({ messages: { create: mockCreate } });
  return mockCreate;
}

describe('generateThemes model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when the book does not exist', async () => {
    mockFetchBookContext.mockResolvedValue(null);
    expect(await generateThemes(999)).toBeNull();
    expect(mockGetAnthropic).not.toHaveBeenCalled();
  });

  it('returns cached genres/themes without calling Claude', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author' });
    mockGetBookGenresThemes.mockResolvedValue({ genres: ['Sci-Fi'], themes: ['Isolation'] });

    const result = await generateThemes(1);

    expect(result).toEqual({ genres: ['Sci-Fi'], themes: ['Isolation'] });
    expect(mockGetAnthropic).not.toHaveBeenCalled();
  });

  it('parses a plain JSON response from Claude and persists it', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author' });
    mockGetBookGenresThemes.mockResolvedValue(null);
    mockClaudeResponse('{"genres":["Popular Science"],"themes":["units of selection"]}');

    const result = await generateThemes(1);

    expect(mockUpdateBookAiMetadata).toHaveBeenCalledWith(1, ['Popular Science'], ['units of selection']);
    expect(result).toEqual({ genres: ['Popular Science'], themes: ['units of selection'] });
  });

  it('parses a markdown-fenced JSON response from Claude (regression for the 500 on real replies)', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author' });
    mockGetBookGenresThemes.mockResolvedValue(null);
    mockClaudeResponse('```json\n{"genres":["Popular Science"],"themes":["units of selection"]}\n```');

    const result = await generateThemes(1);

    expect(result).toEqual({ genres: ['Popular Science'], themes: ['units of selection'] });
  });
});
