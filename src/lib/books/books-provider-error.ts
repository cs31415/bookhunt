import { BooksProvider } from './books-types';

/**
 * A provider search that failed, as distinct from one that legitimately found
 * nothing.
 *
 * The difference decides whether retrying is worth anything: a 503 is worth
 * another go, an obscure title genuinely absent from the catalogue is not.
 * Collapsing both into `[]` is what let a single transient Google 503 read as
 * "this book does not exist".
 */
export class BooksProviderError extends Error {
  constructor(
    public readonly provider: BooksProvider,
    public readonly status: number | null,
    cause?: unknown,
    /**
     * What the provider itself said, where it said anything (LOS-393). Last in
     * the list because every existing caller passes the first three.
     */
    public readonly detail?: string | null,
  ) {
    super(
      (status === null
        ? `${provider} search request failed`
        : `${provider} search failed with ${status}`) + (detail ? `: ${detail}` : ''),
    );
    this.name = 'BooksProviderError';
    this.cause = cause;
  }
}
