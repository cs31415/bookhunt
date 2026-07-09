import { matchesDetectedBook } from '../../../models/upload/matches-detected-book';

describe('matchesDetectedBook', () => {
  it('accepts an exact title and author match', () => {
    expect(
      matchesDetectedBook({ title: 'Dune', authors: ['Frank Herbert'] }, 'Dune', 'Frank Herbert'),
    ).toBe(true);
  });

  it('accepts a result title that is a superset of the detected title', () => {
    expect(
      matchesDetectedBook(
        { title: 'National Geographic Concise History of the World', authors: ['Neil Kagan'] },
        'Concise History of the World',
        'Kagan',
      ),
    ).toBe(true);
  });

  it('rejects a partially overlapping title with a different author', () => {
    expect(
      matchesDetectedBook(
        { title: 'Concise History of Science & Invention', authors: ['Jolyon Goddard'] },
        'Concise History of the World',
        'Kagan',
      ),
    ).toBe(false);
  });

  it('accepts a full title match even when the detected author is wrong', () => {
    // Vision often misreads the publisher as the author
    expect(
      matchesDetectedBook(
        { title: "The Photographer's Eye", authors: ['John Szarkowski'] },
        "The Photographer's Eye",
        'Littler Brown',
      ),
    ).toBe(true);
  });

  it('accepts a mostly matching title despite an author mismatch', () => {
    // Misread spine: "Dauiares" for "D'Aulaires", publisher as author
    expect(
      matchesDetectedBook(
        { title: "D'Aulaires' Book of Greek Myths", authors: ["Ingri d'Aulaire"] },
        "Dauiares' Book of Greek Myths",
        'Doubleday',
      ),
    ).toBe(true);
  });

  it('treats a null detected author as matching', () => {
    expect(
      matchesDetectedBook({ title: 'The Elements', authors: ['Theodore Gray'] }, 'Elements', null),
    ).toBe(true);
  });

  it('treats a result without authors as matching', () => {
    expect(matchesDetectedBook({ title: 'Dune', authors: [] }, 'Dune', 'Frank Herbert')).toBe(true);
  });

  it('matches authors on a shared surname token', () => {
    expect(
      matchesDetectedBook(
        { title: 'Ansel Adams in the National Parks', authors: ['Ansel Adams'] },
        'National Parks',
        'Ansel Adams, Little Brown',
      ),
    ).toBe(true);
  });

  it('rejects an unrelated title', () => {
    expect(
      matchesDetectedBook(
        { title: 'A Global History of Pre-Modern Warfare', authors: ['Kaushik Roy'] },
        'Concise History of the World',
        'Kagan',
      ),
    ).toBe(false);
  });

  it('ignores case, punctuation, and diacritics when comparing', () => {
    expect(
      matchesDetectedBook(
        { title: 'LES MISÉRABLES', authors: ['Victor Hugo'] },
        'Les Miserables',
        'Hugo',
      ),
    ).toBe(true);
  });

  it('rejects when the detected title has no usable tokens', () => {
    expect(matchesDetectedBook({ title: 'Dune', authors: [] }, '!!!', null)).toBe(false);
  });
});
