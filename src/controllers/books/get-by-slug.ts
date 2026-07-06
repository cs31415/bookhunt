import { Request, Response } from 'express';
import { getBookBySlug, getLibraryEntry } from '../../models/books/get-by-slug';

/**
 * @swagger
 * /books/{slug}:
 *   get:
 *     tags: [Books]
 *     summary: Get a book by slug
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         description: URL-safe book identifier
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
 *         description: Book not found
 */
export async function getBySlug(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;

    const book = await getBookBySlug(slug);

    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    let inLibrary = false;
    let libraryEntry: Record<string, unknown> | undefined;

    if (req.user) {
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
