// LLMs sometimes wrap JSON replies in a ```json ... ``` fence despite being
// asked for "ONLY valid JSON" -- strip it before parsing.
export function parseJsonResponse<T>(rawText: string): T {
  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonText = fenceMatch ? fenceMatch[1] : rawText;
  return JSON.parse(jsonText.trim()) as T;
}
