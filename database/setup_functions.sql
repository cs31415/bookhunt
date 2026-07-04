-- BookHunt: create all stored functions
-- Run with: psql -d <database> -f database/setup_functions.sql

BEGIN;

-- auth
\ir functions/sp_register_user.sql
\ir functions/sp_find_user_by_email.sql
\ir functions/sp_set_reset_token.sql
\ir functions/sp_reset_password.sql

-- books & authors
\ir functions/sp_upsert_book_from_google.sql
\ir functions/sp_get_book_by_slug.sql
\ir functions/sp_get_book_by_google_id.sql
\ir functions/sp_get_author_by_slug.sql
\ir functions/sp_get_books_by_author.sql
\ir functions/sp_get_related_books.sql
\ir functions/sp_update_book_ai_metadata.sql

-- library
\ir functions/sp_get_user_library.sql
\ir functions/sp_add_to_library.sql
\ir functions/sp_update_library_entry.sql
\ir functions/sp_remove_from_library.sql
\ir functions/sp_library_stats.sql
\ir functions/sp_add_user_related.sql
\ir functions/sp_remove_user_related.sql

-- recommendations
\ir functions/sp_recommendations.sql

-- ai summaries
\ir functions/sp_get_ai_summary.sql
\ir functions/sp_save_ai_summary.sql

COMMIT;
