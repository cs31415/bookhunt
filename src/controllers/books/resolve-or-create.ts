import { Request, Response } from 'express';
import { resolveOrCreateBook } from '../../models/books/resolve-or-create';

/**
 * @swagger
 * /books:
 *   post:
 *     tags: [Books]
 *     summary: Get-or-create a catalog book from an external search result, without adding it to the caller's library
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, authorName]
 *             properties:
 *               googleBooksId: { type: string, nullable: true, description: "Required if openLibraryId is not provided" }
 *               openLibraryId: { type: string, nullable: true, description: "Required if googleBooksId is not provided" }
 *               title: { type: string }
 *               authorName: { type: string }
 *               year: { type: integer }
 *               publisher: { type: string }
 *               pages: { type: integer }
 *               rating: { type: number }
 *               subjects: { type: array, items: { type: string } }
 *               blurb: { type: string }
 *               coverUrl: { type: string }
 *               isbn13: { type: string }
 *               language: { type: string }
 *     responses:
 *       200:
 *         description: The catalog book (existing or newly created)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 book:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     slug: { type: string }
 *       400:
 *         description: Missing title/authorName, or neither googleBooksId nor openLibraryId
 */
export async function resolveOrCreate(req: Request, res: Response) {
  try {
    const { googleBooksId, openLibraryId, title, authorName } = req.body;
    if (!title || !authorName || (!googleBooksId && !openLibraryId)) {
      res.status(400).json({
        error: 'title, authorName, and one of googleBooksId/openLibraryId are required',
      });
      return;
    }

    const book = await resolveOrCreateBook(req.body);
    res.json({ book: { id: book.id, slug: book.slug } });
  } catch (error) {
    console.error('Error resolving/creating book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
