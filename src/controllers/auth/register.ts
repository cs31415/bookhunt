import { Request, Response } from 'express';
import { registerUser } from '../../models/auth/register';
import { isValidEmail } from '../../lib/validate/is-valid-email';
import { validatePassword } from '../../lib/validate/validate-password';
import { validateDisplayName } from '../../lib/validate/validate-display-name';

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
 *             required: [email, password, displayName]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               displayName: { type: string }
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
 *                 verificationRequired: { type: boolean }
 *       400:
 *         description: Missing or malformed field
 *       409:
 *         description: Email already registered
 */
export async function register(req: Request, res: Response) {
  const { email, password, displayName } = req.body ?? {};

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) {
    res.status(400).json({ error: displayNameError });
    return;
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    res.status(400).json({ error: passwordError });
    return;
  }

  try {
    const user = await registerUser(email, password, displayName);
    res.status(201).json({ user, verificationRequired: true });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
