import { removeFromLibrary } from '../../data/library-data';

export async function removeEntry(userId: number, bookId: number) {
  return removeFromLibrary(userId, bookId);
}
