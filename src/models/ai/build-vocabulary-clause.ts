export interface Vocabularies {
  categories?: string[];
  themes?: string[];
  moods?: string[];
}

const LABELS: Record<keyof Vocabularies, string> = {
  categories: 'Categories',
  themes: 'Themes',
  moods: 'Moods',
};

/**
 * The prompt fragment that shows a model the tags the catalog already uses and
 * tells it how to reuse them. Every call that generates tags appends this;
 * there is exactly one copy because the wording is the whole mechanism.
 *
 * Asked cold, a model coins a fresh phrase for every book, so almost no two
 * books share a tag and the library's filters have nothing to group by. But
 * asked merely to "prefer" something from the list, it stops analysing the book
 * and answers multiple choice: in a 64-book run every one of the 358 themes
 * produced came off the list, and The Tao of Pooh lost 'the art of effortless
 * action' -- the book's whole subject -- for 'Individual Agency'. Rewritten to
 * fix the order and name the failure, that fell to 251 of 357, with 4 books
 * rather than 64 answering entirely from the list.
 *
 * So the shape below is load-bearing: decide first, swap second; related or
 * broader is explicitly not a match; the worked example is the real failure;
 * and new values are stated to be expected. A tag that is shared but wrong is
 * worse than one that is right and rare.
 */
export function buildVocabularyClause(vocabularies: Vocabularies): string {
  const lists = (Object.keys(LABELS) as (keyof Vocabularies)[])
    // An empty list is omitted rather than shown empty: it is not a weaker
    // hint, it is a confusing one.
    .filter((kind) => (vocabularies[kind]?.length ?? 0) > 0)
    .map((kind) => `${LABELS[kind]} already in use: ${vocabularies[kind]!.join(', ')}.`);

  if (lists.length === 0) return '';

  return (
    ` ${lists.join(' ')}` +
    ` Decide each book's tags on their own merits first. Then swap in a value from those lists only where it means the same thing as the tag you chose, copying its capitalisation and punctuation exactly.` +
    ` Merely related, broader, or in the same subject area is NOT a match: a book about wu wei needs 'the art of effortless action', and answering 'Individual Agency' because it is on the list would be wrong.` +
    ` Keep your own wording wherever the lists hold no true equivalent -- most books need at least one tag that is not on them.`
  );
}
