import { foldThemes } from '../../../models/ai/fold-themes';

describe('foldThemes', () => {
  it('leaves a theme alone when nothing in the vocabulary matches', () => {
    expect(foldThemes(['Coastal Erosion'], ['Cultural History'])).toEqual(['Coastal Erosion']);
  });

  it('adopts the catalog spelling when only capitalisation differs', () => {
    expect(foldThemes(['cultural history'], ['Cultural History'])).toEqual(['Cultural History']);
  });

  it('adopts the catalog spelling across a punctuation variant', () => {
    // The two spellings the catalog actually ended up with for one theme.
    expect(foldThemes(['Socio-political evolution'], ['Sociopolitical evolution'])).toEqual([
      'Sociopolitical evolution',
    ]);
  });

  it('adopts the catalog spelling across a leading article', () => {
    expect(foldThemes(['The Human Condition'], ['Human condition'])).toEqual(['Human condition']);
  });

  it('prefers the most-used spelling, which the vocabulary lists first', () => {
    expect(foldThemes(['human condition'], ['Human Condition', 'The Human Condition'])).toEqual([
      'Human Condition',
    ]);
  });

  it('keeps themes that differ by more than spelling apart', () => {
    const vocabulary = ['Cultural History'];
    expect(foldThemes(['Cultural Evolution', 'Cultural History'], vocabulary)).toEqual([
      'Cultural Evolution',
      'Cultural History',
    ]);
  });

  it('de-dups when folding collapses two generated themes onto one tag', () => {
    expect(foldThemes(['The Human Condition', 'human condition'], ['Human condition'])).toEqual([
      'Human condition',
    ]);
  });

  it('preserves the order the model returned', () => {
    expect(foldThemes(['Memory', 'Exile', 'Faith'], ['Faith'])).toEqual(['Memory', 'Exile', 'Faith']);
  });

  it('passes themes through unchanged when the vocabulary is empty', () => {
    expect(foldThemes(['Memory', 'Exile'], [])).toEqual(['Memory', 'Exile']);
  });

  it('drops themes that normalise to nothing', () => {
    expect(foldThemes(['—', ' ', 'Memory'], [])).toEqual(['Memory']);
  });
});
