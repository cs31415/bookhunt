/**
 * The canonical form of an address, and the only form that reaches the
 * database. Registration used to store whatever was typed while lookups matched
 * on LOWER(email), so A@b.com and a@b.com became two accounts that then fought
 * over every sign-in (LOS-218).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
