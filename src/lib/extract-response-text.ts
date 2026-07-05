import Anthropic from '@anthropic-ai/sdk';

export function extractResponseText(response: Anthropic.Message, fallback: string): string {
  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock && 'text' in textBlock ? textBlock.text : fallback;
}
