const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerateContent } })),
}));
jest.mock('../../../lib/llm/fetch-image-as-base64');

import { completeWithGemini } from '../../../lib/llm/gemini-adapter';
import { fetchImageAsBase64 } from '../../../lib/llm/fetch-image-as-base64';

const mockFetchImageAsBase64 = fetchImageAsBase64 as jest.Mock;

describe('completeWithGemini', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockResolvedValue({ text: 'reply' });
  });

  it('sends a single text part with maxOutputTokens for text-only requests', async () => {
    const result = await completeWithGemini('gemini-2.5-flash', { prompt: 'hello', maxTokens: 256 });

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
      config: { maxOutputTokens: 256 },
    });
    expect(result).toBe('reply');
  });

  it('fetches each image URL and sends inlineData parts before the text part', async () => {
    mockFetchImageAsBase64
      .mockResolvedValueOnce({ mimeType: 'image/jpeg', data: 'base64one' })
      .mockResolvedValueOnce({ mimeType: 'image/png', data: 'base64two' });

    await completeWithGemini('gemini-2.5-flash', {
      prompt: 'describe',
      imageUrls: ['https://s3/img1', 'https://s3/img2'],
      maxTokens: 2048,
    });

    expect(mockFetchImageAsBase64).toHaveBeenCalledWith('https://s3/img1');
    expect(mockFetchImageAsBase64).toHaveBeenCalledWith('https://s3/img2');
    const parts = mockGenerateContent.mock.calls[0][0].contents[0].parts;
    expect(parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'base64one' } },
      { inlineData: { mimeType: 'image/png', data: 'base64two' } },
      { text: 'describe' },
    ]);
  });

  it('returns an empty string when the response has no text', async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });

    expect(await completeWithGemini('gemini-2.5-flash', { prompt: 'hello', maxTokens: 256 })).toBe('');
  });
});
