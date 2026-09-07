import 'dotenv/config';
import { resolveImportRows } from './src/models/import/resolve-rows';
import { providerChain, fallbackProvider } from './src/lib/books/provider-chain';

(async () => {
  console.log('  chain:', providerChain(), ' fallback:', fallbackProvider());
  const rows = await resolveImportRows(
    [{ title: 'Prague', publisher: 'DK Publishing' }, { title: 'Hawaii', publisher: 'DK Publishing' }],
    null,
  );
  for (const r of rows as any[]) {
    console.log(`\n  row: ${r.title ?? '?'}`);
    for (const c of (r.candidates ?? []).slice(0, 4)) {
      console.log(`    gid=${c.googleBooksId ?? '-'}  ol=${c.openLibraryId ?? '-'}  src=${c.source ?? '-'}  ${String(c.title).slice(0, 34)}`);
    }
  }
})();
