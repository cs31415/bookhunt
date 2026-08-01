import { buildVocabularyClause } from '../../../models/ai/build-vocabulary-clause';

describe('buildVocabularyClause', () => {
  it('is empty when no vocabulary is known', () => {
    expect(buildVocabularyClause({})).toBe('');
    expect(buildVocabularyClause({ categories: [], themes: [], moods: [] })).toBe('');
  });

  it('lists each kind that has values', () => {
    const clause = buildVocabularyClause({
      categories: ['Popular Science'],
      themes: ['Deep Time'],
      moods: ['Rigorous'],
    });

    expect(clause).toContain('Categories already in use: Popular Science.');
    expect(clause).toContain('Themes already in use: Deep Time.');
    expect(clause).toContain('Moods already in use: Rigorous.');
  });

  it('omits a kind with no values rather than showing an empty list', () => {
    const clause = buildVocabularyClause({ themes: ['Deep Time'], moods: [] });

    expect(clause).toContain('Themes already in use');
    expect(clause).not.toContain('Moods already in use');
    expect(clause).not.toContain('Categories already in use');
  });

  // The wording is the mechanism, not a detail: "prefer a tag from this list"
  // had the model answering multiple choice, taking 358 of 358 themes off the
  // list across a 64-book run. These four assertions are the parts that fixed it.
  it('fixes the order, rules out a near match, shows the failure, and expects new tags', () => {
    const clause = buildVocabularyClause({ themes: ['Individual Agency'] });

    expect(clause).toContain("Decide each book's tags on their own merits first");
    expect(clause).toContain('NOT a match');
    expect(clause).toContain('the art of effortless action');
    expect(clause).toContain('most books need at least one tag that is not on them');
  });
});
