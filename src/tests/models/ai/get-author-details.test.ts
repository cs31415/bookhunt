import { generateAuthorDetails } from '../../../models/ai/get-author-details';
import { completeText } from '../../../lib/llm/complete-text';

jest.mock('../../../lib/llm/complete-text');

const mockCompleteText = completeText as jest.Mock;

describe('generateAuthorDetails', () => {
  const originalEnv = process.env.LOG_LLM_QUERIES;
  const known = { birthYear: null, country: null, bio: null };

  afterEach(() => {
    process.env.LOG_LLM_QUERIES = originalEnv;
  });

  it('does not log when LOG_LLM_QUERIES is unset', async () => {
    delete process.env.LOG_LLM_QUERIES;
    mockCompleteText.mockResolvedValue({ birth_year: 1900, country: 'UK', bio: 'A bio' });

    await generateAuthorDetails('Author Name', known);

    expect(console.log).not.toHaveBeenCalled();
  });

  it('logs generation start/end when LOG_LLM_QUERIES=true', async () => {
    process.env.LOG_LLM_QUERIES = 'true';
    mockCompleteText.mockResolvedValue({ birth_year: 1900, country: 'UK', bio: 'A bio' });

    await generateAuthorDetails('Author Name', known);

    expect(console.log).toHaveBeenCalledWith('[llm] generating author details for "Author Name"');
    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/^\[llm\] generated author details for "Author Name" in \d+ms$/));
  });

  it('logs the failure unconditionally even when LOG_LLM_QUERIES is unset', async () => {
    delete process.env.LOG_LLM_QUERIES;
    mockCompleteText.mockRejectedValue(new Error('down'));

    await expect(generateAuthorDetails('Author Name', known)).rejects.toThrow('down');

    expect(console.error).toHaveBeenCalled();
  });
});
