import { Request, Response } from 'express';
import { addRelated as addRelatedModel } from '../../models/library/add-related';

/**
 * @swagger
 * /library/{bookId}/related:
 *   post:
 *     tags: [Library]
 *     summary: Add a user-curated related book
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [relatedBookId]
 *             properties:
 *               relatedBookId: { type: integer }
 *     responses:
 *       200:
 *         description: Updated related books array
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userRelated: { type: array, items: { type: integer } }
 */
export async function addRelated(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const bookId = parseInt(req.params.bookId as string, 10);
    const { relatedBookId } = req.body;

    const userRelated = await addRelatedModel(userId, bookId, relatedBookId);

    res.json({ userRelated });
  } catch (error) {
    console.error('Error adding related book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
