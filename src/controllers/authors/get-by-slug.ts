import { Request, Response } from 'express';
import { getAuthorBySlug, getAuthorWorks, resolveProviderAuthor } from '../../models/authors/get-by-slug';

/**
 * @swagger
 * /authors/{slug}:
 *   get:
 *     tags: [Authors]
 *     summary: Get an author and their full bibliography
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: URL-safe author identifier
 *     responses:
 *       200:
 *         description: Author with bibliography, each book flagged with in-library status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 author: { type: object }
 *                 books:
 *                   type: array
 *                   items: { type: object }
 *       404:
 *         description: Author not found
 */
export async function getBySlug(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;

    const author = await getAuthorBySlug(slug);

    if (author) {
      const books = await getAuthorWorks(author, req.user?.id);
      res.json({ author, books });
      return;
    }

    // Not in the catalog - fall back to resolving the author live from a
    // provider by slug (LOS-149). Still 404s when no provider knows them.
    const providerPage = await resolveProviderAuthor(slug, req.user?.id);
    if (!providerPage) {
      res.status(404).json({ error: 'Author not found' });
      return;
    }

    res.json(providerPage);
  } catch (error) {
    console.error('Error fetching author:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
