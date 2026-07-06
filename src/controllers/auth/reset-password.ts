import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { resetPassword as resetPasswordModel } from '../../models/auth/reset-password';

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *       400:
 *         description: Invalid or expired reset token
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, password } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);
    const success = await resetPasswordModel(token, passwordHash);

    if (!success) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
