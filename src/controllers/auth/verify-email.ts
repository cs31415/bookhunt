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
 *                     handle: { type: string }
 *                     isDiscoverable: { type: boolean }
 *                 token: { type: string }
 *       409:
 *         description: >
 *           This exact link was used before. The address is already confirmed,
 *           so there is nothing to do but sign in. Carries code
 *           ALREADY_VERIFIED, and deliberately no session token: one link, one
 *           sign-in, or anyone who ever saw the email keeps a way in.
 *       400:
 *         description: Unknown or expired verification token
 */
export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body ?? {};

  if (typeof token !== 'string' || token.trim().length === 0) {
    res.status(400).json({ error: 'A verification token is required.' });
    return;
  }

  try {
    const row = await verifyEmailModel(token);

    // Unknown and expired are one case: distinguishing them would tell someone
    // feeding in guessed tokens which ones exist.
    if (!row) {
      res.status(400).json({ error: 'This verification link is invalid or has expired.' });
      return;
    }

    // A link we really did send, presented a second time (LOS-298). Safe to
    // name, because holding the token is proof of having received the email --
    // and the row carries no user fields, so nothing about the account travels
    // back to whoever presented it.
    if (row.already_used) {
      res.status(409).json({
        error: 'That address is already confirmed. Sign in to carry on.',
        code: 'ALREADY_VERIFIED',
      });
      return;
    }

    const user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      handle: row.handle,
      isDiscoverable: row.is_discoverable,
    };
    res.json({ user, token: signAuthToken(user) });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
