import { Router } from 'express';
import { authRequired } from '../middleware/auth';
import { getLibrary } from '../controllers/library/get-library';
import { addToLibrary } from '../controllers/library/add-to-library';
import { updateEntry } from '../controllers/library/update-entry';
import { removeEntry } from '../controllers/library/remove-entry';
import { addRelated } from '../controllers/library/add-related';
import { removeRelated } from '../controllers/library/remove-related';

const router = Router();

router.use(authRequired);

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
router.get('/', getLibrary);

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
 *             required: [googleBooksId, title, authorName, slug]
 *             properties:
 *               googleBooksId: { type: string }
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
router.post('/', addToLibrary);

/**
 * @swagger
 * /library/{bookId}:
 *   put:
 *     tags: [Library]
 *     summary: Update a library entry (status, rating, notes, review)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [queued, reading, finished, abandoned] }
 *               userRating: { type: integer, minimum: 1, maximum: 5 }
 *               notes: { type: string }
 *               review: { type: string }
 *     responses:
 *       200:
 *         description: Updated entry
 *       404:
 *         description: Entry not found
 */
router.put('/:bookId', updateEntry);

/**
 * @swagger
 * /library/{bookId}:
 *   delete:
 *     tags: [Library]
 *     summary: Remove a book from the library
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Removed
 *       404:
 *         description: Entry not found
 */
router.delete('/:bookId', removeEntry);

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
router.post('/:bookId/related', addRelated);

/**
 * @swagger
 * /library/{bookId}/related/{relatedBookId}:
 *   delete:
 *     tags: [Library]
 *     summary: Remove a user-curated related book
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: relatedBookId
 *         required: true
 *         schema: { type: integer }
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
router.delete('/:bookId/related/:relatedBookId', removeRelated);

export default router;
