/**
 * Escapes reader-supplied text for interpolation into an HTML email body.
 * Covers the five characters that can break out of either element content or a
 * double-quoted attribute value.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
