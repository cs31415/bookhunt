// Our configured vision models support JPEG/PNG/GIF/WebP at up to 10 MB per
// image; we allow the still formats we can verify by magic bytes. HEIC must
// be converted client-side.
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Photos accepted in one scan. The scan is split across several vision calls,
 * so this ceiling is about total work per request rather than what one model
 * call can hold.
 */
export const MAX_IMAGES_PER_SCAN = 40;

/**
 * Images per vision call. Deliberately small: spine recall degrades as more
 * photos share one prompt, and every book found in a call has to fit inside
 * that call's output-token budget (VISION_MAX_TOKENS).
 *
 * Was 8, which paired with a 2048-token budget capped a call at ~60-80 books —
 * less than a single dense shelf, so large scans truncated and silently lost
 * most of their results (LOS-167).
 */
export const IMAGES_PER_VISION_CALL = 2;

/**
 * Output-token budget per vision call. A {"title":…,"author":…} entry runs
 * roughly 25-35 tokens, so this holds ~250 books per call — far more headroom
 * than IMAGES_PER_VISION_CALL photos can plausibly contain.
 */
export const VISION_MAX_TOKENS = 8192;

/**
 * Vision calls in flight at once — bounded to stay clear of provider rate limits.
 * Raised alongside the drop in IMAGES_PER_VISION_CALL, which quadrupled the
 * number of calls a full scan makes: at 40 photos that is now 20 calls, and a
 * concurrency of 3 would have stretched them across ~7 sequential waves.
 */
export const VISION_CHUNK_CONCURRENCY = 4;

/** Catalog/provider lookups in flight at once while resolving detected books. */
export const RESOLUTION_CONCURRENCY = 8;

export function isAllowedImageType(contentType: string): contentType is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}
