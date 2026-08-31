import { setLibraryReviewSharing } from '../../data/library-data';

/**
 * Publishes, holds back, or defers one review.
 *
 * `share` is a tri-state: true always shows it, false always hides it, and null
 * inherits the reader's global setting. Null is a value here rather than an
 * absence, which is why it is passed straight through (LOS-266).
 *
 * Returns null when the reader does not own the book, which the controller
 * reads as a 404.
 */
export async function setReviewSharing(userId: number, bookId: number, share: boolean | null) {
  return setLibraryReviewSharing(userId, bookId, share);
}
