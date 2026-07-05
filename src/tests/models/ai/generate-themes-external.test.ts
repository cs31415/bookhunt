import { generateThemesExternal } from '../../../models/ai/generate-themes-external';
import { getAnthropic } from '../../../lib/anthropic';

jest.mock('../../../lib/anthropic');

const mockGetAnthropic = getAnthropic as jest.Mock;

function mockClaudeResponse(text: string) {
  const mockCreate = jest.fn().mockResolvedValue({ content: [{ type: 'text', text }] });
  mockGetAnthropic.mockReturnValue({ messages: { create: mockCreate } });
  return mockCreate;
}

describe('generateThemesExternal model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prompts Claude with the given title and author and parses a plain JSON reply', async () => {
    const mockCreate = mockClaudeResponse('{"genres":["Memoir"],"themes":["resilience"]}');

    const result = await generateThemesExternal('A Book', 'Some Author');

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('A Book');
    expect(prompt).toContain('Some Author');
    expect(result).toEqual({ genres: ['Memoir'], themes: ['resilience'] });
  });

  it('parses a markdown-fenced JSON reply', async () => {
    mockClaudeResponse('```json\n{"genres":["Memoir"],"themes":["resilience"]}\n```');

    const result = await generateThemesExternal('A Book', 'Some Author');

    expect(result).toEqual({ genres: ['Memoir'], themes: ['resilience'] });
  });

  it('propagates errors from the Claude call', async () => {
    const mockCreate = jest.fn().mockRejectedValue(new Error('claude down'));
    mockGetAnthropic.mockReturnValue({ messages: { create: mockCreate } });

    await expect(generateThemesExternal('A Book', 'Some Author')).rejects.toThrow('claude down');
  });
});
