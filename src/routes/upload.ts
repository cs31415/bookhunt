import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { presign } from '../controllers/upload/presign';
import { scan } from '../controllers/upload/scan';

const router = Router();

/**
 * @swagger
 * /upload/presign:
 *   post:
 *     tags: [Upload]
 *     summary: Get a presigned URL for image upload
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentType]
 *             properties:
 *               contentType: { type: string, example: "image/jpeg" }
 *     responses:
 *       200:
 *         description: Presigned upload URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url: { type: string }
 *                 key: { type: string }
 *       400:
 *         description: Invalid content type
 */
router.post('/presign', authRequired, presign);

/**
 * @swagger
 * /upload/scan:
 *   post:
 *     tags: [Upload]
 *     summary: Scan a bookshelf photo and detect books via AI vision
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imageKey]
 *             properties:
 *               imageKey: { type: string, description: Key returned from /upload/presign }
 *     responses:
 *       200:
 *         description: Detected books
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 detectedBooks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title: { type: string }
 *                       author: { type: string, nullable: true }
 *                       matchedBookId: { type: integer }
 *       429:
 *         description: Rate limited (5/min)
 *       503:
 *         description: AI vision service unavailable
 */
router.post('/scan', authRequired, rateLimiter(60_000, 5), scan);

export default router;
