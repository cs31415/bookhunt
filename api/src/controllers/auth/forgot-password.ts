import { Request, Response } from 'express';
import crypto from 'crypto';
import { setResetToken } from '../../models/auth/forgot-password';

export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    const resetToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await setResetToken(email, resetToken, expiresAt);

    res.json({ ok: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
