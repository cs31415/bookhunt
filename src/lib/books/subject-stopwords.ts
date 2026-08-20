/**
 * Words that disqualify a subject, kept apart from the rules that use them
 * because this is data: it grows every time an import surfaces a new term,
 * while curate-subjects.ts should not have to change again.
 *
 * Matching is on the whole normalised subject, lowercased -- never on a single
 * word inside a longer phrase. "History" must survive while "Histoire" does
 * not, and a substring test would take "Historia" out of "Historical".
 */

/**
 * True of any subject, in any language: a shelf label rather than a subject.
 */
export const GENERIC_SUBJECTS = new Set([
  'general',
  'miscellanea',
  'miscellaneous',
  'other',
  'unclassified',
  'general works',
  'collections',
  'readers',
]);

/**
 * Cataloguing apparatus: true of the copy on a shelf, not of the book.
 *
 * Matched as prefixes because they come with a value attached --
 * "Reading Level-Grade 11", "Accelerated Reader AR", "Open Library Staff Picks".
 */
export const CATALOGUING_PREFIXES = [
  'reading level',
  'accelerated reader',
  'open library',
  'large type',
  'lexile',
];

/**
 * Open Library returns a book's subjects in every language its editions were
 * catalogued in, so a popular title arrives with the same handful of ideas
 * repeated six ways. English is what the site reads in, and the duplicates
 * crowd out real subjects.
 *
 * Diacritics are already handled -- curate-subjects rejects any non-ASCII
 * letter, which covers Humanité, Människan and Cronología histórica. What is
 * left is the ASCII tail below.
 *
 * A word that reads the same in English stays out of this list, however
 * foreign its origin here -- "Science" is French and English both, and losing
 * the English one costs more than keeping the French.
 *
 * To extend: add the exact phrase, lowercased, under its language, and add a
 * case to the Sapiens fixture in the test if an import turned it up.
 */
export const NON_ENGLISH_SUBJECTS = new Set([
  // German
  'weltgeschichte',
  'zivilisation',
  'menschheit',
  'geschichte',
  'kultur',
  'wissenschaft',
  'gesellschaft',
  'philosophie',
  'belletristische darstellung',
  'naturwissenschaften',
  'allgemeinwissen',
  'einfuhrung',
  // Open Library sometimes drops a combining accent and leaves the space it
  // sat on, so the same word arrives broken. Both spellings, one term.
  'einfu hrung',
  // French
  'histoire',
  'histoire universelle',
  'civilisation',
  'homme',
  'societe',
  'chronologie historique',
  'ouvrages de vulgarisation',
  'technologie et civilisation',
  // Spanish
  'historia',
  'historia universal',
  'hombre',
  'ciencia',
  'sociedad',
  'novela',
  'civilizacion',
  'filosofia',
  'obras populares',
  'obras de divulgacion',
  'obras de divulgacio n',
  // Swedish, Norwegian, Danish
  'fysisk antropologi',
  'manniskan',
  'historia och geografi',
  'samhalle',
  'skonlitteratur',
  // Dutch
  'natuurwetenschappen',
  'wetenschapsbeoefening',
  'wetenschapsfilosofie',
  'natuurlijke historie',
  // Italian
  'storia',
  'storia universale',
  'civilta',
  'scienza',
  'societa',
  'romanzo',
  // Portuguese
  'historia geral',
  'ficcao',
  'sociedade',
]);
