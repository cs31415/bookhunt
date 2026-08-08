import { Resend } from 'resend';

// Built on first use rather than at import time: dotenv.config() runs in
// index.ts after the import graph resolves, so a module-level const off
// process.env would read undefined. Same shape as getPool() in lib/db.ts.
let _resend: Resend | null = null;

export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/** Test hook: forces the next getResend() to read the current env. */
export function resetResendClient(): void {
  _resend = null;
}
