-- BookHunt: drop every table and type, in reverse dependency order.
-- Run with: psql -d <database> -f database/drop_tables.sql
--
-- Destroys all data. Intended for resetting a development database; the
-- guarded entry point is `npm run db:reset`, which confirms the target first
-- and reloads the schema afterwards.
--
-- This takes the stored functions with it, which is not obvious: a function
-- returning SETOF <table> depends on that table's composite type, and half of
-- them take or return `reading_status`. So CASCADE reaches them whether or not
-- that was the intent -- which is why anything running this must follow it with
-- setup_tables.sql *and* setup_functions.sql, not just the tables.

BEGIN;

-- Every drop cascades. Without it the type below cannot go at all, and a
-- database that has drifted -- an old view, a stray table -- aborts the whole
-- reset partway rather than clearing.
SET LOCAL client_min_messages = warning;

DROP TABLE IF EXISTS canned_search_draws CASCADE;
DROP TABLE IF EXISTS user_pinned_searches CASCADE;
DROP TABLE IF EXISTS canned_searches CASCADE;
DROP TABLE IF EXISTS ai_summaries CASCADE;
DROP TABLE IF EXISTS user_favorites CASCADE;
DROP TABLE IF EXISTS library_entries CASCADE;
DROP TABLE IF EXISTS books CASCADE;
DROP TABLE IF EXISTS authors CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- After the tables, and CASCADE because the library functions take it as a
-- parameter type: fn_search_books, fn_add_to_library and four others.
DROP TYPE IF EXISTS reading_status CASCADE;

COMMIT;
