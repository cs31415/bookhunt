import { LlmRequest, ModelRef } from './llm-types';
import { LlmUnavailableError } from './llm-errors';
import { getLlmAdapter } from './get-llm-adapter';
import { hasLlmApiKey } from './has-llm-api-key';

/**
 * Try each model in the chain until one produces a usable result. A model fails
 * when its adapter throws, it returns empty text, or the caller's transform
 * throws (e.g. unparsable JSON) — the transform runs per attempt so a bad
 * response from one model falls through to the next.
 */
export async function completeWithFallback<T>(
  chain: ModelRef[],
  request: LlmRequest,
  transform: (rawText: string) => T,
): Promise<T> {
  const causes: unknown[] = [];

  for (const { provider, model } of chain) {
    if (!hasLlmApiKey(provider)) {
      console.warn(`[llm] skipping ${provider}:${model}: no API key configured`);
      continue;
    }
    try {
      const rawText = await getLlmAdapter(provider)(model, request);
      if (!rawText.trim()) {
        throw new Error('empty response');
      }
      return transform(rawText);
    } catch (error) {
      console.error(`[llm] ${provider}:${model} failed, trying next model:`, error);
      causes.push(error);
    }
  }

  throw new LlmUnavailableError('All configured LLM models failed', causes);
}
