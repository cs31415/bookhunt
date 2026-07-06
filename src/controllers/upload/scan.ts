import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { detectBooksFromImages } from '../../models/upload/scan';

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
export async function scan(req: Request, res: Response) {
  try {
    const { imageKeys } = req.body;

    if (!Array.isArray(imageKeys) || imageKeys.length === 0) {
      res.status(400).json({ error: 'imageKeys must be a non-empty array' });
      return;
    }

    if (imageKeys.length > 10) {
      res.status(400).json({ error: 'imageKeys must contain at most 10 items' });
      return;
    }

    if (!imageKeys.every((k) => typeof k === 'string')) {
      res.status(400).json({ error: 'imageKeys must be an array of strings' });
      return;
    }

    const detectedBooks = await detectBooksFromImages(imageKeys);
    res.json({ detectedBooks });
  } catch (error) {
    console.error('Error scanning bookshelf:', error);
    if (error instanceof Anthropic.APIError) {
      res.status(503).json({ error: 'Book detection service unavailable' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
