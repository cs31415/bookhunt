/**
 * The provider's own account of a failed request (LOS-393).
 *
 * A status alone says a request failed; the message says what to do about it.
 * Google answers 429 both to a burst and to a spent daily quota, and only the
 * body tells them apart -- "Rate Limit Exceeded" is worth rerunning in a
 * minute, "you have exceeded your daily quota" is not worth rerunning today.
 *
 * Safe to read the body here: loggedFetch rebuilds only successful responses,
 * so an error response reaches the adapters unconsumed.
 */

/** Long enough for a provider's sentence, short enough that an HTML error page cannot flood the log. */
const MAX_LENGTH = 200;

function condense(text: string): string | null {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  return flat.length > MAX_LENGTH ? `${flat.slice(0, MAX_LENGTH)}...` : flat;
}

/**
 * Never throws and never rejects: this runs on a path that is already failing,
 * and an unreadable body must not replace the status the caller came here with.
 */
export async function readProviderErrorDetail(response: globalThis.Response): Promise<string | null> {
  let body: string;
  try {
    body = await response.text();
  } catch {
    return null;
  }

  try {
    // Google: { error: { code, message, errors: [...] } }. Open Library answers
    // HTML or plain text, which falls through to the body itself.
    const parsed: any = JSON.parse(body);
    const message = parsed?.error?.message ?? (typeof parsed?.error === 'string' ? parsed.error : null);
    if (typeof message === 'string') return condense(message);
  } catch {
    // Not JSON; the text is the message.
  }

  return condense(body);
}
