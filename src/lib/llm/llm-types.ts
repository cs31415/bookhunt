export type LlmProvider = 'anthropic' | 'openai' | 'google';

export interface ModelRef {
  provider: LlmProvider;
  model: string;
}

export interface LlmRequest {
  prompt: string;
  imageUrls?: string[];
  maxTokens: number;
  /**
   * Accept a response that hit the output limit instead of rejecting it. Set for
   * prose, where a summary cut off mid-sentence still beats no summary; leave
   * unset when the whole response has to parse, since a truncated JSON payload
   * is worthless.
   */
  tolerateTruncation?: boolean;
}

export type LlmAdapter = (model: string, request: LlmRequest) => Promise<string>;

export interface CompleteOptions<T> {
  maxTokens: number;
  transform?: (rawText: string) => T;
  /** See LlmRequest.tolerateTruncation. */
  tolerateTruncation?: boolean;
}
