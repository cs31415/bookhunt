import { setLibraryAudiobook } from '../../data/library-data';

/**
 * Records whether one owned book is an audiobook. Independent of the ebook
 * flag — a reader can own both. Returns null when the reader does not own the
 * book, which the controller reads as a 404.
 */
export async function setAudiobook(userId: number, bookId: number, isAudiobook: boolean) {
  return setLibraryAudiobook(userId, bookId, isAudiobook);
}
