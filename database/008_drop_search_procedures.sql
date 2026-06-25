-- Drop unused catalog search procedure (search is now handled by /api/ai/search via Google Books API)

BEGIN;

DROP FUNCTION IF EXISTS sp_search_books(VARCHAR, TEXT[], TEXT[], INT, VARCHAR);

COMMIT;
