// Our configured vision models support JPEG/PNG/GIF/WebP at up to 10 MB per
// image; we allow the still formats we can verify by magic bytes. HEIC must
// be converted client-side.
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function isAllowedImageType(contentType: string): contentType is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType);
}
