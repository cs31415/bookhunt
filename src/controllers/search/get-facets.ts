import { Request, Response } from 'express';
import { getSearchFacets } from '../../models/search/get-facets';

/**
 * @swagger
 * /search/facets:
 *   get:
 *     tags: [Search]
 *     summary: Distinct subject and mood values across the catalog
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     responses:
 *       200:
 *         description: Facet values for building search filter pills
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subjects: { type: array, items: { type: string } }
 *                 moods: { type: array, items: { type: string } }
 */
export async function getFacets(req: Request, res: Response) {
  try {
    const row = await getSearchFacets();
    res.json({
      subjects: row?.subjects ?? [],
      moods: row?.moods ?? [],
    });
  } catch (error) {
    console.error('Error fetching search facets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
