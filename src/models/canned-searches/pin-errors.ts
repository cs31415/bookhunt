/** The reader already holds the maximum number of pins. */
export class PinLimitReachedError extends Error {
  constructor(public readonly limit: number) {
    super(`Cannot pin more than ${limit} searches`);
    this.name = 'PinLimitReachedError';
  }
}

/** The text a reader tried to save is empty, trivial, or absurdly long. */
export class InvalidSavedQueryError extends Error {
  constructor(public readonly min: number, public readonly max: number) {
    super(`A saved search must be between ${min} and ${max} characters`);
    this.name = 'InvalidSavedQueryError';
  }
}

/** No active canned search with that id -- a bad id, or one since retired. */
export class UnknownCannedSearchError extends Error {
  constructor(public readonly cannedSearchId: number) {
    super(`No active canned search with id ${cannedSearchId}`);
    this.name = 'UnknownCannedSearchError';
  }
}
