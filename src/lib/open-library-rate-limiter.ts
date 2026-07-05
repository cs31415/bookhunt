export const OPENLIBRARY_API_URL = process.env.OPENLIBRARY_API_URL || 'https://openlibrary.org';

let lastCallTime = 0;

export async function throttleOpenLibrary(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastCallTime;
  if (elapsed < 1000) {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000 - elapsed));
  }
  lastCallTime = Date.now();
}

export function resetRateLimiter(): void {
  lastCallTime = 0;
}
