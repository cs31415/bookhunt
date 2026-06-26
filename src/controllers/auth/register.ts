import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { registerUser } from '../../models/auth/register';

export async function register(req: Request, res: Response) {
  try {
    const { email, password, displayName } = req.body;

    const passwordHash = await bcrypt.hash(password, 10);
    const row = await registerUser(email, passwordHash, displayName);

    const user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
    };

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions,
    );

    res.json({ user, token });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
