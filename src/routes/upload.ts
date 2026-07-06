import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { presign } from '../controllers/upload/presign';
import { scan } from '../controllers/upload/scan';

const router = Router();

router.post('/presign', authRequired, presign);
router.post('/scan', authRequired, rateLimiter(60_000, 5), scan);

export default router;
