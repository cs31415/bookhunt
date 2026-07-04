-- Return book row by google_books_id, or NULL if not found.
CREATE OR REPLACE FUNCTION fn_get_book_by_google_id(
    p_google_books_id VARCHAR
) RETURNS SETOF books
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM books WHERE google_books_id = p_google_books_id;
END;
$$;
