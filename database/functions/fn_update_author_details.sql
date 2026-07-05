-- Fill in missing author details without overwriting existing values
CREATE OR REPLACE FUNCTION fn_update_author_details(
    p_author_id  INT,
    p_birth_year INT,
    p_country    VARCHAR,
    p_bio        TEXT
) RETURNS SETOF authors
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    UPDATE authors
    SET birth_year = COALESCE(authors.birth_year, p_birth_year),
        country    = COALESCE(authors.country, p_country),
        bio        = COALESCE(authors.bio, p_bio)
    WHERE authors.id = p_author_id
    RETURNING authors.*;
END;
$$;
