import { Request, Response } from 'express';
import {
  favoriteAuthor,
  myFavoriteAuthors,
  publicFavoriteAuthors,
  unfavoriteAuthor,
} from '../../models/authors/favorites';

/**
 * @swagger
 * /authors/favorites:
 *   get:
 *     tags: [Authors]
 *     summary: The authors you have favourited
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Each with how many of their books you own }
 */
export async function getFavoriteAuthors(req: Request, res: Response) {
  try {
    res.json({ authors: await myFavoriteAuthors(req.user!.id) });
  } catch (error) {
    console.error('Error listing favorite authors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /users/{handle}/favorite-authors:
 *   get:
 *     tags: [Users]
 *     summary: A reader's favourite authors, as a visitor sees them
 *     description: >
 *       Public, like favourite books: an author list reads as taste rather than
 *       as a social graph. Empty for an unknown handle and for a private page
 *       alike.
 *     responses:
 *       200: { description: The list, possibly empty }
 */
export async function getPublicFavoriteAuthors(req: Request, res: Response) {
  try {
    res.json({ authors: await publicFavoriteAuthors(String(req.params.handle)) });
  } catch (error) {
    console.error('Error listing public favorite authors:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /authors/{slug}/favorite:
 *   post:
 *     tags: [Authors]
 *     summary: Favourite an author
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Favourited }
 *       404: { description: No such author }
 *   delete:
 *     tags: [Authors]
 *     summary: Remove an author from favourites
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Removed }
 *       404: { description: No such author }
 */
function handle(add: boolean) {
  return async function setFavorite(req: Request, res: Response) {
    try {
      const slug = String(req.params.slug);
      const ok = add
        ? await favoriteAuthor(req.user!.id, slug)
        : await unfavoriteAuthor(req.user!.id, slug);

      if (!ok) {
        res.status(404).json({ error: 'No such author' });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Error setting author favorite:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export const addAuthorFavorite = handle(true);
export const removeAuthorFavorite = handle(false);
