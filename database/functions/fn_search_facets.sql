-- Distinct subject/mood values across the catalog, for building search filter pills.
CREATE OR REPLACE FUNCTION fn_search_facets()
RETURNS TABLE (
    subjects TEXT[],
    moods    TEXT[]
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        ARRAY(SELECT DISTINCT s FROM books b, unnest(b.subjects) AS s ORDER BY s) AS subjects,
        ARRAY(SELECT DISTINCT m FROM books b, unnest(b.moods) AS m ORDER BY m) AS moods;
END;
$$;
