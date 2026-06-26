import { upsertBookFromGoogle, addToLibrary as addToLibraryData } from '../../data/library-data';

interface AddToLibraryParams {
  googleBooksId: string;
  slug: string;
  title: string;
  authorName: string;
  year?: number | null;
  publisher?: string | null;
  pages?: number | null;
  rating?: number | null;
  subjects?: string[] | null;
  blurb?: string | null;
  coverUrl?: string | null;
  isbn13?: string | null;
  language?: string | null;
  hue?: string | null;
  status?: string;
}

export async function addToLibrary(userId: number, params: AddToLibraryParams) {
  const book = await upsertBookFromGoogle(params);
  return addToLibraryData(userId, book.id, params.status ?? 'queued');
}
