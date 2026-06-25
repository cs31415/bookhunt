import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { getRecommendations } from '../controllers/recommendations/get-recommendations';

const router = Router();

router.use(authRequired);

/**
 * @swagger
 * /recommendations:
 *   get:
 *     tags: [Recommendations]
 *     summary: Get personalized book recommendations
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 6, maximum: 20 }
 *         description: Max results (default 6, max 20)
 *       - in: query
 *         name: excludeId
 *         schema: { type: integer }
 *         description: Book ID to exclude from results
 *     responses:
 *       200:
 *         description: Personalized recommendations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       book: { type: object }
 *                       reason: { type: string }
 *       401:
 *         description: Authentication required
 */
router.get('/', getRecommendations);

export default router;
