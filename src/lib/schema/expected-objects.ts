/**
 * Every table and stored function the running code expects to find.
 *
 * Hardcoded rather than parsed from database/setup_*.sql at runtime, because
 * the Docker image ships dist/ only -- there is no database/ directory in
 * production, which is exactly where this check matters most.
 *
 * Function names, not file names. Several files declare more than one function
 * (fn_user_favorites.sql alone declares five), so deriving these from filenames
 * produces names no database will ever have and a check that refuses to start
 * against a perfectly good schema.
 *
 * Kept honest by expected-objects.test.ts, which reads the CREATE FUNCTION
 * statements out of the setup files and fails if these lists drift.
 */

export const EXPECTED_TABLES: readonly string[] = [
  'users',
  'authors',
  'books',
  'library_entries',
  'user_favorites',
  'messages',
  'user_favorite_authors',
  'ai_summaries',
  'canned_searches',
  'user_pinned_searches',
  'canned_search_draws',
];

export const EXPECTED_FUNCTIONS: readonly string[] = [
  'fn_register_user',
  'fn_find_user_by_email',
  'fn_set_reset_token',
  'fn_reset_password',
  'fn_verify_email',
  'fn_set_verification_token',
  'fn_is_handle_available',
  'fn_update_user_profile',
  'fn_get_public_profile',
  'fn_get_public_library',
  'fn_shelf_facets',
  'fn_get_public_library_facets',
  'fn_get_library_facets_by_token',
  // LOS-305: the unlisted share link.
  'fn_set_share_token',
  'fn_get_share_token',
  'fn_get_profile_by_token',
  'fn_get_library_by_token',
  'fn_search_users',
  'fn_add_user_favorite',
  'fn_remove_user_favorite',
  'fn_get_user_favorites',
  'fn_is_mutual_favorite',
  'fn_get_favorite_state',
  'fn_send_message',
  'fn_get_conversations',
  'fn_get_conversation',
  'fn_mark_conversation_read',
  'fn_unread_message_count',
  'fn_add_favorite_author',
  'fn_remove_favorite_author',
  'fn_get_favorite_authors',
  'fn_get_public_favorite_authors',
  'fn_is_favorite_author',
  'fn_set_favorite_author_visibility',
  'fn_upsert_book',
  'fn_get_book_by_slug',
  'fn_enrich_thin_book',
  'fn_set_book_cover',
  'fn_get_book_by_google_id',
  'fn_get_books_by_ids',
  'fn_get_books_by_google_ids',
  'fn_get_author_by_slug',
  'fn_get_books_by_author',
  'fn_create_author',
  'fn_update_author_details',
  'fn_get_related_books',
  'fn_update_book_ai_metadata',
  'fn_tag_vocabulary',
  'fn_append_book_subjects',
  'fn_get_user_library',
  'fn_add_to_library',
  'fn_update_library_entry',
  'fn_set_library_favorite',
  'fn_set_library_visibility',
  'fn_remove_from_library',
  'fn_remove_many_from_library',
  'fn_library_stats',
  'fn_set_library_ebook',
  'fn_set_library_audiobook',
  'fn_match_library_entries',
  'fn_search_library',
  'fn_export_library',
  'fn_add_user_related',
  'fn_remove_user_related',
  'fn_search_books',
  'fn_search_facets',
  'fn_match_import_rows',
  'fn_recommendations',
  'fn_get_ai_summary',
  'fn_save_ai_summary',
];
