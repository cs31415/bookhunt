import { isHandleAvailable as queryAvailability } from '../../data/users-data';
import { normalizeHandle } from '../../lib/validate/normalize-handle';
import { validateHandle } from '../../lib/validate/validate-handle';

export interface HandleCheck {
  handle: string;
  available: boolean;
  /** Why it cannot be used, or null when it can. */
  reason: string | null;
}

/**
 * Answers the sign-up form's live check. A malformed or reserved handle is
 * unavailable for a reason worth showing, so the shape is the same either way
 * rather than a bare boolean the form would have to interpret.
 *
 * The database is only consulted once the handle is known to be well formed --
 * there is no point asking whether "ada reader" is taken.
 */
export async function checkHandle(rawHandle: string): Promise<HandleCheck> {
  const handle = normalizeHandle(rawHandle);

  const reason = validateHandle(handle);
  if (reason) return { handle, available: false, reason };

  const available = await queryAvailability(handle);
  return {
    handle,
    available,
    reason: available ? null : 'That handle is taken.',
  };
}
