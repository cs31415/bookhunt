export class LlmUnavailableError extends Error {
  constructor(
    message: string,
    public readonly causes: unknown[],
  ) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/**
 * The model ran out of output tokens mid-answer. Distinct from a failure
 * because the cause and the remedy are different: nothing is wrong with the
 * provider, the request simply asked for more than maxTokens could hold.
 *
 * Without this, truncation surfaces as a JSON.parse error from the caller's
 * transform, which completeWithFallback cannot tell apart from a genuinely
 * broken model — so it quietly accepts the next model's shorter answer and the
 * caller sees a successful response that is missing most of its results.
 */
export class LlmTruncatedError extends Error {
  constructor(
    public readonly provider: string,
    public readonly model: string,
    public readonly maxTokens: number,
  ) {
    super(`${provider}:${model} hit its ${maxTokens}-token output limit; response is incomplete`);
    this.name = 'LlmTruncatedError';
  }
}
