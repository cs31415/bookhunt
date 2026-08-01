import { generateThemes } from '../../../models/ai/generate-themes';
import * as aiData from '../../../data/ai-data';
import { completeText } from '../../../lib/llm/complete-text';

jest.mock('../../../data/ai-data');
jest.mock('../../../lib/llm/complete-text');

const mockFetchBookContext = aiData.fetchBookContext as jest.Mock;
const mockGetBookGenresThemes = aiData.getBookGenresThemes as jest.Mock;
const mockUpdateBookAiMetadata = aiData.updateBookAiMetadata as jest.Mock;
const mockGetThemeVocabulary = aiData.getThemeVocabulary as jest.Mock;
const mockCompleteText = completeText as jest.Mock;

function mockLlmResponse(text: string) {
  mockCompleteText.mockImplementation(async (_prompt, options) =>
    options.transform ? options.transform(text) : text,
  );
}

describe('generateThemes model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetThemeVocabulary.mockResolvedValue([]);
  });

  it('returns null when the book does not exist', async () => {
    mockFetchBookContext.mockResolvedValue(null);
    expect(await generateThemes(999)).toBeNull();
    expect(mockCompleteText).not.toHaveBeenCalled();
  });

  it('returns cached genres/themes/moods without calling the LLM', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author' });
    mockGetBookGenresThemes.mockResolvedValue({ genres: ['Sci-Fi'], themes: ['Isolation'], moods: ['Bleak'] });

    const result = await generateThemes(1);

    expect(result).toEqual({ genres: ['Sci-Fi'], themes: ['Isolation'], moods: ['Bleak'] });
    expect(mockCompleteText).not.toHaveBeenCalled();
  });

  it('parses a plain JSON response from the LLM and persists it', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author' });
    mockGetBookGenresThemes.mockResolvedValue(null);
    mockLlmResponse('{"genres":["Popular Science"],"themes":["units of selection"],"moods":["Rigorous"]}');

    const result = await generateThemes(1);

    expect(mockUpdateBookAiMetadata).toHaveBeenCalledWith(1, ['Popular Science'], ['units of selection'], ['Rigorous']);
    expect(result).toEqual({ genres: ['Popular Science'], themes: ['units of selection'], moods: ['Rigorous'] });
  });

  it('parses a markdown-fenced JSON response from the LLM (regression for the 500 on real replies)', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author' });
    mockGetBookGenresThemes.mockResolvedValue(null);
    mockLlmResponse('```json\n{"genres":["Popular Science"],"themes":["units of selection"],"moods":["Rigorous"]}\n```');

    const result = await generateThemes(1);

    expect(result).toEqual({ genres: ['Popular Science'], themes: ['units of selection'], moods: ['Rigorous'] });
  });

  it('folds a generated theme onto the spelling the catalog already uses', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author' });
    mockGetBookGenresThemes.mockResolvedValue(null);
    mockGetThemeVocabulary.mockResolvedValue(['Sociopolitical evolution']);
    mockLlmResponse('{"genres":["History"],"themes":["Socio-political evolution"],"moods":["Scholarly"]}');

    const result = await generateThemes(1);

    // Persisted and returned as one theme, not two near-identical ones.
    expect(mockUpdateBookAiMetadata).toHaveBeenCalledWith(1, ['History'], ['Sociopolitical evolution'], ['Scholarly']);
    expect(result?.themes).toEqual(['Sociopolitical evolution']);
  });

  it('re-generates over stored metadata when forced', async () => {
    mockFetchBookContext.mockResolvedValue({ title: 'A Book', author_name: 'Author' });
    mockGetBookGenresThemes.mockResolvedValue({ genres: ['Sci-Fi'], themes: ['Isolation'], moods: ['Bleak'] });
    mockLlmResponse('{"genres":["History"],"themes":["Cultural History"],"moods":["Scholarly"]}');

    const result = await generateThemes(1, { force: true });

    expect(mockCompleteText).toHaveBeenCalled();
    expect(result?.themes).toEqual(['Cultural History']);
  });
});
