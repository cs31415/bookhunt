import { randomUUID } from 'crypto';
import {
  getLibraryByToken,
  getProfileByToken,
  getShareToken,
  setShareToken,
} from '../../data/users-data';
import type { PublicLibraryQuery } from './public-profile';
import { publicLibraryFilters } from './public-profile';
import type { PublicProfile } from './public-profile';

/**
 * A profile reachable by anyone holding the link, and listed nowhere (LOS-305).
 *
 * The token is the whole credential, so it is generated rather than derived:
 * randomUUID gives 122 random bits from the platform CSPRNG, and holding one
 * token tells you nothing about any other. A token derived from the handle or
 * the id would let anyone with one link compute everybody else's.
 *
 * There is no separate "unlisted" flag. The token's presence is the state:
 * none means private, one means unlisted, and is_discoverable is the third
 * state on top of both.
 */
export function myShareToken(userId: number): Promise<string | null> {
  return getShareToken(userId);
}

/**
 * Mints a token, replacing any that exists.
 *
 * Regenerating and creating are the same operation on purpose: the only way to
 * take back a link that has spread is to overwrite it, and a reader who asks
 * for a link twice should not have to know which of the two they are doing.
 */
export function regenerateShareToken(userId: number): Promise<string | null> {
  return setShareToken(userId, randomUUID());
}

/** Back to private. The old link stops working immediately. */
export function revokeShareToken(userId: number): Promise<string | null> {
  return setShareToken(userId, null);
}

/**
 * Null for an unknown token and for a revoked one alike. The caller 404s both,
 * as it does for an unknown handle -- a different answer for each would say
 * whether a token had ever been valid.
 */
export async function profileByToken(token: string): Promise<PublicProfile | null> {
  const row = await getProfileByToken(token);
  if (!row) return null;

  return {
    handle: row.handle,
    displayName: row.display_name,
    joinedAt: row.created_at,
    counts: {
      total: Number(row.total_books),
      reading: Number(row.reading_count),
      finished: Number(row.finished_count),
      favorites: Number(row.favorite_count),
    },
  };
}

/**
 * The shared shelf. Reuses the public library's own query parsing, so search,
 * categories, paging and the unrecognised-status rule behave identically on
 * both addresses rather than drifting apart.
 */
export async function libraryByToken(token: string, query: PublicLibraryQuery) {
  const parsed = publicLibraryFilters(query);
  if (parsed.rejected) {
    return { entries: [], total: 0, page: parsed.page, pageSize: parsed.pageSize };
  }

  const rows = await getLibraryByToken(token, parsed.filters);

  return {
    entries: rows,
    total: rows.length > 0 ? Number(rows[0].total_count) : 0,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}
