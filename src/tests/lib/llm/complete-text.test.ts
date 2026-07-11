import { completeText, completeTextWithModel } from '../../../lib/llm/complete-text';
import { completeWithFallback } from '../../../lib/llm/complete-with-fallback';
import { parseModelConfig } from '../../../lib/llm/parse-model-config';

jest.mock('../../../lib/llm/complete-with-fallback');
jest.mock('../../../lib/llm/parse-model-config');

const mockCompleteWithFallback = completeWithFallback as jest.Mock;
const mockParseModelConfig = parseModelConfig as jest.Mock;

describe('completeTextWithModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseModelConfig.mockReturnValue([{ provider: 'google', model: 'gemini-3.1-flash-lite' }]);
  });

  it('builds the chain from LLM_TEXT_MODELS and returns the result and model', async () => {
    mockCompleteWithFallback.mockResolvedValue({
      result: 'raw text',
      model: { provider: 'google', model: 'gemini-3.1-flash-lite' },
    });

    const { result, model } = await completeTextWithModel('prompt', { maxTokens: 100 });

    expect(mockParseModelConfig).toHaveBeenCalledWith('LLM_TEXT_MODELS');
    expect(mockCompleteWithFallback).toHaveBeenCalledWith(
      [{ provider: 'google', model: 'gemini-3.1-flash-lite' }],
      { prompt: 'prompt', maxTokens: 100 },
      expect.any(Function),
    );
    expect(result).toBe('raw text');
    expect(model).toEqual({ provider: 'google', model: 'gemini-3.1-flash-lite' });
  });
});

describe('completeText', () => {
  it('returns only the result, discarding the model', async () => {
    mockParseModelConfig.mockReturnValue([{ provider: 'google', model: 'gemini-3.1-flash-lite' }]);
    mockCompleteWithFallback.mockResolvedValue({
      result: 'raw text',
      model: { provider: 'google', model: 'gemini-3.1-flash-lite' },
    });

    expect(await completeText('prompt', { maxTokens: 100 })).toBe('raw text');
  });
});
