import { Request, Response } from 'express';
import {
  favoriteAuthor,
  myFavoriteAuthors,
  publicFavoriteAuthors,
  setAuthorVisibility,
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

/**
 * @swagger
 * /authors/{slug}/favorite/hidden:
 *   put:
 *     tags: [Authors]
 *     summary: Keep a favourite author off your public page
 *     description: >
 *       The author stays favourited and stays on your own list; only the public
 *       page at bookhunt.net/{handle} stops showing them. The counterpart to
 *       PUT /library/{bookId}/hidden, and shaped the same way.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Hidden }
 *       404: { description: Not one of your favourite authors }
 *   delete:
 *     tags: [Authors]
 *     summary: Show a hidden favourite author on your public page again
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Shown }
 *       404: { description: Not one of your favourite authors }
 */
function handleVisibility(isHidden: boolean) {
  return async function setHidden(req: Request, res: Response) {
    try {
      const ok = await setAuthorVisibility(req.user!.id, String(req.params.slug), isHidden);

      if (!ok) {
        // Covers an unknown slug and an author this reader never favourited
        // alike: in both cases there is no row to hide.
        res.status(404).json({ error: 'No such favourite author' });
        return;
      }

      res.json({ author: { slug: String(req.params.slug), isHidden } });
    } catch (error) {
      console.error('Error setting favorite author visibility:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// PUT hides, DELETE reveals -- the verb carries the state, exactly as it does
// for a book, so neither route needs a body.
export const hideAuthorFavorite = handleVisibility(true);
export const showAuthorFavorite = handleVisibility(false);
