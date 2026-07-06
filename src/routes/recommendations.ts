import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { getRecommendations } from '../controllers/recommendations/get-recommendations';

const router = Router();

router.use(authRequired);

router.get('/', getRecommendations);

export default router;
