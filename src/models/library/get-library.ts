import { getUserLibrary, getLibraryStats } from '../../data/library-data';

export async function getLibrary(userId: number) {
  const [entries, stats] = await Promise.all([
    getUserLibrary(userId),
    getLibraryStats(userId),
  ]);

  return { entries, stats };
}
