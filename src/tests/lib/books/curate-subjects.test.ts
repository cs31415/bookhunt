import { curateSubjects } from '../../../lib/books/curate-subjects';

/**
 * What Open Library actually returned for Sapiens: 53 entries, every noise
 * class in one place. Kept verbatim so a rule change has to answer to real
 * data, and so a newly-seen term has an obvious home.
 */
const SAPIENS_SUBJECTS = [
  'Technology and civilization',
  'Human beings',
  'Historical Chronology',
  'Historia universal',
  'Historia',
  'Civilization',
  'Hombre',
  'World history',
  'History',
  'Non-Fiction',
  'Science',
  'SCIENCE / Life Sciences / General',
  'SCIENCE / General',
  'SCIENCE / Life Sciences / Evolution',
  'Weltgeschichte',
  'Civilization, history',
  'Chronology, historical',
  'Chronologie historique',
  'Technologie et civilisation',
  'Histoire universelle',
  'Histoire',
  'Humans',
  'Civilisation',
  'Homme',
  'nyt:combined-print-and-e-book-nonfiction=2015-03-01',
  'New York Times bestseller',
  'Life Sciences',
  'Evolution',
  'General',
  'Menschheit',
  'Humanité',
  'Människan',
  'Fysisk antropologi',
  'Human',
  'Sapiens',
  'nyt:paperback-nonfiction=2018-06-03',
  'Comics & graphic novels, adaptations',
  'Zivilisation',
  'Society',
  'Psychology',
  'Economic history',
  'Cognition and culture',
  'Civilization--history',
  'Human beings--history',
  'Technology and civilization--history',
  'Cb113.h4 h3713 2015',
  '599.9',
  'Sci027000 sci086000 sci000000',
  'Cronología histórica',
  'Tecnología y civilización',
  'Anthropology',
  'Long Now Manual for Civilization',
  'Comic books, strips',
];

describe('curateSubjects', () => {
  it('keeps only the subjects a reader would recognise', () => {
    expect(curateSubjects(SAPIENS_SUBJECTS)).toEqual([
      'Technology and civilization',
      'Human beings',
      'Historical Chronology',
      'Civilization',
      'World history',
      'History',
      'Non-Fiction',
      'Science',
      'Chronology',
      'Humans',
      'Life Sciences',
      'Evolution',
      'Sapiens',
      'Comics & graphic novels',
      'Society',
      'Psychology',
      'Economic history',
      'Cognition and culture',
      'Anthropology',
      'Comic books',
    ]);
  });

  it.each([
    ['nyt:paperback-nonfiction=2018-06-03', 'a list tag'],
    ['599.9', 'a Dewey number'],
    ['Cb113.h4 h3713 2015', 'a call number'],
    ['Sci027000 sci086000 sci000000', 'BISAC codes'],
    ['New York Times bestseller', 'a badge'],
    ['General', 'a filing convention'],
    ['Long Now Manual for Civilization', 'a cataloguer’s sentence'],
    ['Humanité', 'an accented term'],
    ['Weltgeschichte', 'a term in another language'],
    ['Obras populares.', 'the same with a cataloguer’s full stop'],
    ['Reading Level-Grade 11', 'a reading level'],
    ['Open Library Staff Picks', 'a list the book appears on'],
    ['Large type books', 'a property of the copy, not the book'],
  ])('drops %s (%s)', (subject) => {
    expect(curateSubjects([subject])).toEqual([]);
  });

  it.each([
    ['SCIENCE / Life Sciences / Evolution', 'Science'],
    ['SCIENCE / General', 'Science'],
    ['Science > Life Sciences > Zoology', 'Science'],
    ['Civilization--history', 'Civilization'],
    ['Civilization - history', 'Civilization'],
    ['Comic books, strips', 'Comic books'],
    ['  World   history  ', 'World history'],
  ])('reads %s as %s', (input, expected) => {
    expect(curateSubjects([input])).toEqual([expected]);
  });

  /**
   * The leaf of a BISAC path cannot stand alone, and reading from the right
   * mislabels the book: an art history book is about art.
   */
  it.each([
    ['History / World', 'History'],
    ['History / Modern / 18th Century', 'History'],
    ['Fiction / Historical', 'Fiction'],
    ['Art / History / General', 'Art'],
  ])('takes the top level of %s, not its leaf', (input, expected) => {
    expect(curateSubjects([input])).toEqual([expected]);
  });

  it.each([
    ['DNA', 'DNA'],
    ['LGBT', 'LGBT'],
    ['PSYCHOLOGY', 'Psychology'],
    ['ART / History', 'Art'],
  ])('spares the acronym in %s', (input, expected) => {
    expect(curateSubjects([input])).toEqual([expected]);
  });

  it('keeps the first spelling of a subject and drops the repeats', () => {
    expect(curateSubjects(['Humans', 'Human', 'HUMANS', 'humans'])).toEqual(['Humans']);
  });

  it('leaves a clean list alone', () => {
    const clean = ['History', 'Anthropology', 'Evolution'];
    expect(curateSubjects(clean)).toEqual(clean);
  });

  // The backfill re-runs over rows it has already written.
  it('is idempotent', () => {
    const once = curateSubjects(SAPIENS_SUBJECTS);
    expect(curateSubjects(once)).toEqual(once);
  });

  it.each([[[]], [null], [undefined]])('survives %o', (input) => {
    expect(curateSubjects(input as unknown as string[])).toEqual([]);
  });
});
