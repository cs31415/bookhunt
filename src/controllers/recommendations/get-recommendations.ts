import { Request, Response } from 'express';
import { getRecommendations as getRecommendationsModel } from '../../models/recommendations/get-recommendations';

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
export async function getRecommendations(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 6, 20);
    const excludeId = req.query.excludeId
      ? parseInt(req.query.excludeId as string, 10)
      : null;

    let rows = await getRecommendationsModel(userId, limit);
    if (excludeId) {
      rows = rows.filter((row: any) => row.book_id !== excludeId);
    }

    const recommendations = rows.map((row: any) => ({
      book: {
        id: row.book_id,
        slug: row.slug,
        title: row.title,
        authorName: row.author_name,
        authorSlug: row.author_slug,
        year: row.year,
        rating: row.rating,
        coverUrl: row.cover_url,
        hue: row.hue,
        subjects: row.subjects,
      },
      reason: row.reason,
    }));

    res.json({ recommendations });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
