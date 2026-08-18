import {
  addFavoriteAuthor,
  isFavoriteAuthor,
  listFavoriteAuthors,
  listPublicFavoriteAuthors,
  removeFavoriteAuthor,
  setFavoriteAuthorVisibility,
} from '../../data/author-favorites-data';

export interface FavoriteAuthor {
  name: string;
  slug: string;
  /** How many of that author's books the reader owns. */
  bookCount: number;
  /**
   * Kept off the public page. Present on the owner's own list only -- a visitor
   * is never told that something was withheld, only shown what was not.
   */
  isHidden?: boolean;
}

function toAuthor(row: {
  name: string;
  slug: string;
  book_count: string;
  is_hidden?: boolean;
}): FavoriteAuthor {
  return {
    name: row.name,
    slug: row.slug,
    bookCount: Number(row.book_count),
    ...(row.is_hidden === undefined ? {} : { isHidden: row.is_hidden }),
  };
}

export const favoriteAuthor = addFavoriteAuthor;
export const setAuthorVisibility = setFavoriteAuthorVisibility;
export const unfavoriteAuthor = removeFavoriteAuthor;
export const isFavorite = isFavoriteAuthor;

export async function myFavoriteAuthors(userId: number): Promise<FavoriteAuthor[]> {
  return (await listFavoriteAuthors(userId)).map(toAuthor);
}

/** Empty for an unknown handle and for a private page alike, as everywhere else. */
export async function publicFavoriteAuthors(handle: string): Promise<FavoriteAuthor[]> {
  return (await listPublicFavoriteAuthors(handle)).map(toAuthor);
}
