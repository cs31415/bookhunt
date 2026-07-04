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
 *     summary: Get presigned S3 URLs for direct image upload
 *     description: |
 *       Send `{ files: [{ contentType }, …] }` (1–10 items) and receive `[{ url, key }, …]`.
 *       PUT each file directly to its returned URL (no auth header required for the S3 PUT).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [files]
 *             properties:
 *               files:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   required: [contentType]
 *                   properties:
 *                     contentType: { type: string, example: "image/jpeg" }
 *     responses:
 *       200:
 *         description: Presigned upload URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   url: { type: string }
 *                   key: { type: string }
 *       400:
 *         description: Invalid or missing files array
 */
router.post('/presign', authRequired, presign);

/**
 * @swagger
 * /upload/scan:
 *   post:
 *     tags: [Upload]
 *     summary: Scan one or more bookshelf photos and detect books via AI vision
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imageKeys]
 *             properties:
 *               imageKeys:
 *                 type: array
 *                 description: S3 keys returned from /upload/presign (1–10 items)
 *                 minItems: 1
 *                 maxItems: 10
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Detected books (deduplicated across all photos)
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
 *       400:
 *         description: imageKeys missing, empty, contains non-strings, or exceeds 10 items
 *       429:
 *         description: Rate limited (5/min)
 *       503:
 *         description: AI vision service unavailable
 */
router.post('/scan', authRequired, rateLimiter(60_000, 5), scan);

export default router;
