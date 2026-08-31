import { updateUserProfile } from '../../data/users-data';
import { normalizeHandle } from '../../lib/validate/normalize-handle';

export interface UpdateProfileParams {
  displayName?: string;
  handle?: string;
  isDiscoverable?: boolean;
  /** Whether reviews appear on the public page at all (LOS-266). */
  shareReviews?: boolean;
  /** Merged into the stored document, never assigned over it. */
  preferences?: Record<string, unknown>;
}

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  handle: string;
  isDiscoverable: boolean;
  shareReviews: boolean;
  preferences: Record<string, unknown>;
}

/**
 * Applies the fields a reader can change from settings. Absent means unchanged;
 * `isDiscoverable` and `shareReviews` both need telling apart from a value,
 * since false is what takes a public page -- or a published review -- down
 * again.
 *
 * Throws the raw Postgres 23505 on a taken handle for the controller to map,
 * exactly as registration does, so a rename and a sign-up fail identically.
 */
export async function updateProfile(
  userId: number,
  params: UpdateProfileParams,
): Promise<UserProfile | null> {
  const row = await updateUserProfile(
    userId,
    params.displayName?.trim() ?? null,
    params.handle === undefined ? null : normalizeHandle(params.handle),
    params.isDiscoverable ?? null,
    params.isDiscoverable !== undefined,
    params.shareReviews ?? null,
    params.shareReviews !== undefined,
    params.preferences ?? null,
  );

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    handle: row.handle,
    isDiscoverable: row.is_discoverable,
    shareReviews: row.share_reviews,
    preferences: row.preferences ?? {},
  };
}
