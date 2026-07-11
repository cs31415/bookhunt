import { addToLibrary } from '../../data/library-data';

export async function addExistingToLibrary(userId: number, bookId: number, status: string) {
  return addToLibrary(userId, bookId, status);
}
