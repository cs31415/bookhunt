import { categorizeBooks } from '../../../models/ai/categorize-books';
import * as aiData from '../../../data/ai-data';
import { completeText } from '../../../lib/llm/complete-text';

jest.mock('../../../data/ai-data');
jest.mock('../../../lib/llm/complete-text');

const mockGetTagVocabulary = aiData.getTagVocabulary as jest.Mock;
const mockUpdateBookAiMetadata = aiData.updateBookAiMetadata as jest.Mock;
const mockAppendBookSubjects = aiData.appendBookSubjects as jest.Mock;
const mockCompleteText = completeText as jest.Mock;

function mockLlmResponse(text: string) {
  mockCompleteText.mockImplementation(async (_prompt, options) =>
    options.transform ? options.transform(text) : text,
  );
}

const books = [
  { id: 10, title: 'Cosmos', authorName: 'Carl Sagan' },
  { id: 20, title: 'We the Living', authorName: 'Ayn Rand' },
];

describe('categorizeBooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTagVocabulary.mockResolvedValue([]);
  });

  it('does not call the model for an empty batch', async () => {
    expect(await categorizeBooks([])).toEqual([]);
    expect(mockCompleteText).not.toHaveBeenCalled();
  });

  it('sends every book in one call, numbered so answers can be matched back', async () => {
    mockLlmResponse('[]');

    await categorizeBooks(books);

    expect(mockCompleteText).toHaveBeenCalledTimes(1);
    const prompt = mockCompleteText.mock.calls[0][0];
    expect(prompt).toContain("0. 'Cosmos' by Carl Sagan");
    expect(prompt).toContain("1. 'We the Living' by Ayn Rand");
  });

  it('asks for tags broad enough that several books share one', async () => {
    mockLlmResponse('[]');

    await categorizeBooks(books);

    const prompt = mockCompleteText.mock.calls[0][0];
    expect(prompt).toContain('prefer tags broad enough that several of these books share one');
    expect(prompt).toContain('name the kind of book rather than its specific subject matter');
  });

  it('writes categories to genres and appends them to subjects', async () => {
    mockLlmResponse(
      '[{"index":0,"categories":["Popular Science"],"themes":["Deep Time"],"moods":["Awe-inspiring"]}]',
    );

    const result = await categorizeBooks(books);

    expect(mockUpdateBookAiMetadata).toHaveBeenCalledWith(10, ['Popular Science'], ['Deep Time'], ['Awe-inspiring']);
    // Appended, not written: books.subjects also holds the provider's tags.
    expect(mockAppendBookSubjects).toHaveBeenCalledWith(10, ['Popular Science']);
    expect(result).toEqual([
      { id: 10, categories: ['Popular Science'], themes: ['Deep Time'], moods: ['Awe-inspiring'] },
    ]);
  });

  // Positional mapping would shift every later book's tags onto its neighbour.
  it('matches answers by index, not by position', async () => {
    mockLlmResponse('[{"index":1,"categories":["Fiction"],"themes":["Individual Agency"],"moods":["Intense"]}]');

    const result = await categorizeBooks(books);

    expect(result).toEqual([{ id: 20, categories: ['Fiction'], themes: ['Individual Agency'], moods: ['Intense'] }]);
    expect(mockUpdateBookAiMetadata).toHaveBeenCalledTimes(1);
    expect(mockUpdateBookAiMetadata).toHaveBeenCalledWith(20, ['Fiction'], ['Individual Agency'], ['Intense']);
  });

  it('skips a book the model omitted rather than guessing at it', async () => {
    mockLlmResponse('[{"index":0,"categories":["Popular Science"],"themes":["Deep Time"],"moods":["Rigorous"]}]');

    const result = await categorizeBooks(books);

    expect(result.map((r) => r.id)).toEqual([10]);
  });

  it('ignores an index outside the batch', async () => {
    mockLlmResponse('[{"index":99,"categories":["Nonsense"],"themes":[],"moods":[]}]');

    expect(await categorizeBooks(books)).toEqual([]);
    expect(mockUpdateBookAiMetadata).not.toHaveBeenCalled();
  });

  it('folds each kind onto the spelling the catalog already uses', async () => {
    mockGetTagVocabulary.mockImplementation(async (kind: string) =>
      ({ subjects: ['Popular Science'], themes: ['Deep Time'], moods: ['Mind-expanding'] })[kind],
    );
    mockLlmResponse(
      '[{"index":0,"categories":["popular science"],"themes":["deep time"],"moods":["mind expanding"]}]',
    );

    const [result] = await categorizeBooks(books);

    expect(result.categories).toEqual(['Popular Science']);
    expect(result.themes).toEqual(['Deep Time']);
    expect(result.moods).toEqual(['Mind-expanding']);
  });

  it('defaults missing tag arrays to empty rather than failing the batch', async () => {
    mockLlmResponse('[{"index":0}]');

    expect(await categorizeBooks(books)).toEqual([{ id: 10, categories: [], themes: [], moods: [] }]);
  });
});
