import OpenAI from 'openai';
import { LlmTruncatedError } from './llm-errors';
import { LlmRequest } from './llm-types';

let _openai: OpenAI | null = null;

function getOpenAi(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export async function completeWithOpenAi(model: string, request: LlmRequest): Promise<string> {
  const response = await getOpenAi().chat.completions.create({
    model,
    max_completion_tokens: request.maxTokens,
    messages: [{ role: 'user', content: request.prompt }],
  });

  if (!request.tolerateTruncation && response.choices[0]?.finish_reason === 'length') {
    throw new LlmTruncatedError('openai', model, request.maxTokens);
  }

  return response.choices[0]?.message?.content ?? '';
}
