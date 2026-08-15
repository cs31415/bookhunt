import { Request, Response } from 'express';
import { registerUser } from '../../models/auth/register';
import { isValidEmail } from '../../lib/validate/is-valid-email';
import { validatePassword } from '../../lib/validate/validate-password';
import { validateDisplayName } from '../../lib/validate/validate-display-name';
import { validateHandle } from '../../lib/validate/validate-handle';
import { normalizeHandle } from '../../lib/validate/normalize-handle';

// idx_users_handle_lower is the only handle constraint; everything else that
// raises 23505 on this table is about the address.
const HANDLE_CONSTRAINT = 'idx_users_handle_lower';

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: >
 *       Creates an unverified account and emails a verification link. No token
 *       is issued here: sign-in is refused until the address is confirmed via
 *       /auth/verify-email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, displayName, handle]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               displayName: { type: string }
 *               handle:
 *                 type: string
 *                 description: >
 *                   3-30 characters, starting with a letter, then letters,
 *                   numbers and underscores. Stored lowercase. Becomes the
 *                   public profile URL, so reserved words are refused.
 *     responses:
 *       201:
 *         description: Account created, verification email sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     email: { type: string }
 *                     displayName: { type: string }
 *                     handle: { type: string }
 *                 verificationRequired: { type: boolean }
 *       400:
 *         description: Missing or malformed field
 *       409:
 *         description: >
 *           Email already registered, or the handle is taken (code
 *           HANDLE_TAKEN, field handle)
 */
export async function register(req: Request, res: Response) {
  const { email, password, displayName, handle } = req.body ?? {};

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) {
    res.status(400).json({ error: displayNameError });
    return;
  }

  // Judged in its canonical form, so "Ada" is accepted and stored as @ada
  // rather than refused for a capital letter the reader cannot see the harm in.
  const normalizedHandle = typeof handle === 'string' ? normalizeHandle(handle) : handle;
  const handleError = validateHandle(normalizedHandle);
  if (handleError) {
    res.status(400).json({ error: handleError, field: 'handle' });
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  try {
    const user = await registerUser(email, password, displayName, normalizedHandle);
    res.status(201).json({ user, verificationRequired: true });
  } catch (err: any) {
    // Both collisions arrive as 23505. Saying "already registered" about the
    // address when it was the handle that clashed sends the reader to change
    // the wrong field, so the constraint name decides which message they get.
    if (err.code === '23505') {
      if (err.constraint === HANDLE_CONSTRAINT) {
        res.status(409).json({ error: 'That handle is taken.', code: 'HANDLE_TAKEN', field: 'handle' });
        return;
      }
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
