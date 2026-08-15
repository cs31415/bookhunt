-- BookHunt: create all tables in dependency order
-- Run with: psql -d <database> -f database/setup_tables.sql

BEGIN;

\ir tables/reading_status.sql
\ir tables/users.sql
\ir tables/authors.sql
\ir tables/books.sql
\ir tables/library_entries.sql
\ir tables/user_favorites.sql
\ir tables/messages.sql
\ir tables/user_favorite_authors.sql
\ir tables/ai_summaries.sql
\ir tables/canned_searches.sql
\ir tables/user_pinned_searches.sql
\ir tables/canned_search_draws.sql

COMMIT;
