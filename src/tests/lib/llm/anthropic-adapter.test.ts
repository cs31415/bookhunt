const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
);

import { completeWithAnthropic } from '../../../lib/llm/anthropic-adapter';

describe('completeWithAnthropic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'reply' }] });
  });

  it('sends a plain string prompt for text-only requests', async () => {
    const result = await completeWithAnthropic('claude-haiku-4-5', { prompt: 'hello', maxTokens: 256 });

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(result).toBe('reply');
  });

  it('maps image URLs to url-source image blocks followed by the text block', async () => {
    await completeWithAnthropic('claude-haiku-4-5', {
      prompt: 'describe',
      imageUrls: ['https://s3/img1', 'https://s3/img2'],
      maxTokens: 2048,
    });

    const content = mockCreate.mock.calls[0][0].messages[0].content;
    expect(content).toEqual([
      { type: 'image', source: { type: 'url', url: 'https://s3/img1' } },
      { type: 'image', source: { type: 'url', url: 'https://s3/img2' } },
      { type: 'text', text: 'describe' },
    ]);
  });

  it('returns an empty string when the response has no text block', async () => {
    mockCreate.mockResolvedValue({ content: [] });

    expect(await completeWithAnthropic('claude-haiku-4-5', { prompt: 'hello', maxTokens: 256 })).toBe('');
  });
});
