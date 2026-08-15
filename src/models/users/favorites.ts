import {
  addUserFavorite,
  getFavoriteState,
  listUserFavorites,
  removeUserFavorite,
  searchUsers,
} from '../../data/users-data';
import { normalizeHandle } from '../../lib/validate/normalize-handle';

export interface UserSummary {
  handle: string;
  displayName: string;
  bookCount: number;
}

const MAX_RESULTS = 10;

/**
 * Finds readers for the @ search. Only those who have published a page are
 * findable -- searching would otherwise enumerate accounts that deliberately
 * stayed private.
 */
export async function findUsers(query: string): Promise<UserSummary[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const rows = await searchUsers(trimmed, MAX_RESULTS);
  return rows.map((row) => ({
    handle: row.handle,
    displayName: row.display_name,
    bookCount: Number(row.book_count),
  }));
}

export function favoriteUser(userId: number, handle: string) {
  return addUserFavorite(userId, normalizeHandle(handle));
}

export function unfavoriteUser(userId: number, handle: string) {
  return removeUserFavorite(userId, normalizeHandle(handle));
}

export interface FavoriteUser {
  handle: string;
  displayName: string;
  /** Both directions exist, so the two can message each other. */
  isMutual: boolean;
}

export async function myFavorites(userId: number): Promise<FavoriteUser[]> {
  const rows = await listUserFavorites(userId);
  return rows.map((row) => ({
    handle: row.handle,
    displayName: row.display_name,
    isMutual: row.is_mutual,
  }));
}

export async function favoriteState(userId: number, handle: string) {
  const row = await getFavoriteState(userId, normalizeHandle(handle));
  if (!row) return null;
  return { isFavorite: row.is_favorite, isMutual: row.is_mutual };
}
