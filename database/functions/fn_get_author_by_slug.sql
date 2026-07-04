-- Return author row by slug, or NULL if not found.
CREATE OR REPLACE FUNCTION fn_get_author_by_slug(
    p_slug VARCHAR
) RETURNS SETOF authors
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM authors WHERE slug = p_slug;
END;
$$;
