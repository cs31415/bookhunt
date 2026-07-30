const mockCreate = jest.fn();

jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({ chat: { completions: { create: mockCreate } } })),
);

import { completeWithOpenAi } from '../../../lib/llm/openai-adapter';
import { LlmTruncatedError } from '../../../lib/llm/llm-errors';

describe('completeWithOpenAi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'reply' } }] });
  });

  it('sends a plain string prompt with max_completion_tokens for text-only requests', async () => {
    const result = await completeWithOpenAi('gpt-4o-mini', { prompt: 'hello', maxTokens: 256 });

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'gpt-4o-mini',
      max_completion_tokens: 256,
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(result).toBe('reply');
  });

  it('maps image URLs to image_url parts followed by the text part', async () => {
    await completeWithOpenAi('gpt-4o-mini', {
      prompt: 'describe',
      imageUrls: ['https://s3/img1', 'https://s3/img2'],
      maxTokens: 2048,
    });

    const content = mockCreate.mock.calls[0][0].messages[0].content;
    expect(content).toEqual([
      { type: 'image_url', image_url: { url: 'https://s3/img1' } },
      { type: 'image_url', image_url: { url: 'https://s3/img2' } },
      { type: 'text', text: 'describe' },
    ]);
  });

  it('returns an empty string when the response has no content', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: null } }] });

    expect(await completeWithOpenAi('gpt-4o-mini', { prompt: 'hello', maxTokens: 256 })).toBe('');
  });

  it('throws LlmTruncatedError when finish_reason is length', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[{"title":"Dune"' }, finish_reason: 'length' }],
    });

    await expect(
      completeWithOpenAi('gpt-4o-mini', { prompt: 'hello', maxTokens: 2048 }),
    ).rejects.toThrow(LlmTruncatedError);
  });

  it('returns normally when finish_reason is stop', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'reply' }, finish_reason: 'stop' }],
    });

    expect(await completeWithOpenAi('gpt-4o-mini', { prompt: 'hello', maxTokens: 256 })).toBe('reply');
  });
});
