type OpenLibraryTextField = string | { value?: string } | undefined;

export function extractOpenLibraryTextField(field: OpenLibraryTextField): string | null {
  if (!field) return null;
  return typeof field === 'string' ? field : field.value ?? null;
}
