import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: number;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser | null;
    }
  }
}

function extractUser(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as AuthUser;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const user = extractUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  req.user = user;
  next();
}

export function authOptional(req: Request, res: Response, next: NextFunction): void {
  req.user = extractUser(req);
  next();
}
