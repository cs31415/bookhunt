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
 * Images per vision call. Kept well under the per-request ceilings because
 * spine recall degrades as more photos share a single prompt, and because each
 * call's 2048-token budget has to cover every book it finds.
 */
export const IMAGES_PER_VISION_CALL = 8;

/** Vision calls in flight at once — bounded to stay clear of provider rate limits. */
export const VISION_CHUNK_CONCURRENCY = 3;

/** Catalog/provider lookups in flight at once while resolving detected books. */
export const RESOLUTION_CONCURRENCY = 8;

export function isAllowedImageType(contentType: string): contentType is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}
