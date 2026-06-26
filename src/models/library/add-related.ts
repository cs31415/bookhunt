import { addUserRelated } from '../../data/library-data';

export async function addRelated(userId: number, bookId: number, relatedBookId: number) {
  return addUserRelated(userId, bookId, relatedBookId);
}
