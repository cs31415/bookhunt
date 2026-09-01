import { createInviteRequest } from '../../data/auth-data';
import { normalizeEmail } from '../../lib/validate/normalize-email';

/** Longer than this is not a sentence about yourself, it is a payload. */
export const MAX_NOTE_LENGTH = 500;

/**
 * Records a request to be invited (LOS-381).
 *
 * Sends nothing. Not to the requester -- a public form that mailed an invite
 * would be the vector LOS-376 closed, carrying a working credential this time
 * -- and not to the operator either, because a per-request notification just
 * moves a flood from a table into an inbox. The daily digest reads these
 * instead.
 *
 * Never throws for a duplicate. Asking twice is what a person does when nothing
 * has happened, and there is no unique index to collide with.
 */
export async function requestInvite(email: string, note: string | null): Promise<void> {
  const trimmed = note?.trim() ?? '';
  await createInviteRequest(
    normalizeEmail(email),
    trimmed === '' ? null : trimmed.slice(0, MAX_NOTE_LENGTH),
  );
}
