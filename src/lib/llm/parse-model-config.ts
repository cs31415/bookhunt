import { LlmProvider, ModelRef } from './llm-types';

const PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai', 'google'];

export function parseModelConfig(envVarName: 'LLM_TEXT_MODELS' | 'LLM_VISION_MODELS'): ModelRef[] {
  const raw = process.env[envVarName]?.trim();

  if (!raw) {
    const legacyModel = process.env.ANTHROPIC_MODEL?.trim();
    if (legacyModel) {
      return [{ provider: 'anthropic', model: legacyModel }];
    }
    throw new Error(
      `No LLM models configured: set ${envVarName} (e.g. "anthropic:claude-haiku-4-5,openai:gpt-4o-mini")`,
    );
  }

  return raw.split(',').map((entry) => {
    const trimmed = entry.trim();
    const separatorIndex = trimmed.indexOf(':');
    const provider = trimmed.slice(0, separatorIndex) as LlmProvider;
    const model = trimmed.slice(separatorIndex + 1).trim();
    if (separatorIndex < 1 || !model || !PROVIDERS.includes(provider)) {
      throw new Error(
        `Invalid ${envVarName} entry "${trimmed}": expected "provider:model" with provider one of ${PROVIDERS.join(', ')}`,
      );
    }
    return { provider, model };
  });
}
