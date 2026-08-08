import { Router } from 'express';
import { register } from '../controllers/auth/register';
import { login } from '../controllers/auth/login';
import { forgotPassword } from '../controllers/auth/forgot-password';
import { resetPassword } from '../controllers/auth/reset-password';
import { verifyEmail } from '../controllers/auth/verify-email';
import { resendVerification } from '../controllers/auth/resend-verification';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

const HOUR = 60 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

// These are the only unauthenticated endpoints that create accounts, send mail
// or test credentials, and until LOS-218 none of them had a limit at all. The
// limits are per IP and, because express-rate-limit defaults to an in-memory
// store, per process -- they slow down a single abusive client, and are not a
// distributed control. Moving them onto the Redis in lib/cache is the upgrade
// path if this ever runs on more than one instance.
router.post('/register', rateLimiter(HOUR, 10), register);
router.post('/login', rateLimiter(FIFTEEN_MINUTES, 20), login);
router.post('/forgot-password', rateLimiter(HOUR, 5), forgotPassword);
router.post('/reset-password', rateLimiter(HOUR, 10), resetPassword);
router.post('/verify-email', rateLimiter(HOUR, 20), verifyEmail);
router.post('/resend-verification', rateLimiter(HOUR, 5), resendVerification);

export default router;
