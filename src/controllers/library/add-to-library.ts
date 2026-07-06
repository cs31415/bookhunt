import { Request, Response } from 'express';
import { addToLibrary as addToLibraryModel } from '../../models/library/add-to-library';

/**
 * @swagger
 * /library:
 *   post:
 *     tags: [Library]
 *     summary: Add a book to the library (upserts from Google Books data)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, authorName, slug]
 *             properties:
 *               googleBooksId: { type: string, nullable: true, description: "Required if openLibraryId is not provided" }
 *               openLibraryId: { type: string, nullable: true, description: "OpenLibrary edition ID; required if googleBooksId is not provided" }
 *               source: { type: string, enum: [google_books, open_library] }
 *               slug: { type: string }
 *               title: { type: string }
 *               authorName: { type: string }
 *               status: { type: string, enum: [queued, reading, finished, abandoned] }
 *               year: { type: integer }
 *               publisher: { type: string }
 *               pages: { type: integer }
 *               rating: { type: number }
 *               subjects: { type: array, items: { type: string } }
 *               blurb: { type: string }
 *               coverUrl: { type: string }
 *               isbn13: { type: string }
 *               language: { type: string }
 *               hue: { type: string }
 *     responses:
 *       200:
 *         description: Library entry created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entry: { type: object }
 */
export async function addToLibrary(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const entry = await addToLibraryModel(userId, req.body);
    res.json({ entry });
  } catch (error) {
    console.error('Error adding to library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
