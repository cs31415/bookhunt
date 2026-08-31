import { updateLibraryEntry } from '../../data/library-data';

interface UpdateEntryParams {
  status?: string | null;
  userRating?: number | null;
  /**
   * The reader's own words. Called `notes` until LOS-266 -- the column named
   * `review` was plumbed end to end and never written, so the schema promised a
   * public/private split the product never built.
   */
  review?: string | null;
}

export async function updateEntry(userId: number, bookId: number, params: UpdateEntryParams) {
  return updateLibraryEntry(
    userId,
    bookId,
    params.status ?? null,
    params.userRating ?? null,
    params.review ?? null,
  );
}
