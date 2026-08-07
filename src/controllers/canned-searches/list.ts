import { Request, Response } from 'express';
import { getPillRow } from '../../models/canned-searches/get-pill-row';
import { DEFAULT_ROW_SIZE, MAX_GUEST_PINNED_IDS, MAX_ROW_SIZE } from '../../models/canned-searches/pill-row';

/** "12,88" -> [12, 88]. Anything that is not a positive integer is dropped. */
function parseIds(raw: unknown, max: number): number[] {
  if (typeof raw !== 'string' || raw === '') return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, max);
}

function parseRowSize(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_ROW_SIZE;
  return Math.min(parsed, MAX_ROW_SIZE);
}

/**
 * @swagger
 * /canned-searches:
 *   get:
 *     tags: [Canned searches]
 *     summary: The row of example searches for the Discover pills
 *     description: >
 *       Returns pinned searches and a row of suggestions, with the pinned ones
 *       excluded so nothing appears twice. The suggestions persist: this
 *       restores the row the reader was last shown, and only `refresh=true`
 *       draws a new one. Authentication is optional: a signed-in reader's pins
 *       and current row come from the database, while a guest sends both from
 *       their browser via `pinnedIds` and `drawIds`.
 *     parameters:
 *       - in: query
 *         name: limit
 *         description: Total pills wanted, pinned included.
 *         schema: { type: integer, default: 6, maximum: 12 }
 *       - in: query
 *         name: pinnedIds
 *         description: Comma-separated ids, for guests only. Ignored when signed in.
 *         schema: { type: string, example: "12,88" }
 *       - in: query
 *         name: drawIds
 *         description: >
 *           The row a guest is currently looking at, so it survives a reload.
 *           Ignored when signed in, where the row is restored from the database.
 *         schema: { type: string, example: "12,88" }
 *       - in: query
 *         name: refresh
 *         description: Draw a new row instead of restoring the current one.
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: history
 *         description: >
 *           Set to `true` on the first load of the page to get the reader's
 *           earlier draws for the back and forward arrows. Omit it on a refresh,
 *           which only needs the new row. Always empty for a guest.
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: The pill row
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pinned:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/CannedSearch' }
 *                 suggested:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/CannedSearch' }
 *                 history:
 *                   type: array
 *                   description: Earlier rows of suggestions, newest first.
 *                   items:
 *                     type: array
 *                     items: { $ref: '#/components/schemas/CannedSearch' }
 */
export async function list(req: Request, res: Response) {
  try {
    const rowSize = parseRowSize(req.query.limit);
    const row = await getPillRow({
      userId: req.user?.id ?? null,
      pinnedIds: parseIds(req.query.pinnedIds, MAX_GUEST_PINNED_IDS),
      drawIds: parseIds(req.query.drawIds, rowSize),
      rowSize,
      includeHistory: req.query.history === 'true',
      refresh: req.query.refresh === 'true',
    });
    res.json(row);
  } catch (error) {
    console.error('Error fetching canned searches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
