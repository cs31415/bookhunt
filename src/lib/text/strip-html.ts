// Named HTML entities that show up in provider prose (Google Books / Open
// Library). Numeric entities are handled separately below.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
};

function fromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * Strips embedded HTML from provider-supplied prose (book descriptions, author
 * bios) so it renders as clean text. Line breaks and block-close tags become
 * spaces (so words don't run together), remaining tags are removed, common HTML
 * entities are decoded, and whitespace is collapsed. Returns null for empty or
 * null input.
 */
export function stripHtml(input: string | null | undefined): string | null {
  if (input == null) return null;

  const text = input
    // Line breaks and block boundaries -> space, so adjacent words stay separated.
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|tr|table|section|article)\s*>/gi, ' ')
    // Drop all remaining tags.
    .replace(/<[^>]*>/g, '')
    // Decode numeric entities (decimal and hex).
    .replace(/&#(\d+);/g, (_, dec) => fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => fromCodePoint(parseInt(hex, 16)))
    // Decode common named entities; leave unknown ones as-is.
    .replace(/&([a-z][a-z0-9]*);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    // Collapse all whitespace runs to single spaces.
    .replace(/\s+/g, ' ')
    .trim();

  return text || null;
}
