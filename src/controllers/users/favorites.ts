import { Request, Response } from 'express';
import {
  favoriteUser,
  findUsers,
  myFavorites,
  unfavoriteUser,
} from '../../models/users/favorites';

/**
 * @swagger
 * /users/search:
 *   get:
 *     tags: [Users]
 *     summary: Find readers by handle or display name
 *     description: >
 *       Only readers who have made their page public are findable. Searching
 *       would otherwise enumerate accounts that deliberately stayed private.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Up to ten matches, exact handle prefixes first
 */
export async function searchUsers(req: Request, res: Response) {
  const { q } = req.query;

  if (typeof q !== 'string' || q.trim().length === 0) {
    // An empty query is an empty answer, not an error: the search box asks on
    // every keystroke and the first one is often blank.
    res.json({ users: [] });
    return;
  }

  try {
    res.json({ users: await findUsers(q) });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /users/favorites:
 *   get:
 *     tags: [Users]
 *     summary: The readers you have favourited
 *     description: >
 *       Owner-only, with no public equivalent. Favourite books and authors are
 *       taste and are published; who a reader follows is a social graph and
 *       stays private.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Each with whether the favourite is mutual
 */
export async function getFavorites(req: Request, res: Response) {
  try {
    res.json({ users: await myFavorites(req.user!.id) });
  } catch (error) {
    console.error('Error listing favorite users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /users/{handle}/favorite:
 *   post:
 *     tags: [Users]
 *     summary: Favourite a reader
 *     description: >
 *       Idempotent. Also the permission that lets them message you: a two-way
 *       thread needs both readers to have done this.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Favourited }
 *       404: { description: No such reader, or it is you }
 *   delete:
 *     tags: [Users]
 *     summary: Un-favourite a reader, which also stops them messaging you
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Removed }
 *       404: { description: No such reader }
 */
function handle(add: boolean) {
  return async function setFavorite(req: Request, res: Response) {
    try {
      const target = String(req.params.handle);
      const ok = add
        ? await favoriteUser(req.user!.id, target)
        : await unfavoriteUser(req.user!.id, target);

      if (!ok) {
        // Unknown handle and "that is you" are one answer. The second is not a
        // failure worth its own message, and the first must not confirm which
        // handles exist.
        res.status(404).json({ error: 'No such reader' });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Error setting user favorite:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export const addFavoriteUser = handle(true);
export const removeFavoriteUser = handle(false);
