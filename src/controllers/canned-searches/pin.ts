import { Request, Response } from 'express';
import { pinSearch } from '../../models/canned-searches/pin-search';
import { unpinSearch } from '../../models/canned-searches/unpin-search';
import { PinLimitReachedError, UnknownCannedSearchError } from '../../models/canned-searches/pin-errors';

// Takes unknown because Express types a route param as string | string[].
function parseId(raw: unknown): number | null {
  if (typeof raw !== 'string') return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * @swagger
 * /canned-searches/{id}/pin:
 *   post:
 *     tags: [Canned searches]
 *     summary: Pin a canned search to the top of the reader's pills
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: The pinned search. Pinning twice is a no-op and still succeeds.
 *       401:
 *         description: Authentication required
 *       404:
 *         description: No active canned search with that id
 *       409:
 *         description: The reader is already at the pin limit
 */
export async function pin(req: Request, res: Response) {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid canned search id' });
    return;
  }

  try {
    const search = await pinSearch(req.user!.id, id);
    res.json(search);
  } catch (error) {
    if (error instanceof UnknownCannedSearchError) {
      res.status(404).json({ error: 'Canned search not found' });
      return;
    }
    if (error instanceof PinLimitReachedError) {
      res.status(409).json({ error: error.message, limit: error.limit });
      return;
    }
    console.error('Error pinning canned search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /canned-searches/{id}/pin:
 *   delete:
 *     tags: [Canned searches]
 *     summary: Unpin a canned search
 *     description: Idempotent -- unpinning something that is not pinned succeeds.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: Unpinned
 *       401:
 *         description: Authentication required
 */
export async function unpin(req: Request, res: Response) {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: 'Invalid canned search id' });
    return;
  }

  try {
    await unpinSearch(req.user!.id, id);
    res.status(204).send();
  } catch (error) {
    console.error('Error unpinning canned search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
