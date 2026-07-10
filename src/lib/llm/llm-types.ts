export type LlmProvider = 'anthropic' | 'openai' | 'google';

export interface ModelRef {
  provider: LlmProvider;
  model: string;
}

export interface LlmRequest {
  prompt: string;
  imageUrls?: string[];
  maxTokens: number;
}

export type LlmAdapter = (model: string, request: LlmRequest) => Promise<string>;

export interface CompleteOptions<T> {
  maxTokens: number;
  transform?: (rawText: string) => T;
}
