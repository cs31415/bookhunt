import { Request, Response } from 'express';
import { getAuthorBySlug, getBooksByAuthor } from '../../models/authors/get-by-slug';

export async function getBySlug(req: Request, res: Response) {
  try {
    const slug = req.params.slug as string;

    const author = await getAuthorBySlug(slug);

    if (!author) {
      res.status(404).json({ error: 'Author not found' });
      return;
    }

    const books = await getBooksByAuthor(author.id);

    res.json({ author, books });
  } catch (error) {
    console.error('Error fetching author:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
