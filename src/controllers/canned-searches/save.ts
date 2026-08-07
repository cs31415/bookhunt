import { Request, Response } from 'express';
import { saveSearch } from '../../models/canned-searches/save-search';
import { InvalidSavedQueryError, PinLimitReachedError } from '../../models/canned-searches/pin-errors';

/**
 * @swagger
 * /canned-searches:
 *   post:
 *     tags: [Canned searches]
 *     summary: Save a search the reader typed as one of their own pills
 *     description: >
 *       Creates the search if the text is new, then pins it. Saving is always
 *       pinning: a saved search is never drawn as a suggestion, so an unpinned
 *       one would be invisible the moment it was made. Saving the same text
 *       twice is a no-op that returns the same pill.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string, example: 'novels about lighthouse keepers' }
 *     responses:
 *       201:
 *         description: The saved and pinned search
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CannedSearch' }
 *       400:
 *         description: The text is empty, too short, or too long
 *       401:
 *         description: Authentication required
 *       409:
 *         description: The reader is already at the pin limit
 */
export async function save(req: Request, res: Response) {
  const { query } = req.body ?? {};
  if (typeof query !== 'string') {
    res.status(400).json({ error: 'A query is required' });
    return;
  }

  try {
    const search = await saveSearch(req.user!.id, query);
    res.status(201).json(search);
  } catch (error) {
    if (error instanceof InvalidSavedQueryError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof PinLimitReachedError) {
      res.status(409).json({ error: error.message, limit: error.limit });
      return;
    }
    console.error('Error saving canned search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
