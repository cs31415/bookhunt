import { Request, Response } from 'express';
import { updateProfile } from '../../models/users/update-profile';
import { validateDisplayName } from '../../lib/validate/validate-display-name';
import { validateHandle } from '../../lib/validate/validate-handle';
import { normalizeHandle } from '../../lib/validate/normalize-handle';

// The only handle constraint on this table; anything else raising 23505 here
// would be about the address, which settings cannot change.
const HANDLE_CONSTRAINT = 'idx_users_handle_lower';

/**
 * @swagger
 * /users/me:
 *   put:
 *     tags: [Users]
 *     summary: Update the signed-in reader's profile
 *     description: >
 *       Every field is optional; an absent one is left alone. isDiscoverable is
 *       the master switch for the public profile at bookhunt.net/{handle} and
 *       is off by default.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName: { type: string }
 *               handle: { type: string }
 *               isDiscoverable: { type: boolean }
 *               preferences:
 *                 type: object
 *                 description: >
 *                   Merged into the stored document rather than replacing it,
 *                   so saving one key cannot drop another.
 *     responses:
 *       200:
 *         description: The updated profile
 *       400:
 *         description: A field was sent but is not valid
 *       409:
 *         description: The handle is taken (code HANDLE_TAKEN, field handle)
 */
export async function updateMe(req: Request, res: Response) {
  const { displayName, handle, isDiscoverable, shareReviews, preferences } = req.body ?? {};

  if (displayName !== undefined) {
    const error = validateDisplayName(displayName);
    if (error) {
      res.status(400).json({ error, field: 'displayName' });
      return;
    }
  }

  // Judged in canonical form, as at registration, so "Ada" renames to @ada
  // rather than being refused for a capital letter.
  const normalizedHandle = handle === undefined ? undefined : normalizeHandle(String(handle));
  if (normalizedHandle !== undefined) {
    const error = validateHandle(normalizedHandle);
    if (error) {
      res.status(400).json({ error, field: 'handle' });
      return;
    }
  }

  if (isDiscoverable !== undefined && typeof isDiscoverable !== 'boolean') {
    res.status(400).json({ error: 'isDiscoverable must be true or false.' });
    return;
  }

  if (shareReviews !== undefined && typeof shareReviews !== 'boolean') {
    res.status(400).json({ error: 'shareReviews must be true or false.' });
    return;
  }

  // A plain object, not an array and not null. The column is one document
  // merged key by key, so anything else would either be discarded by the merge
  // or, in the case of null, silently mean "no change" when the caller meant
  // something.
  if (
    preferences !== undefined &&
    (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences))
  ) {
    res.status(400).json({ error: 'preferences must be an object.' });
    return;
  }

  try {
    const user = await updateProfile(req.user!.id, {
      displayName,
      handle: normalizedHandle,
      isDiscoverable,
      shareReviews,
      preferences,
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err: any) {
    // The same 409 registration answers, so a rename and a sign-up fail
    // identically and the form has one case to handle.
    if (err.code === '23505' && err.constraint === HANDLE_CONSTRAINT) {
      res.status(409).json({
        error: 'That handle is taken.',
        code: 'HANDLE_TAKEN',
        field: 'handle',
      });
      return;
    }
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
