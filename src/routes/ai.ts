import { Router } from 'express';
import { authOptional } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { getSummary } from '../controllers/ai/get-summary';
import { regenerateSummary } from '../controllers/ai/regenerate-summary';
import { generateThemes } from '../controllers/ai/generate-themes';
import { generateThemesExternal } from '../controllers/ai/generate-themes-external';
import { search } from '../controllers/ai/search';

const router = Router();

/**
 * @swagger
 * /ai/summary/{bookId}:
 *   get:
 *     tags: [AI]
 *     summary: Get a book summary, preferring the stored catalog blurb over AI generation
 *     description: Returns the book's stored blurb (from Google Books or OpenLibrary) when available. Only calls Claude to generate a summary when no blurb is stored for the book.
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Book summary (catalog blurb or AI-generated)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookId: { type: integer }
 *                 summary: { type: string }
 *                 generatedAt: { type: string, format: date-time, nullable: true, description: "Null when summary is the stored catalog blurb rather than AI-generated" }
 *       404:
 *         description: Book not found
 *       503:
 *         description: AI service unavailable
 */
router.get('/summary/:bookId', getSummary);

/**
 * @swagger
 * /ai/summary/{bookId}:
 *   post:
 *     tags: [AI]
 *     summary: Regenerate an AI book summary (skips cache)
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Freshly generated summary
 *       404:
 *         description: Book not found
 *       429:
 *         description: Rate limited (5/min)
 *       503:
 *         description: AI service unavailable
 */
router.post('/summary/:bookId', rateLimiter(60_000, 5), regenerateSummary);

/**
 * @swagger
 * /ai/themes/external:
 *   post:
 *     tags: [AI]
 *     summary: Generate genres and themes for a book not yet in the catalog
 *     description: For external search results (Google Books/OpenLibrary) with no bookId. Always calls Claude fresh; nothing is cached or persisted since there is no catalog row to attach it to. Must be registered before /ai/themes/{bookId} so the literal "external" segment is not swallowed by the bookId param.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, authorName]
 *             properties:
 *               title: { type: string }
 *               authorName: { type: string }
 *     responses:
 *       200:
 *         description: Genres and themes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 genres: { type: array, items: { type: string } }
 *                 themes: { type: array, items: { type: string } }
 *       400:
 *         description: Missing title or authorName
 *       429:
 *         description: Rate limited (10/min)
 *       503:
 *         description: AI service unavailable
 */
router.post('/themes/external', rateLimiter(60_000, 10), generateThemesExternal);

/**
 * @swagger
 * /ai/themes/{bookId}:
 *   post:
 *     tags: [AI]
 *     summary: Generate or return cached genres and themes for a book
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Genres and themes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 genres: { type: array, items: { type: string } }
 *                 themes: { type: array, items: { type: string } }
 *       404:
 *         description: Book not found
 *       429:
 *         description: Rate limited (10/min)
 *       503:
 *         description: AI service unavailable
 */
router.post('/themes/:bookId', rateLimiter(60_000, 10), generateThemes);

/**
 * @swagger
 * /ai/search:
 *   post:
 *     tags: [AI]
 *     summary: Search via Google Books with library matching
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string }
 *               inLibraryOnly: { type: boolean, default: false }
 *               limit: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Search results with library flags
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 books:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       googleBooksId: { type: string }
 *                       title: { type: string }
 *                       authors: { type: array, items: { type: string } }
 *                       year: { type: integer, nullable: true }
 *                       publisher: { type: string }
 *                       pages: { type: integer }
 *                       rating: { type: number }
 *                       coverUrl: { type: string }
 *                       isbn13: { type: string, nullable: true }
 *                       language: { type: string }
 *                       blurb: { type: string }
 *                       inLibrary: { type: boolean }
 *                       libraryStatus: { type: string, nullable: true }
 *                 query: { type: string }
 *       400:
 *         description: Missing query
 *       429:
 *         description: Rate limited (10/min)
 */
router.post('/search', rateLimiter(60_000, 10), authOptional, search);

export default router;
