import { getAuthorBySlug as fetchAuthorBySlug, getBooksByAuthor, updateAuthorDetails } from '../../data/authors-data';
import { fetchOpenLibraryAuthorDetails } from '../../lib/open-library-author-details';
import { generateAuthorDetails } from '../ai/get-author-details';

export { getBooksByAuthor };

export async function getAuthorBySlug(slug: string) {
  const author = await fetchAuthorBySlug(slug);
  if (!author) return null;
  if (author.birth_year && author.country && author.bio) return author;
  return enrichAuthor(author);
}

async function enrichAuthor(author: any) {
  let { birth_year: birthYear, country, bio } = author;

  if (!birthYear || !bio) {
    const olDetails = await fetchOpenLibraryAuthorDetails(author.name);
    birthYear = birthYear || olDetails.birthYear;
    bio = bio || olDetails.bio;
  }

  if (!birthYear || !country || !bio) {
    const aiDetails = await generateAuthorDetails(author.name, { birthYear, country, bio });
    birthYear = birthYear || aiDetails.birthYear;
    country = country || aiDetails.country;
    bio = bio || aiDetails.bio;
  }

  if (birthYear === author.birth_year && country === author.country && bio === author.bio) {
    return author;
  }
  return updateAuthorDetails(author.id, { birthYear, country, bio });
}
