import { Request, Response } from 'express';
import { exportLibrary as exportLibraryModel } from '../../models/library/export-library';

/**
 * @swagger
 * /library/export:
 *   get:
 *     tags: [Library]
 *     summary: The authenticated user's whole library as a JSON file
 *     description: >
 *       Everything a reader would want if they were leaving: every book on the
 *       shelf, hidden ones included, plus the three favourite lists the app
 *       keeps separately. Statuses are the stored words (queued, reading,
 *       finished, abandoned) rather than the labels the CSV importer shows — a
 *       machine-readable file carries the machine-readable word. Book fields are
 *       a superset of what the CSV importer reads, so an export survives a round
 *       trip through a spreadsheet.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The whole library and its favourites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exportedAt: { type: string, format: date-time }
 *                 books:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title: { type: string }
 *                       author: { type: string }
 *                       publisher: { type: string, nullable: true }
 *                       isbn: { type: string, nullable: true }
 *                       status: { type: string, enum: [queued, reading, finished, abandoned] }
 *                       format: { type: string, enum: [ebook, audiobook, physical] }
 *                 favorites:
 *                   type: object
 *                   properties:
 *                     books: { type: array, items: { type: object } }
 *                     authors: { type: array, items: { type: object } }
 *                     users: { type: array, items: { type: object } }
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Too many exports
 */
export async function exportLibrary(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    res.json(await exportLibraryModel(userId));
  } catch (error) {
    console.error('Error exporting library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
