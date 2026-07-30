import { completeText } from '../../lib/llm/complete-text';

export async function generateSummary(title: string, author: string, blurb?: string): Promise<string> {
  const blurbContext = blurb ? ` Here is some context about the book: ${blurb}.` : '';
  const prompt = `Write a 3-paragraph summary of the book '${title}' by ${author}.${blurbContext} Focus on key themes and why the book matters.`;

  // Prose, so a summary that runs past the budget is still worth showing — and
  // every model in the chain shares the same budget, so rejecting truncation
  // here would turn a slightly clipped summary into no summary at all.
  return completeText(prompt, { maxTokens: 1024, tolerateTruncation: true });
}
