import { Request, Response } from 'express';
import {
  libraryByToken,
  myShareToken,
  profileByToken,
  regenerateShareToken,
  revokeShareToken,
  libraryFacetsByToken,
} from '../../models/users/share-link';

/**
 * A shared page must not be indexed, and the token must not travel in a
 * referrer to whatever a reader clicks through to next. The token is in the
 * path, which is the readable, linkable choice; these two headers are what pay
 * for it.
 */
function unlistedHeaders(res: Response) {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Referrer-Policy', 'no-referrer');
}

/**
 * @swagger
 * /users/me/share-link:
 *   get:
 *     tags: [Users]
 *     summary: The signed-in reader's unlisted share token
 *     description: >
 *       Null when they have none, which is what "private" means once
 *       isDiscoverable is off. There is no separate unlisted flag: the token's
 *       presence is the state.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The token, or null
 *       401:
 *         description: Authentication required
 */
export async function getShareLink(req: Request, res: Response) {
  try {
    res.json({ token: await myShareToken(req.user!.id) });
  } catch (error) {
    console.error('Error reading share link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /users/me/share-link:
 *   post:
 *     tags: [Users]
 *     summary: Mint a share token, replacing any that exists
 *     description: >
 *       Creating and regenerating are the same operation. Overwriting is the
 *       only way to take back a link that has spread, and a reader asking for a
 *       link twice should not have to know which of the two they are doing. The
 *       previous link stops working immediately.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The new token
 *       401:
 *         description: Authentication required
 */
export async function createShareLink(req: Request, res: Response) {
  try {
    res.json({ token: await regenerateShareToken(req.user!.id) });
  } catch (error) {
    console.error('Error minting share link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /users/me/share-link:
 *   delete:
 *     tags: [Users]
 *     summary: Revoke the share token, returning the page to private
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revoked; token is null
 *       401:
 *         description: Authentication required
 */
export async function deleteShareLink(req: Request, res: Response) {
  try {
    res.json({ token: await revokeShareToken(req.user!.id) });
  } catch (error) {
    console.error('Error revoking share link:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /users/by-token/{token}:
 *   get:
 *     tags: [Users]
 *     summary: A profile by its unlisted share token
 *     description: >
 *       Serves the same profile as /users/{handle} without requiring
 *       isDiscoverable — that is what unlisted means. Answers 404 for an
 *       unknown token and a revoked one alike, so a guessed token cannot be
 *       told from one that has been taken back. Carries noindex.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: The profile header and its counts
 *       404:
 *         description: No such shared profile
 */
export async function getProfileByShareToken(req: Request, res: Response) {
  try {
    unlistedHeaders(res);
    const profile = await profileByToken(String(req.params.token));

    if (!profile) {
      res.status(404).json({ error: 'No such profile' });
      return;
    }

    res.json({ profile });
  } catch (error) {
    console.error('Error fetching shared profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @swagger
 * /users/by-token/{token}/library:
 *   get:
 *     tags: [Users]
 *     summary: A shared profile's shelf
 *     description: >
 *       Hidden books never appear. Unlisted means "not listed", not "everything
 *       on show", so the per-book ticks a reader has set still hold. Takes the
 *       same status, favorites, q, subject and paging parameters the public
 *       library does.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Entries with pagination
 *       404:
 *         description: No such shared profile
 */
export async function getLibraryByShareToken(req: Request, res: Response) {
  try {
    unlistedHeaders(res);
    const token = String(req.params.token);

    // Asked first, so an empty shelf and an unknown token give different
    // answers -- the same order the handle route uses.
    const profile = await profileByToken(token);
    if (!profile) {
      res.status(404).json({ error: 'No such profile' });
      return;
    }

    res.json(await libraryByToken(token, req.query));
  } catch (error) {
    console.error('Error fetching shared library:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * @openapi
 * /users/by-token/{token}/library/facets:
 *   get:
 *     summary: The filter values an unlisted shelf offers
 *     description: >
 *       The token is the whole credential, as on the shelf route itself.
 *       Computed over the whole shelf rather than a page.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Values grouped by facet
 *       404:
 *         description: No such shared profile
 */
export async function getLibraryFacetsByShareToken(req: Request, res: Response) {
  try {
    unlistedHeaders(res);
    const token = String(req.params.token);

    const profile = await profileByToken(token);
    if (!profile) {
      res.status(404).json({ error: 'No such profile' });
      return;
    }

    res.json(await libraryFacetsByToken(token));
  } catch (error) {
    console.error('Error fetching shared library facets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
