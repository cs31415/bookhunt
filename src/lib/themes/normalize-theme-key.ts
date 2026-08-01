/**
 * The identity of a theme, ignoring how it happens to be written.
 *
 * The model returns the same theme spelled several ways across books --
 * 'Socio-political evolution' and 'Sociopolitical evolution', 'The Human
 * Condition' and 'Human condition'. Stripping case, a leading article and every
 * non-alphanumeric character collapses those onto one key, which is what lets
 * foldThemes recognise a variant of a tag the catalog already uses.
 *
 * Deliberately not a stemmer: 'Cultural evolution' and 'Cultural History' are
 * different themes and must stay apart. This only merges spellings, never
 * meanings.
 */
export function normalizeThemeKey(theme: string): string {
  return theme
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}
