import { scoreCandidate } from '../../../models/upload/matches-detected-book';

const frommers = {
  title: "Frommer's Hong Kong",
  authors: ['Beth Reiber'],
  publishers: ['Prentice-Hall', "Frommer's", 'Wiley Publishing Co.'],
};

const lonelyPlanet = {
  title: 'Hong Kong',
  authors: ['Piera Chen'],
  publishers: ['Lonely Planet'],
};

const novel = {
  title: 'Hong Kong',
  authors: ['Stephen Coonts'],
  publishers: ['St. Martin’s Press'],
};

describe('scoreCandidate', () => {
  it('scores a full title match higher than a partial one', () => {
    const hint = { title: 'Concise History of the World' };
    const full = scoreCandidate(
      { title: 'A Concise History of the World', authors: [] },
      hint,
    );
    const partial = scoreCandidate({ title: 'A History of Everything', authors: [] }, hint);

    expect(full).toBeGreaterThan(partial);
  });

  it('scores zero for a title with no informative tokens', () => {
    expect(scoreCandidate({ title: 'Dune', authors: [] }, { title: '' })).toBe(0);
  });

  // The case this exists for: no author, a generic title, only a publisher to
  // tell dozens of identically-titled editions apart.
  it('ranks the matching publisher first when there is no author', () => {
    const hint = { title: 'Hong Kong', author: null, publisher: "Frommer's" };

    const scores = [frommers, lonelyPlanet, novel]
      .map((c) => ({ title: c.title, publisher: c.publishers[0], score: scoreCandidate(c, hint) }))
      .sort((a, b) => b.score - a.score);

    expect(scores[0].title).toBe("Frommer's Hong Kong");
  });

  it('matches a publisher listed among several the work reports', () => {
    // "Frommer's" is third in the list, not first.
    const withHint = scoreCandidate(frommers, { title: 'Hong Kong', publisher: "Frommer's" });
    const withoutHint = scoreCandidate(frommers, { title: 'Hong Kong' });

    expect(withHint).toBeGreaterThan(withoutHint);
  });

  it.each([["Frommer's"], ['Frommers'], ['*Frommers'], ['frommers']])(
    'treats %s as the same publisher',
    (variant) => {
      const candidate = { title: 'Hong Kong', authors: [], publishers: [variant] };
      const matched = scoreCandidate(candidate, { title: 'Hong Kong', publisher: "Frommer's" });
      const unmatched = scoreCandidate(candidate, { title: 'Hong Kong' });

      expect(matched).toBeGreaterThan(unmatched);
    },
  );

  it('does not credit a publisher that does not match', () => {
    const hint = { title: 'Hong Kong', publisher: "Frommer's" };

    expect(scoreCandidate(lonelyPlanet, hint)).toBe(scoreCandidate(lonelyPlanet, { title: 'Hong Kong' }));
  });

  // Google omits publisher from search results even for the correct book, so
  // absence must be neutral or every Google result gets buried.
  it('does not penalise a candidate with no publisher data', () => {
    const noData = { title: "Frommer's Hong Kong", authors: [], publishers: [] };
    const wrongPublisher = { title: "Frommer's Hong Kong", authors: [], publishers: ['Lonely Planet'] };
    const hint = { title: "Frommer's Hong Kong", publisher: "Frommer's" };

    expect(scoreCandidate(noData, hint)).toBe(scoreCandidate(wrongPublisher, hint));
  });

  it('treats a missing publishers field the same as an empty one', () => {
    const hint = { title: 'Hong Kong', publisher: "Frommer's" };

    expect(scoreCandidate({ title: 'Hong Kong', authors: [] }, hint)).toBe(
      scoreCandidate({ title: 'Hong Kong', authors: [], publishers: [] }, hint),
    );
  });

  it('does not penalise a hint with no publisher', () => {
    expect(scoreCandidate(frommers, { title: 'Hong Kong' })).toBe(
      scoreCandidate(frommers, { title: 'Hong Kong', publisher: null }),
    );
  });

  it('credits a matching author', () => {
    const hint = { title: 'Hong Kong', author: 'Reiber' };

    expect(scoreCandidate(frommers, hint)).toBeGreaterThan(
      scoreCandidate(frommers, { title: 'Hong Kong' }),
    );
  });

  it('lets author and publisher both contribute', () => {
    const titleOnly = scoreCandidate(frommers, { title: 'Hong Kong' });
    const both = scoreCandidate(frommers, {
      title: 'Hong Kong',
      author: 'Reiber',
      publisher: "Frommer's",
    });

    expect(both).toBeGreaterThan(titleOnly);
  });

  // Otherwise a wrong book with the right publisher could outrank the right book.
  it('never lets bonuses outweigh a better title match', () => {
    const rightTitleNoBonus = scoreCandidate(
      { title: 'Hong Kong', authors: [], publishers: [] },
      { title: 'Hong Kong', publisher: "Frommer's" },
    );
    const wrongTitleWithBonus = scoreCandidate(
      { title: 'Paris', authors: [], publishers: ["Frommer's"] },
      { title: 'Hong Kong', publisher: "Frommer's" },
    );

    expect(rightTitleNoBonus).toBeGreaterThan(wrongTitleWithBonus);
  });
});
