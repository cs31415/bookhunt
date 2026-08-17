import { addToLibrary } from '../../data/library-data';
import type { LibraryFormatFlags } from '../../data/library-data';

export async function addExistingToLibrary(
  userId: number,
  bookId: number,
  status: string,
  // An import knows the format from the same CSV row as the title, so it is set
  // in this write rather than in a second request per book (LOS-273).
  format: LibraryFormatFlags = {},
) {
  return addToLibrary(userId, bookId, status, format);
}
