/**
 * Handles nobody may claim, because a public profile lives at the bare root
 * path: bookhunt.net/<handle>. Every top-level route on the frontend competes
 * with this namespace, so a reader who claimed "search" would either shadow the
 * search page or be permanently unreachable, depending on how the router ranks
 * them that week.
 *
 * This list is the source of truth. The frontend keeps its own copy for instant
 * feedback in the sign-up form, but only the check here decides.
 *
 * Adding a top-level route later means adding it here FIRST. By the time the
 * route ships, someone may already own the handle.
 */
export const RESERVED_HANDLES = new Set([
  // Routes that exist today.
  'search',
  'library',
  'login',
  'register',
  'logout',
  'verify-email',
  'forgot-password',
  'reset-password',
  'books',
  'authors',
  'settings',
  'messages',
  'favorites',
  'discover',

  // Routes we can see coming, and the ones any web app eventually wants.
  'about',
  'help',
  'terms',
  'privacy',
  'contact',
  'admin',
  'api',
  'bff',
  'static',
  'assets',
  'public',
  'me',
  'new',
  'home',
  'profile',
  'account',
  'notifications',
  'explore',
  'support',
  'bookhunt',
]);

export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(handle);
}
