-- Create an author by slug, or return the existing row when the slug is already
-- taken. Used when a provider-resolved author (not yet in the catalog) is
-- persisted on first request. Fills in biographical details without clobbering
-- values an existing row already has.
CREATE OR REPLACE FUNCTION fn_create_author(
    p_slug       VARCHAR,
    p_name       VARCHAR,
    p_birth_year INT,
    p_country    VARCHAR,
    p_bio        TEXT
) RETURNS SETOF authors
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    INSERT INTO authors (slug, name, birth_year, country, bio)
    VALUES (p_slug, p_name, p_birth_year, p_country, p_bio)
    ON CONFLICT (slug) DO UPDATE SET
        birth_year = COALESCE(authors.birth_year, EXCLUDED.birth_year),
        country    = COALESCE(authors.country, EXCLUDED.country),
        bio        = COALESCE(authors.bio, EXCLUDED.bio)
    RETURNING authors.*;
END;
$$;
