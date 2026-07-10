import { LlmAdapter, LlmProvider } from './llm-types';
import { completeWithAnthropic } from './anthropic-adapter';
import { completeWithOpenAi } from './openai-adapter';
import { completeWithGemini } from './gemini-adapter';

export function getLlmAdapter(provider: LlmProvider): LlmAdapter {
  switch (provider) {
    case 'anthropic':
      return completeWithAnthropic;
    case 'openai':
      return completeWithOpenAi;
    case 'google':
      return completeWithGemini;
  }
}
