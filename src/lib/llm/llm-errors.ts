export class LlmUnavailableError extends Error {
  constructor(
    message: string,
    public readonly causes: unknown[],
  ) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}
