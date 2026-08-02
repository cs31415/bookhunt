import { Request, Response } from 'express';
import { resolveImportRows } from '../../models/import/resolve-rows';
import type { ImportRowHint } from '../../models/import/resolve-rows';
import { runWithCallStats } from '../../lib/stats/run-with-call-stats';
import { formatCallStats } from '../../lib/stats/format-call-stats';

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
 *       A row whose candidates none of them answer its title comes back marked `tentative`.
 *       These are rows nothing was catalogued under the title given, where the provider
 *       offered a book by the same author instead: sometimes a retitled edition ("Half Lion"
 *       is shelved as "The Man Who Remade India"), sometimes an unrelated book by that author.
 *       Nothing in the response separates the two, so a tentative row must be shown as a
 *       suggestion and left unselected until the reader confirms it.
 *
 *       `matchedBookId` is set when the row already exists in the local catalog, with `matchedBook`
 *       carrying that book ready to render — the catalog search already returned its cover, slug and
 *       author, so no follow-up `GET /books` is needed. When the book is also already in the caller's
 *       library the row comes back with no candidates at all: it is not addable, so no provider
 *       lookup is spent on alternatives nobody can choose.
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
 *                       matchedBook:
 *                         type: object
 *                         description: The matched catalog book, in the shape GET /books returns
 *                         properties:
 *                           id: { type: integer }
 *                           slug: { type: string }
 *                           title: { type: string }
 *                           authorName: { type: string }
 *                           authorSlug: { type: string }
 *                           year: { type: integer, nullable: true }
 *                           rating: { type: number, nullable: true }
 *                           coverUrl: { type: string, nullable: true }
 *                           hue: { type: string }
 *                       candidates:
 *                         type: array
 *                         description: Ranked best-first, at most 5
 *                         items: { type: object }
 *                       tentative:
 *                         type: boolean
 *                         description: |
 *                           Present and true when no candidate answers the row's title. Such a
 *                           list is a suggestion, not an identification, and must not be
 *                           preselected.
 *                         example: true
 *       400:
 *         description: rows missing, empty, exceeding 40 items, or an entry without a title
 *       401:
 *         description: Authentication required
 *       429:
 *         description: Rate limited (150/min)
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

    // How much a batch costs externally depends on how many rows the caller
    // already owns, carry an ISBN, or need the fallback provider — none of which
    // is visible from the request or the response. The summary is logged in a
    // finally so a batch that fails halfway still reports what it spent.
    const { stats, result } = runWithCallStats(() => resolveImportRows(hints, req.user!.id));
    try {
      res.json({ rows: await result });
    } finally {
      console.log(formatCallStats('import', stats, hints.length));
    }
  } catch (error) {
    console.error('Error resolving import rows:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
