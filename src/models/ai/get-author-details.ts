import { completeText } from '../../lib/llm/complete-text';
import { isLlmLoggingEnabled } from '../../lib/llm/is-llm-logging-enabled';
import { parseJsonResponse } from '../../lib/parse-json-response';

export interface AuthorDetails {
  birthYear: number | null;
  country: string | null;
  bio: string | null;
}

export async function generateAuthorDetails(name: string, known: AuthorDetails): Promise<AuthorDetails> {
  const knownLines = [
    known.birthYear ? `birth year: ${known.birthYear}` : null,
    known.country ? `country: ${known.country}` : null,
    known.bio ? `bio: ${known.bio}` : null,
  ].filter(Boolean);
  const knownContext = knownLines.length
    ? ` Here is what is already known, do not contradict it: ${knownLines.join('; ')}.`
    : '';

  const prompt = `Provide biographical details for the author "${name}".${knownContext} Return ONLY a JSON object with keys "birth_year" (number or null), "country" (string or null, the author's country of origin/nationality), and "bio" (a short 2-3 sentence biography, or null). Only include fields that are not already known above; use null for fields already known. Return ONLY valid JSON, no other text.`;

  const start = Date.now();
  if (isLlmLoggingEnabled()) {
    console.log(`[llm] generating author details for "${name}"`);
  }
  let parsed;
  try {
    parsed = await completeText(prompt, {
      maxTokens: 512,
      transform: (rawText) =>
        parseJsonResponse<{ birth_year: number | null; country: string | null; bio: string | null }>(rawText),
    });
    if (isLlmLoggingEnabled()) {
      console.log(`[llm] generated author details for "${name}" in ${Date.now() - start}ms`);
    }
  } catch (error) {
    console.error(`[llm] failed to generate author details for "${name}" after ${Date.now() - start}ms:`, error);
    throw error;
  }

  return {
    birthYear: parsed.birth_year ?? null,
    country: parsed.country ?? null,
    bio: parsed.bio ?? null,
  };
}
