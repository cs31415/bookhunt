import { removeUserRelated } from '../../data/library-data';

export async function removeRelated(userId: number, bookId: number, relatedBookId: number) {
  return removeUserRelated(userId, bookId, relatedBookId);
}
