const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
);

import { completeWithAnthropic } from '../../../lib/llm/anthropic-adapter';
import { LlmTruncatedError } from '../../../lib/llm/llm-errors';

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

  // A truncated answer is worse than no answer: it parses as valid text but is
  // missing content, so it must not be handed back as a success.
  it('throws LlmTruncatedError when the model hits its output limit', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[{"title":"Dune"' }],
      stop_reason: 'max_tokens',
    });

    await expect(
      completeWithAnthropic('claude-haiku-4-5', { prompt: 'hello', maxTokens: 2048 }),
    ).rejects.toThrow(LlmTruncatedError);
  });

  it('reports the provider, model, and budget on truncation', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'x' }], stop_reason: 'max_tokens' });

    const error = await completeWithAnthropic('claude-haiku-4-5', {
      prompt: 'hello',
      maxTokens: 2048,
    }).catch((e) => e);

    expect(error).toMatchObject({ provider: 'anthropic', model: 'claude-haiku-4-5', maxTokens: 2048 });
  });

  it('returns the partial text when the caller tolerates truncation', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'a summary cut off mid-sen' }],
      stop_reason: 'max_tokens',
    });

    expect(
      await completeWithAnthropic('claude-haiku-4-5', {
        prompt: 'summarise',
        maxTokens: 1024,
        tolerateTruncation: true,
      }),
    ).toBe('a summary cut off mid-sen');
  });

  it('returns normally for other stop reasons', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'reply' }], stop_reason: 'end_turn' });

    expect(await completeWithAnthropic('claude-haiku-4-5', { prompt: 'hello', maxTokens: 256 })).toBe(
      'reply',
    );
  });
});
