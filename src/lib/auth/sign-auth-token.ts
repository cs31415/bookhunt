import jwt from 'jsonwebtoken';

export interface AuthTokenSubject {
  id: number;
  email: string;
}

/**
 * The one place a session token is minted. Login and email verification both
 * issue one, and the two copies of this block had already drifted apart in
 * everything but behaviour before they were pulled together here.
 *
 * Registration no longer calls it: an account is not signed in until its
 * address is verified (LOS-218).
 */
export function signAuthToken(subject: AuthTokenSubject): string {
  return jwt.sign({ id: subject.id, email: subject.email }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
}
