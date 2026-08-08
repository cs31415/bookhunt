import { Request, Response } from 'express';
import { resendVerification as resendVerificationModel } from '../../models/auth/resend-verification';
import { isValidEmail } from '../../lib/validate/is-valid-email';

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     tags: [Auth]
 *     summary: Send a fresh verification link
 *     description: >
 *       Always returns ok, whether or not the address has an account and
 *       whether or not it is already verified, so the endpoint cannot be used
 *       to discover which addresses are registered.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Always returns ok (no email leak)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 */
export async function resendVerification(req: Request, res: Response) {
  const { email } = req.body ?? {};

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }

  try {
    await resendVerificationModel(email);
    res.json({ ok: true });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
