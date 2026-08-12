const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerateContent } })),
}));
import { completeWithGemini } from '../../../lib/llm/gemini-adapter';
import { LlmTruncatedError } from '../../../lib/llm/llm-errors';

describe('completeWithGemini', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockResolvedValue({ text: 'reply' });
  });

  it('sends a single text part with maxOutputTokens', async () => {
    const result = await completeWithGemini('gemini-2.5-flash', { prompt: 'hello', maxTokens: 256 });

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      config: { maxOutputTokens: 256 },
    });
    expect(result).toBe('reply');
  });

  it('returns an empty string when the response has no text', async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });

    expect(await completeWithGemini('gemini-2.5-flash', { prompt: 'hello', maxTokens: 256 })).toBe('');
  });

  it('throws LlmTruncatedError when finishReason is MAX_TOKENS', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '[{"title":"Dune"',
      candidates: [{ finishReason: 'MAX_TOKENS' }],
    });

    await expect(
      completeWithGemini('gemini-2.5-flash', { prompt: 'hello', maxTokens: 2048 }),
    ).rejects.toThrow(LlmTruncatedError);
  });

  it('returns normally when finishReason is STOP', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'reply', candidates: [{ finishReason: 'STOP' }] });

    expect(await completeWithGemini('gemini-2.5-flash', { prompt: 'hello', maxTokens: 256 })).toBe(
      'reply',
    );
  });
});
