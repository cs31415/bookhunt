import Anthropic from '@anthropic-ai/sdk';
import { extractResponseText } from '../extract-response-text';
import { LlmTruncatedError } from './llm-errors';
import { LlmRequest } from './llm-types';

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

export async function completeWithAnthropic(model: string, request: LlmRequest): Promise<string> {
  const content = request.imageUrls?.length
    ? [
        ...request.imageUrls.map((url) => ({
          type: 'image' as const,
          source: { type: 'url' as const, url },
        })),
        { type: 'text' as const, text: request.prompt },
      ]
    : request.prompt;

  const response = await getAnthropic().messages.create({
    model,
    max_tokens: request.maxTokens,
    messages: [{ role: 'user', content }],
  });

  if (!request.tolerateTruncation && response.stop_reason === 'max_tokens') {
    throw new LlmTruncatedError('anthropic', model, request.maxTokens);
  }

  return extractResponseText(response, '');
}
