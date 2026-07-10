import { LlmProvider } from './llm-types';

const API_KEY_ENV_VARS: Record<LlmProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GEMINI_API_KEY',
};

export function hasLlmApiKey(provider: LlmProvider): boolean {
  return Boolean(process.env[API_KEY_ENV_VARS[provider]]);
}
