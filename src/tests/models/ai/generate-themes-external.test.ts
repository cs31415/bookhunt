import { generateThemesExternal } from '../../../models/ai/generate-themes-external';
import { completeText } from '../../../lib/llm/complete-text';

jest.mock('../../../lib/llm/complete-text');

const mockCompleteText = completeText as jest.Mock;

function mockLlmResponse(text: string) {
  mockCompleteText.mockImplementation(async (_prompt, options) =>
    options.transform ? options.transform(text) : text,
  );
}

describe('generateThemesExternal model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prompts the LLM with the given title and author and parses a plain JSON reply', async () => {
    mockLlmResponse('{"genres":["Memoir"],"themes":["resilience"],"moods":["Reflective"]}');

    const result = await generateThemesExternal('A Book', 'Some Author');

    const prompt = mockCompleteText.mock.calls[0][0];
    expect(prompt).toContain('A Book');
    expect(prompt).toContain('Some Author');
    expect(result).toEqual({ genres: ['Memoir'], themes: ['resilience'], moods: ['Reflective'] });
  });

  it('parses a markdown-fenced JSON reply', async () => {
    mockLlmResponse('```json\n{"genres":["Memoir"],"themes":["resilience"],"moods":["Reflective"]}\n```');

    const result = await generateThemesExternal('A Book', 'Some Author');

    expect(result).toEqual({ genres: ['Memoir'], themes: ['resilience'], moods: ['Reflective'] });
  });

  it('shows the model the existing vocabulary and asks it to prefer those tags', async () => {
    mockLlmResponse('{"genres":["Memoir"],"themes":["resilience"],"moods":["Reflective"]}');

    await generateThemesExternal('A Book', 'Some Author', ['Cultural History', 'Human condition']);

    const prompt = mockCompleteText.mock.calls[0][0];
    expect(prompt).toContain('Cultural History, Human condition');
    expect(prompt).toContain('Prefer a theme from that list');
  });

  it('omits the vocabulary clause when the catalog has no themes yet', async () => {
    mockLlmResponse('{"genres":["Memoir"],"themes":["resilience"],"moods":["Reflective"]}');

    await generateThemesExternal('A Book', 'Some Author', []);

    // An empty list is a confusing hint, not a weaker one.
    expect(mockCompleteText.mock.calls[0][0]).not.toContain('already in use');
  });

  it('propagates errors from the LLM call', async () => {
    mockCompleteText.mockRejectedValue(new Error('llm down'));

    await expect(generateThemesExternal('A Book', 'Some Author')).rejects.toThrow('llm down');
  });
});
