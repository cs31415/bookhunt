import { CompleteOptions } from './llm-types';
import { parseModelConfig } from './parse-model-config';
import { completeWithFallback, CompleteWithFallbackResult } from './complete-with-fallback';

export async function completeTextWithModel<T = string>(
  prompt: string,
  options: CompleteOptions<T>,
): Promise<CompleteWithFallbackResult<T>> {
  const chain = parseModelConfig('LLM_TEXT_MODELS');
  const transform = options.transform ?? ((rawText: string) => rawText as unknown as T);
  return completeWithFallback(chain, { prompt, maxTokens: options.maxTokens }, transform);
}

export async function completeText<T = string>(prompt: string, options: CompleteOptions<T>): Promise<T> {
  const { result } = await completeTextWithModel<T>(prompt, options);
  return result;
}
