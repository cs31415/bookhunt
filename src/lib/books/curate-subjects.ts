import { CATALOGUING_PREFIXES, GENERIC_SUBJECTS, NON_ENGLISH_SUBJECTS } from './subject-stopwords';

/**
 * Turns a provider's subject list into categories a reader would recognise.
 *
 * Open Library returns everything any cataloguer ever attached to any edition
 * of a book -- Sapiens arrives with 53 entries, of which fewer than half name
 * a subject. The rest are Dewey numbers, Library of Congress call numbers,
 * BISAC codes, New York Times list tags, and the same few ideas repeated in
 * six languages. Google Books is tidier but sends BISAC paths.
 *
 * Applied where subjects enter, so books.subjects holds the curated list and
 * search facets and library filters get the benefit too, not just the book
 * page. Pure and order-preserving: a provider puts its best guess first.
 */
export function curateSubjects(raw: string[]): string[] {
  const curated: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw ?? []) {
    if (typeof entry !== 'string') continue;
    if (isMachineTag(entry)) continue;

    const subject = normalize(entry);
    if (!subject || isJunk(subject)) continue;

    const key = dedupeKey(subject);
    if (seen.has(key)) continue;
    seen.add(key);
    curated.push(subject);
  }

  return curated;
}

/**
 * Namespaced or key=value strings: `nyt:paperback-nonfiction=2018-06-03`.
 * Checked before normalising, which would otherwise cut them into something
 * that reads like a subject.
 */
function isMachineTag(entry: string): boolean {
  return entry.includes('=') || /^[a-z][a-z_-]*:/i.test(entry);
}

/**
 * Reduces the shapes cataloguers use for hierarchy down to the term itself,
 * which in every one of them is the first level.
 *
 * A BISAC path narrows as it goes, and its leaf is usually a modifier that
 * cannot stand alone: `History / World`, `Fiction / Historical`,
 * `History / Modern / 18th Century`. Worse, reading from the right mislabels
 * the book outright -- `Art / History / General` is an art book, not a history
 * one. The top level is always a category a reader would recognise, so that is
 * what we keep, and the specific term usually arrives separately anyway.
 *
 * An LCSH facet already names its subject first (`Civilization--history`), in
 * either of the two dashes catalogues write it with.
 *
 * Google Books writes a path with either separator.
 */
function normalize(entry: string): string {
  const trimmed = entry.replace(/\s+/g, ' ').trim();
  const isPath = /[/>]/.test(trimmed);
  const subject = trimmed.split(/[/>]/)[0].split(/--| - /)[0].split(',')[0].trim();

  // Providers shout the top level of a BISAC path, and left alone "SCIENCE"
  // and "Science" would survive deduping as two pills saying the same word.
  // An acronym is spared: it is short, and "DNA" must not become "Dna". A
  // path is de-shouted whatever its length, since BISAC has ART and LAW.
  if (subject && subject === subject.toUpperCase() && (isPath || hasLongWord(subject))) {
    return subject.charAt(0) + subject.slice(1).toLowerCase();
  }

  return subject;
}

/** Four letters is the longest acronym worth sparing: LGBT, ADHD, NASA. */
function hasLongWord(subject: string): boolean {
  return subject.split(/[^A-Za-z]+/).some((word) => word.length > 4);
}

function isJunk(subject: string): boolean {
  // Trailing full stops are a cataloguing habit, not part of the term, and
  // would otherwise let "Obras populares." past a list holding the same words.
  const lower = subject.toLowerCase().replace(/\.+$/, '');

  // Dewey: 599.9
  if (/^\d[\d.\s]*$/.test(subject)) return true;
  // LC call numbers and BISAC codes: Cb113.h4 h3713 2015, Sci027000 sci086000
  if (/^[a-z]{1,3}\d{2,}/i.test(subject)) return true;
  // A badge the book wears, not a subject it is about.
  if (/bestseller/i.test(lower)) return true;
  // Anything this long is a cataloguer's sentence, not a category, and would
  // not fit the pill row anyway: "Long Now Manual for Civilization".
  if (subject.split(' ').length > 4) return true;
  // Stands in for a language check we cannot make: an accent means the term
  // was catalogued in a language the site does not read in.
  if (/[^\x00-\x7F]/.test(subject)) return true;
  if (CATALOGUING_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;

  return GENERIC_SUBJECTS.has(lower) || NON_ENGLISH_SUBJECTS.has(lower);
}

/**
 * Collapses a plural onto its singular -- `Human` and `Humans` are one pill,
 * whichever the provider listed first. Deliberately crude: the key is never
 * shown, and a term that differs by more than an `s` (`Human beings`) is left
 * alone rather than guessed at.
 */
function dedupeKey(subject: string): string {
  return subject.toLowerCase().replace(/s\b/g, '');
}
