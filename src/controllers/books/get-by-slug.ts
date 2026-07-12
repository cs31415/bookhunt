import { Request, Response } from 'express';
import { resolveBookBySlug, getLibraryEntry } from '../../models/books/get-by-slug';

/**
 * @swagger
 * /books/{slug}:
 *   get:
 *     tags: [Books]
 *     summary: Get a book by slug, falling back to a live (non-persisted) lookup for not-yet-cataloged books
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: URL-safe book identifier
 *       - in: query
 *         name: a
 *         required: false
 *         schema: { type: string }
 *         description: >
 *           Author slug hint. Only used when slug doesn't match an existing catalog book - triggers
 *           a live provider search (no catalog write) instead of a 404. The response's book.cataloged
 *           is false in that case.
 *     responses:
 *       200:
 *         description: Book with optional library status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 book: { type: object }
 *                 inLibrary: { type: boolean }
 *                 libraryEntry: { type: object }
 *       404:
 *         description: Book not found, and no author hint (or the live search also found nothing)
 */
export async function getBySlug(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;
    const authorSlug = typeof req.query.a === 'string' ? req.query.a : undefined;

    const book = await resolveBookBySlug(slug, authorSlug);

    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    let inLibrary = false;
    let libraryEntry: Record<string, unknown> | undefined;

    if (req.user && book.cataloged) {
      const entry = await getLibraryEntry(req.user.id, book.id);
      if (entry) {
        inLibrary = true;
        libraryEntry = entry;
      }
    }

    res.json({
      book,
      inLibrary,
      ...(inLibrary && { libraryEntry }),
    });
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
