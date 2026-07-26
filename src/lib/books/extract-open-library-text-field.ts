import { stripHtml } from '../text/strip-html';

type OpenLibraryTextField = string | { value?: string } | undefined;

export function extractOpenLibraryTextField(field: OpenLibraryTextField): string | null {
  if (!field) return null;
  const raw = typeof field === 'string' ? field : field.value ?? null;
  return stripHtml(raw);
}
