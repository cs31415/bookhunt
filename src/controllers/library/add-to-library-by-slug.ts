import { Request, Response } from 'express';
import { getBookBySlug } from '../../data/books-data';
import { addExistingToLibrary as addExistingToLibraryModel } from '../../models/library/add-existing-to-library';
import { addToLibrary as upsertAndAddModel } from '../../models/library/add-to-library';

const VALID_STATUSES = new Set(['queued', 'reading', 'finished', 'abandoned']);

/**
 * @swagger
 * /library/{slug}:
 *   post:
 *     tags: [Library]
 *     summary: Add a book to the library by slug - an existing catalog book, or a not-yet-cataloged one
 *     description: >
 *       If slug matches an existing catalog book, adds it directly (idempotent, no upsert - same as
 *       the old POST /library/:bookId). Otherwise, upserts a new catalog row from the title/authorName/
 *       googleBooksId (or openLibraryId) and other fields in the request body, then adds it - this is
 *       the only place a not-yet-cataloged book's catalog row gets created (see LOS-127). Replaces the
 *       old standalone upsert-based POST /library.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [queued, reading, finished, abandoned], default: queued }
 *               title: { type: string, description: "Required if slug doesn't match an existing catalog book" }
 *               authorName: { type: string, description: "Required if slug doesn't match an existing catalog book" }
 *               googleBooksId: { type: string, nullable: true }
 *               openLibraryId: { type: string, nullable: true }
 *               source: { type: string, enum: [google_books, open_library] }
 *               year: { type: integer }
 *               publisher: { type: string }
 *               pages: { type: integer }
 *               rating: { type: number }
 *               subjects: { type: array, items: { type: string } }
 *               blurb: { type: string }
 *               coverUrl: { type: string }
 *               isbn13: { type: string }
 *               language: { type: string }
 *               isEbook: { type: boolean, default: false, description: "The copy the reader owns is an ebook" }
 *               isAudiobook: { type: boolean, default: false, description: "Independent of isEbook; neither means physical" }
 *     responses:
 *       200:
 *         description: Library entry (existing or newly created), plus the catalog book's real id/slug
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entry: { type: object }
 *                 book:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     slug: { type: string }
 *       400:
 *         description: Invalid status, or slug not found and insufficient fields to create it
 */
export async function addToLibraryBySlug(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const slug = req.params.slug as string;

    const status = req.body?.status ?? 'queued';
    if (!VALID_STATUSES.has(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    // `=== true` rather than a truthy read: these arrive from a request body,
    // and a malformed one must not be able to set a flag by accident.
    const format = {
      isEbook: req.body?.isEbook === true,
      isAudiobook: req.body?.isAudiobook === true,
    };

    const existing = await getBookBySlug(slug);
    if (existing) {
      const entry = await addExistingToLibraryModel(userId, existing.id, status, format);
      res.json({ entry, book: { id: existing.id, slug: existing.slug } });
      return;
    }

    // Title and author are enough. A provider id used to be required too, which
    // made an import row that matched nothing impossible to add -- the CSV
    // client offers exactly that thin shape, so every such row 400'd and was
    // reported to the reader as an error (LOS-196). A book you own that no
    // provider lists is a real book; it gets a thin catalog row, and
    // resolveBookBySlug fills in the rest when its page is opened.
    const { title, authorName } = req.body ?? {};
    if (!title || !authorName) {
      res.status(400).json({
        error: 'No catalog book matches this slug, and title and authorName are required to create it',
      });
      return;
    }

    // `enrich: false` from an import, which has already been told everything the
    // provider's search response knew and does not want a lookup per row.
    const { entry, book } = await upsertAndAddModel(userId, {
      ...req.body,
      ...format,
      slug,
      enrich: req.body?.enrich !== false,
    });
    res.json({ entry, book: { id: book.id, slug: book.slug } });
  } catch (error) {
    console.error('Error adding to library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
