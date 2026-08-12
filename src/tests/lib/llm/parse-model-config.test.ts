import { parseModelConfig } from '../../../lib/llm/parse-model-config';

describe('parseModelConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.LLM_TEXT_MODELS;
    delete process.env.ANTHROPIC_MODEL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses a multi-entry provider:model list in order', () => {
    process.env.LLM_TEXT_MODELS = 'anthropic:claude-haiku-4-5,openai:gpt-4o-mini,google:gemini-2.5-flash';

    expect(parseModelConfig('LLM_TEXT_MODELS')).toEqual([
      { provider: 'anthropic', model: 'claude-haiku-4-5' },
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'google', model: 'gemini-2.5-flash' },
    ]);
  });

  it('trims whitespace around entries', () => {
    process.env.LLM_TEXT_MODELS = ' anthropic:claude-haiku-4-5 , openai:gpt-4o-mini ';

    expect(parseModelConfig('LLM_TEXT_MODELS')).toEqual([
      { provider: 'anthropic', model: 'claude-haiku-4-5' },
      { provider: 'openai', model: 'gpt-4o-mini' },
    ]);
  });

  it('rejects an unknown provider', () => {
    process.env.LLM_TEXT_MODELS = 'mistral:mistral-small';

    expect(() => parseModelConfig('LLM_TEXT_MODELS')).toThrow(/Invalid LLM_TEXT_MODELS entry/);
  });

  it('rejects an entry without a model', () => {
    process.env.LLM_TEXT_MODELS = 'anthropic:';

    expect(() => parseModelConfig('LLM_TEXT_MODELS')).toThrow(/Invalid LLM_TEXT_MODELS entry/);
  });

  it('falls back to ANTHROPIC_MODEL when the chain var is unset', () => {
    process.env.ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

    expect(parseModelConfig('LLM_TEXT_MODELS')).toEqual([
      { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    ]);
  });

  it('throws when nothing is configured', () => {
    expect(() => parseModelConfig('LLM_TEXT_MODELS')).toThrow(/No LLM models configured/);
  });
});
