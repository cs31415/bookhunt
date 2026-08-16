import { setLibraryEbook } from '../../data/library-data';

/**
 * Records whether one owned book is an ebook or a physical copy. Returns null
 * when the reader does not own it, which the controller reads as a 404.
 */
export async function setEbook(userId: number, bookId: number, isEbook: boolean) {
  return setLibraryEbook(userId, bookId, isEbook);
}
