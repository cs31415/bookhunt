import { Request, Response } from 'express';
import { getLibrary as getLibraryModel } from '../../models/library/get-library';

/**
 * @swagger
 * /library:
 *   get:
 *     tags: [Library]
 *     summary: Get the authenticated user's library
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Library entries with stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries: { type: array, items: { type: object } }
 *                 stats: { type: object }
 *       401:
 *         description: Authentication required
 */
export async function getLibrary(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const result = await getLibraryModel(userId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
