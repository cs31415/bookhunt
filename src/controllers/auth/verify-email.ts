import { Request, Response } from 'express';
import { verifyEmail as verifyEmailModel } from '../../models/auth/verify-email';
import { signAuthToken } from '../../lib/auth/sign-auth-token';

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm an email address using the token from the sign-up email
 *     description: >
 *       Returns a session token on success, so following the link from the
 *       email signs the reader in rather than handing them back to the login
 *       form. Tokens are single-use and expire after 24 hours.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Address verified and signed in
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
 *                 token: { type: string }
 *       400:
 *         description: Invalid, expired or already-used verification token
 */
export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body ?? {};

  if (typeof token !== 'string' || token.trim().length === 0) {
    res.status(400).json({ error: 'A verification token is required.' });
    return;
  }

  try {
    const row = await verifyEmailModel(token);

    // Unknown, expired and already-spent are one case here. Distinguishing them
    // would tell someone feeding in guessed tokens which ones exist.
    if (!row) {
      res.status(400).json({ error: 'This verification link is invalid or has expired.' });
      return;
    }

    const user = { id: row.id, email: row.email, displayName: row.display_name };
    res.json({ user, token: signAuthToken(user) });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
