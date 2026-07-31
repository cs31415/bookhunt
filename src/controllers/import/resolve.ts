import { Request, Response } from 'express';
import { resolveImportRows } from '../../models/import/resolve-rows';
import type { ImportRowHint } from '../../models/import/resolve-rows';

/** Rows per request. Each fans out to up to two provider calls, so this bounds the work. */
export const MAX_IMPORT_ROWS = 40;

/**
 * @swagger
 * /import/resolve:
 *   post:
 *     tags: [Import]
 *     summary: Resolve CSV rows to ranked candidate books
 *     description: |
 *       Takes `{ rows: [{ title, author?, publisher? }, …] }` (1–40) and returns one entry per row,
 *       **index-aligned with the request**, each carrying a `candidates` list ranked best-first.
 *
 *       Candidates are deliberately not collapsed to a single answer. A row such as
 *       `{ title: "Hong Kong", publisher: "Frommer's" }` with no author matches dozens of
 *       identically-titled editions, so the caller picks rather than the server guessing.
 *
 *       An `isbn` identifies one edition outright: when supplied it is queried directly and
 *       short-circuits the fuzzy search, sparing both the extra provider calls and Open
 *       Library's throttle. Otherwise ranking weighs title overlap first, with author and
 *       publisher as tie-breakers. A field absent on either side never counts against a
 *       candidate — Google Books frequently omits publisher from search results even for the
 *       correct book.
 *
 *       `matchedBookId` is set when the row already exists in the local catalog.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rows]
 *             properties:
 *               rows:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 40
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title: { type: string }
 *                     author: { type: string, nullable: true }
 *                     publisher: { type: string, nullable: true }
 *                     isbn: { type: string, nullable: true, description: "ISBN-10 or -13, punctuation ignored. When present it is matched exactly and outranks every other signal." }
 *     responses:
 *       200:
 *         description: One entry per requested row, in the same order
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rows:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title: { type: string }
 *                       author: { type: string, nullable: true }
 *                       publisher: { type: string, nullable: true }
 *                       isbn: { type: string, nullable: true, description: "Normalised form of the supplied ISBN, or null if absent/unparseable" }
 *                       matchedBookId: { type: integer }
 *                       candidates:
 *                         type: array
 *                         description: Ranked best-first, at most 5
 *                         items: { type: object }
 *       400:
 *         description: rows missing, empty, exceeding 40 items, or an entry without a title
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Rate limited (20/min)
 */
export async function resolve(req: Request, res: Response) {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows must be a non-empty array' });
      return;
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      res.status(400).json({ error: `rows must contain at most ${MAX_IMPORT_ROWS} items` });
      return;
    }
    if (!rows.every((row) => typeof row?.title === 'string' && row.title.trim().length > 0)) {
      res.status(400).json({ error: 'each row must have a non-empty title' });
      return;
    }

    const text = (value: unknown): string | null =>
      typeof value === 'string' && value.trim() ? value.trim() : null;

    const hints: ImportRowHint[] = rows.map((row: ImportRowHint) => ({
      title: row.title.trim(),
      author: text(row.author),
      publisher: text(row.publisher),
      isbn: text(row.isbn),
    }));

    res.json({ rows: await resolveImportRows(hints, req.user!.id) });
  } catch (error) {
    console.error('Error resolving import rows:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
