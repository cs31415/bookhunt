import { updateLibraryEntry } from '../../data/library-data';

interface UpdateEntryParams {
  status?: string | null;
  userRating?: number | null;
  notes?: string | null;
  review?: string | null;
}

export async function updateEntry(userId: number, bookId: number, params: UpdateEntryParams) {
  return updateLibraryEntry(
    userId,
    bookId,
    params.status ?? null,
    params.userRating ?? null,
    params.notes ?? null,
    params.review ?? null,
  );
}
