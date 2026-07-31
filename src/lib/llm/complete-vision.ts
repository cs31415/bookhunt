import { CompleteOptions } from './llm-types';
import { parseModelConfig } from './parse-model-config';
import { completeWithFallback } from './complete-with-fallback';

export async function completeVision<T = string>(
  imageUrls: string[],
  prompt: string,
  options: CompleteOptions<T>,
): Promise<T> {
  const chain = parseModelConfig('LLM_VISION_MODELS');
  const transform = options.transform ?? ((rawText: string) => rawText as unknown as T);
  const { result } = await completeWithFallback(
    chain,
    {
      prompt,
      imageUrls,
      maxTokens: options.maxTokens,
      tolerateTruncation: options.tolerateTruncation,
    },
    transform,
  );
  return result;
}
