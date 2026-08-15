import { setLibraryVisibility } from '../../data/library-data';

/**
 * Hides or unhides one owned book on the reader's public profile. Returns null
 * when the reader does not own it, which the controller reads as a 404.
 */
export async function setVisibility(userId: number, bookId: number, isHidden: boolean) {
  return setLibraryVisibility(userId, bookId, isHidden);
}
