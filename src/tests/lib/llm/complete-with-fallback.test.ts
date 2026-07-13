import { completeWithFallback } from '../../../lib/llm/complete-with-fallback';
import { LlmUnavailableError } from '../../../lib/llm/llm-errors';
import { getLlmAdapter } from '../../../lib/llm/get-llm-adapter';
import { hasLlmApiKey } from '../../../lib/llm/has-llm-api-key';
import { ModelRef } from '../../../lib/llm/llm-types';

jest.mock('../../../lib/llm/get-llm-adapter');
jest.mock('../../../lib/llm/has-llm-api-key');

const mockGetLlmAdapter = getLlmAdapter as jest.Mock;
const mockHasLlmApiKey = hasLlmApiKey as jest.Mock;

const chain: ModelRef[] = [
  { provider: 'anthropic', model: 'claude-haiku-4-5' },
  { provider: 'openai', model: 'gpt-4o-mini' },
];
const request = { prompt: 'hello', maxTokens: 100 };

describe('completeWithFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasLlmApiKey.mockReturnValue(true);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the transformed result and model from the first model that succeeds', async () => {
    const adapter = jest.fn().mockResolvedValue('raw text');
    mockGetLlmAdapter.mockReturnValue(adapter);

    const { result, model } = await completeWithFallback(chain, request, (t) => t.toUpperCase());

    expect(result).toBe('RAW TEXT');
    expect(model).toEqual({ provider: 'anthropic', model: 'claude-haiku-4-5' });
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledWith('claude-haiku-4-5', request);
  });

  it('falls through to the next model when the adapter throws', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('network error'));
    const succeeding = jest.fn().mockResolvedValue('from openai');
    mockGetLlmAdapter.mockImplementation((provider) => (provider === 'anthropic' ? failing : succeeding));

    const { result, model } = await completeWithFallback(chain, request, (t) => t);

    expect(result).toBe('from openai');
    expect(model).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(succeeding).toHaveBeenCalledWith('gpt-4o-mini', request);
  });

  it('falls through when a model returns empty text', async () => {
    const empty = jest.fn().mockResolvedValue('   ');
    const succeeding = jest.fn().mockResolvedValue('content');
    mockGetLlmAdapter.mockImplementation((provider) => (provider === 'anthropic' ? empty : succeeding));

    const { result } = await completeWithFallback(chain, request, (t) => t);
    expect(result).toBe('content');
  });

  it('falls through when the transform throws (e.g. unparsable JSON)', async () => {
    const badJson = jest.fn().mockResolvedValue('not json');
    const goodJson = jest.fn().mockResolvedValue('{"ok":true}');
    mockGetLlmAdapter.mockImplementation((provider) => (provider === 'anthropic' ? badJson : goodJson));

    const { result } = await completeWithFallback(chain, request, (t) => JSON.parse(t));

    expect(result).toEqual({ ok: true });
  });

  it('skips providers without an API key without invoking their adapter', async () => {
    mockHasLlmApiKey.mockImplementation((provider) => provider !== 'anthropic');
    const adapter = jest.fn().mockResolvedValue('from openai');
    mockGetLlmAdapter.mockReturnValue(adapter);

    const { result } = await completeWithFallback(chain, request, (t) => t);
    expect(result).toBe('from openai');
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter).toHaveBeenCalledWith('gpt-4o-mini', request);
  });

  it('throws LlmUnavailableError with the collected causes when every model fails', async () => {
    const failing = jest.fn().mockRejectedValue(new Error('down'));
    mockGetLlmAdapter.mockReturnValue(failing);

    await expect(completeWithFallback(chain, request, (t) => t)).rejects.toThrow(LlmUnavailableError);

    try {
      await completeWithFallback(chain, request, (t) => t);
    } catch (error) {
      expect((error as LlmUnavailableError).causes).toHaveLength(2);
    }
  });

  it('throws LlmUnavailableError when no provider has an API key', async () => {
    mockHasLlmApiKey.mockReturnValue(false);

    await expect(completeWithFallback(chain, request, (t) => t)).rejects.toThrow(LlmUnavailableError);
    expect(mockGetLlmAdapter).not.toHaveBeenCalled();
  });

  describe('LOG_LLM_QUERIES gating', () => {
    const originalEnv = process.env.LOG_LLM_QUERIES;

    afterEach(() => {
      process.env.LOG_LLM_QUERIES = originalEnv;
    });

    it('does not log the prompt or query line when LOG_LLM_QUERIES is unset', async () => {
      delete process.env.LOG_LLM_QUERIES;
      const adapter = jest.fn().mockResolvedValue('raw text');
      mockGetLlmAdapter.mockReturnValue(adapter);
      await completeWithFallback(chain, request, (t) => t);

      expect(console.log).not.toHaveBeenCalled();
    });

    it('logs the prompt and query line when LOG_LLM_QUERIES=true', async () => {
      process.env.LOG_LLM_QUERIES = 'true';
      const adapter = jest.fn().mockResolvedValue('raw text');
      mockGetLlmAdapter.mockReturnValue(adapter);
      await completeWithFallback(chain, request, (t) => t);

      expect(console.log).toHaveBeenCalledWith('[anthropic:claude-haiku-4-5]\nhello');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\[llm\] query "anthropic:claude-haiku-4-5", \d+ms$/),
      );
    });

    it('still logs failures unconditionally when LOG_LLM_QUERIES is unset', async () => {
      delete process.env.LOG_LLM_QUERIES;
      const failing = jest.fn().mockRejectedValue(new Error('down'));
      mockGetLlmAdapter.mockReturnValue(failing);

      await expect(completeWithFallback(chain, request, (t) => t)).rejects.toThrow(LlmUnavailableError);

      expect(console.error).toHaveBeenCalled();
    });
  });
});
