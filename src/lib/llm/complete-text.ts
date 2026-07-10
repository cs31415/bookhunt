import { CompleteOptions } from './llm-types';
import { parseModelConfig } from './parse-model-config';
import { completeWithFallback } from './complete-with-fallback';

export async function completeText<T = string>(prompt: string, options: CompleteOptions<T>): Promise<T> {
  const chain = parseModelConfig('LLM_TEXT_MODELS');
  const transform = options.transform ?? ((rawText: string) => rawText as unknown as T);
  return completeWithFallback(chain, { prompt, maxTokens: options.maxTokens }, transform);
}
