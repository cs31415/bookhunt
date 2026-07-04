-- Return books by author, optionally excluding one book, sorted by rating
-- DESC NULLS LAST then title ASC, limited to p_limit rows.
CREATE OR REPLACE FUNCTION fn_get_books_by_author(
    p_author_id      INT,
    p_exclude_book_id INT DEFAULT NULL,
    p_limit          INT DEFAULT 10
) RETURNS SETOF books
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM books
    WHERE author_id = p_author_id
      AND (p_exclude_book_id IS NULL OR id <> p_exclude_book_id)
    ORDER BY rating DESC NULLS LAST, title ASC
    LIMIT p_limit;
END;
$$;
