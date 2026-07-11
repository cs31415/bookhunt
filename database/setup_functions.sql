-- BookHunt: create all stored functions
-- Run with: psql -d <database> -f database/setup_functions.sql

BEGIN;

-- auth
\ir functions/fn_register_user.sql
\ir functions/fn_find_user_by_email.sql
\ir functions/fn_set_reset_token.sql
\ir functions/fn_reset_password.sql

-- books & authors
\ir functions/fn_upsert_book.sql
\ir functions/fn_get_book_by_slug.sql
\ir functions/fn_get_book_by_google_id.sql
\ir functions/fn_get_books_by_ids.sql
\ir functions/fn_get_author_by_slug.sql
\ir functions/fn_get_books_by_author.sql
\ir functions/fn_update_author_details.sql
\ir functions/fn_get_related_books.sql
\ir functions/fn_update_book_ai_metadata.sql

-- library
\ir functions/fn_get_user_library.sql
\ir functions/fn_add_to_library.sql
\ir functions/fn_update_library_entry.sql
\ir functions/fn_remove_from_library.sql
\ir functions/fn_library_stats.sql
\ir functions/fn_add_user_related.sql
\ir functions/fn_remove_user_related.sql

-- search
\ir functions/fn_search_books.sql
\ir functions/fn_search_facets.sql

-- recommendations
\ir functions/fn_recommendations.sql

-- ai summaries
\ir functions/fn_get_ai_summary.sql
\ir functions/fn_save_ai_summary.sql

COMMIT;
