-- Search the catalog by free text and/or facets (subjects, moods, decade,
-- author, status). Text scoring mirrors the original prototype's localSearch:
-- title x6, author x5, subjects/genres/themes x3, moods x2, full haystack x1,
-- plus a +4 whole-phrase bonus. When p_user_id is supplied, results are
-- annotated with the caller's library status; p_status/p_in_library_only are
-- no-ops when p_user_id is NULL. Returns a window total_count for pagination.
CREATE OR REPLACE FUNCTION fn_search_books(
    p_terms           TEXT[]         DEFAULT NULL,
    p_phrase          TEXT           DEFAULT NULL,
    p_subjects        TEXT[]         DEFAULT NULL,
    p_moods           TEXT[]         DEFAULT NULL,
    p_decade          INT            DEFAULT NULL,
    p_author_slug     VARCHAR        DEFAULT NULL,
    p_user_id         INT            DEFAULT NULL,
    p_status          reading_status DEFAULT NULL,
    p_in_library_only BOOLEAN        DEFAULT FALSE,
    p_sort            TEXT           DEFAULT 'relevance',
    p_limit           INT            DEFAULT 24,
    p_offset          INT            DEFAULT 0
) RETURNS TABLE (
    book_id         INT,
    slug            VARCHAR,
    title           VARCHAR,
    author_id       INT,
    author_name     VARCHAR,
    author_slug     VARCHAR,
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
    isbn13          VARCHAR,
    language        VARCHAR,
    in_library      BOOLEAN,
    library_status  reading_status,
    relevance       NUMERIC,
    total_count     BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH scored AS (
        SELECT
            b.id                AS book_id,
            b.slug,
            b.title,
            b.author_id,
            a.name              AS author_name,
            a.slug              AS author_slug,
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
            b.isbn13,
            b.language,
            (le.status IS NOT NULL) AS in_library,
            le.status           AS library_status,
            (
                COALESCE(scores.term_score, 0)
                +
                CASE WHEN p_phrase IS NOT NULL AND LENGTH(p_phrase) > 3 AND (
                    b.title || ' ' || a.name || ' ' || COALESCE(b.publisher, '') || ' ' || COALESCE(b.year::TEXT, '') ||
                    ' ' || array_to_string(b.subjects, ' ') || ' ' || array_to_string(b.moods, ' ') ||
                    ' ' || array_to_string(b.genres, ' ') || ' ' || array_to_string(b.themes, ' ') || ' ' || COALESCE(b.blurb, '')
                ) ILIKE '%' || p_phrase || '%'
                THEN 4 ELSE 0 END
            )::NUMERIC AS relevance,
            COALESCE(scores.matched_terms, 0) AS matched_terms
        FROM books b
        JOIN authors a ON a.id = b.author_id
        LEFT JOIN library_entries le ON le.book_id = b.id AND le.user_id = p_user_id
        -- Per term rather than one SUM, so the count of terms that actually hit
        -- something is available alongside the total. Ranking needs the total;
        -- deciding whether a book qualifies at all needs the count.
        CROSS JOIN LATERAL (
            SELECT
                SUM(scored_term.score)                             AS term_score,
                COUNT(*) FILTER (WHERE scored_term.score > 0)::INT AS matched_terms
            FROM unnest(p_terms) AS t
            CROSS JOIN LATERAL (
                SELECT (
                    CASE WHEN b.title ILIKE '%' || t || '%' THEN 6 ELSE 0 END +
                    CASE WHEN a.name ILIKE '%' || t || '%' THEN 5 ELSE 0 END +
                    CASE WHEN EXISTS (SELECT 1 FROM unnest(b.subjects) x WHERE x ILIKE '%' || t || '%') THEN 3 ELSE 0 END +
                    CASE WHEN EXISTS (SELECT 1 FROM unnest(b.genres)   x WHERE x ILIKE '%' || t || '%') THEN 3 ELSE 0 END +
                    CASE WHEN EXISTS (SELECT 1 FROM unnest(b.themes)   x WHERE x ILIKE '%' || t || '%') THEN 3 ELSE 0 END +
                    CASE WHEN EXISTS (SELECT 1 FROM unnest(b.moods)    x WHERE x ILIKE '%' || t || '%') THEN 2 ELSE 0 END +
                    CASE WHEN (
                        b.title || ' ' || a.name || ' ' || COALESCE(b.publisher, '') || ' ' || COALESCE(b.year::TEXT, '') ||
                        ' ' || array_to_string(b.subjects, ' ') || ' ' || array_to_string(b.moods, ' ') ||
                        ' ' || array_to_string(b.genres, ' ') || ' ' || array_to_string(b.themes, ' ') || ' ' || COALESCE(b.blurb, '')
                    ) ILIKE '%' || t || '%' THEN 1 ELSE 0 END
                ) AS score
            ) AS scored_term
        ) AS scores
        WHERE
            (p_subjects IS NULL OR b.subjects && p_subjects)
            AND (p_moods IS NULL OR b.moods && p_moods)
            AND (p_decade IS NULL OR (b.year / 10) * 10 = p_decade)
            AND (p_author_slug IS NULL OR a.slug = p_author_slug)
            AND (p_status IS NULL OR le.status = p_status)
            AND (NOT p_in_library_only OR le.status IS NOT NULL)
    )
    SELECT
        s.book_id, s.slug, s.title, s.author_id, s.author_name, s.author_slug,
        s.year, s.publisher, s.pages, s.rating, s.subjects, s.moods, s.genres, s.themes,
        s.hue, s.blurb, s.cover_url, s.isbn13, s.language,
        s.in_library, s.library_status, s.relevance,
        COUNT(*) OVER ()::BIGINT AS total_count
    FROM scored s
    -- Every term has to hit something, not just one of them. Relevance is a sum,
    -- so `relevance > 0` let a single stray tag carry a book: "popular science
    -- books on astronomy" matched The Two Towers on the subjects "Popular
    -- Carousel" and "Science-fiction anglaise", with nothing matching astronomy.
    WHERE (p_terms IS NULL OR CARDINALITY(p_terms) = 0 OR s.matched_terms = CARDINALITY(p_terms))
    ORDER BY
        CASE WHEN p_sort = 'rating'  THEN s.rating END DESC NULLS LAST,
        CASE WHEN p_sort = 'newest'  THEN s.year   END DESC NULLS LAST,
        CASE WHEN p_sort = 'oldest'  THEN s.year   END ASC NULLS LAST,
        CASE WHEN p_sort = 'title'   THEN s.title  END ASC,
        s.relevance DESC,
        s.rating DESC NULLS LAST,
        s.book_id ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
