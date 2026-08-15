import { setLibraryFavorite } from '../../data/library-data';

/**
 * Marks or unmarks one owned book as a favourite. Returns null when the reader
 * does not own it, which the controller reads as a 404.
 */
export async function setFavorite(userId: number, bookId: number, isFavorite: boolean) {
  return setLibraryFavorite(userId, bookId, isFavorite);
}
