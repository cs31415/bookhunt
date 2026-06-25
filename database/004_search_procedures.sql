-- BookHunt search stored procedures

BEGIN;

CREATE OR REPLACE FUNCTION sp_search_books(
    p_query    VARCHAR  DEFAULT NULL,
    p_subjects TEXT[]   DEFAULT NULL,
    p_moods    TEXT[]   DEFAULT NULL,
    p_decade   INT      DEFAULT NULL,
    p_sort     VARCHAR  DEFAULT 'relevance'
)
RETURNS TABLE(
    id              INT,
    slug            VARCHAR,
    title           VARCHAR,
    author_id       INT,
    year            INT,
    publisher       VARCHAR,
    pages           INT,
    rating          NUMERIC,
    subjects        TEXT[],
    moods           TEXT[],
    genres          TEXT[],
    themes          TEXT[],
    hue             VARCHAR,
    blurb           TEXT,
    cover_url       VARCHAR,
    google_books_id VARCHAR,
    isbn13          VARCHAR,
    language        VARCHAR,
    related         INT[],
    author_name     VARCHAR,
    author_slug     VARCHAR,
    score           INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_query_lower  VARCHAR;
    v_words        TEXT[];
    v_has_query    BOOLEAN;
BEGIN
    v_query_lower := LOWER(TRIM(COALESCE(p_query, '')));
    v_has_query   := (v_query_lower <> '');

    IF v_has_query THEN
        v_words := string_to_array(v_query_lower, ' ');
    END IF;

    RETURN QUERY
    WITH scored AS (
        SELECT
            b.id,
            b.slug,
            b.title,
            b.author_id,
            b.year,
            b.publisher,
            b.pages,
            b.rating,
            b.subjects,
            b.moods,
            b.genres,
            b.themes,
            b.hue,
            b.blurb,
            b.cover_url,
            b.google_books_id,
            b.isbn13,
            b.language,
            b.related,
            a.name   AS author_name,
            a.slug   AS author_slug,
            CASE
                WHEN v_has_query THEN (
                    -- Per-word scoring: split query into words, score each independently
                    (
                        SELECT COALESCE(SUM(
                            CASE WHEN LOWER(b.title) LIKE '%' || w || '%' THEN 6 ELSE 0 END
                            + CASE WHEN LOWER(a.name) LIKE '%' || w || '%' THEN 5 ELSE 0 END
                            + CASE WHEN EXISTS (
                                SELECT 1 FROM unnest(b.subjects) AS s
                                WHERE LOWER(s) LIKE '%' || w || '%'
                              ) THEN 3 ELSE 0 END
                            + CASE WHEN EXISTS (
                                SELECT 1 FROM unnest(b.genres) AS g
                                WHERE LOWER(g) LIKE '%' || w || '%'
                              ) THEN 3 ELSE 0 END
                            + CASE WHEN EXISTS (
                                SELECT 1 FROM unnest(b.themes) AS t
                                WHERE LOWER(t) LIKE '%' || w || '%'
                              ) THEN 3 ELSE 0 END
                            + CASE WHEN EXISTS (
                                SELECT 1 FROM unnest(b.moods) AS m
                                WHERE LOWER(m) LIKE '%' || w || '%'
                              ) THEN 2 ELSE 0 END
                            + CASE WHEN LOWER(COALESCE(b.blurb, '')) LIKE '%' || w || '%' THEN 1 ELSE 0 END
                        ), 0)
                        FROM unnest(v_words) AS w
                    )
                    -- Whole-phrase bonus: +4 if full query appears in concatenated haystack
                    + CASE WHEN (
                        LOWER(b.title) || ' ' ||
                        LOWER(a.name) || ' ' ||
                        LOWER(COALESCE(array_to_string(b.subjects, ' '), '')) || ' ' ||
                        LOWER(COALESCE(array_to_string(b.genres, ' '), '')) || ' ' ||
                        LOWER(COALESCE(array_to_string(b.themes, ' '), '')) || ' ' ||
                        LOWER(COALESCE(array_to_string(b.moods, ' '), '')) || ' ' ||
                        LOWER(COALESCE(b.blurb, ''))
                      ) LIKE '%' || v_query_lower || '%'
                      THEN 4 ELSE 0 END
                )
                ELSE 0
            END AS score
        FROM books b
        JOIN authors a ON a.id = b.author_id
        WHERE
            -- subject filter: at least one overlapping subject
            (p_subjects IS NULL OR b.subjects && p_subjects)
            -- mood filter: at least one overlapping mood
            AND (p_moods IS NULL OR b.moods && p_moods)
            -- century filter: year in [p_decade, p_decade + 100)
            AND (p_decade IS NULL OR (b.year >= p_decade AND b.year < p_decade + 100))
    )
    SELECT
        s.id,
        s.slug::VARCHAR,
        s.title::VARCHAR,
        s.author_id,
        s.year,
        s.publisher::VARCHAR,
        s.pages,
        s.rating,
        s.subjects,
        s.moods,
        s.genres,
        s.themes,
        s.hue::VARCHAR,
        s.blurb,
        s.cover_url::VARCHAR,
        s.google_books_id::VARCHAR,
        s.isbn13::VARCHAR,
        s.language::VARCHAR,
        s.related,
        s.author_name::VARCHAR,
        s.author_slug::VARCHAR,
        s.score::INT
    FROM scored s
    WHERE
        -- If query was provided, exclude books with zero score
        (NOT v_has_query OR s.score > 0)
    ORDER BY
        CASE WHEN p_sort = 'relevance' THEN s.score END DESC,
        CASE WHEN p_sort = 'relevance' THEN s.rating END DESC NULLS LAST,
        CASE WHEN p_sort = 'rating'    THEN s.rating END DESC NULLS LAST,
        CASE WHEN p_sort = 'year-new'  THEN s.year   END DESC NULLS LAST,
        CASE WHEN p_sort = 'year-old'  THEN s.year   END ASC  NULLS LAST,
        CASE WHEN p_sort = 'title'     THEN s.title  END ASC;
END;
$$;

COMMIT;
