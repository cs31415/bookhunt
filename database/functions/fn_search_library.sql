-- Free-text search over one user's own library.
--
-- The search page routed every query through the LLM, so "Sagan" cost a 2-5s
-- round trip and only surfaced an owned book if the model happened to name it.
-- A keyword lookup over a personal shelf is a WHERE clause, not a language
-- model -- this is that WHERE clause.
--
-- Scoring is deliberately identical to fn_search_books (title x6, author x5,
-- subjects/genres/themes x3, moods x2, whole haystack x1, +4 whole-phrase
-- bonus) so the catalog, the library and import matching all rank the same
-- query the same way. Terms arrive already tokenised and lowercased by
-- tokenizeQuery, so stop words stay defined in one place.
--
-- Ownership is the INNER join on library_entries, not `status IS NOT NULL`:
-- status is nullable and a row with no status is still an owned book. Same
-- reasoning as fn_match_library_entries, which asks a batched version of this
-- question for AI search.
--
-- Returns fn_get_user_library's exact column set plus relevance, so callers --
-- and the frontend's normalizeLibraryEntry -- can treat the two interchangeably.
--
-- DROP is required because adding a column changes the RETURNS TABLE row type,
-- which CREATE OR REPLACE cannot do in place -- same reason fn_get_user_library
-- carries one.
DROP FUNCTION IF EXISTS fn_search_library(INT, TEXT[], TEXT, reading_status, TEXT, INT, INT);
CREATE OR REPLACE FUNCTION fn_search_library(
    p_user_id INT,
    p_terms   TEXT[]         DEFAULT NULL,
    p_phrase  TEXT           DEFAULT NULL,
    p_status  reading_status DEFAULT NULL,
    p_sort    TEXT           DEFAULT 'relevance',
    p_limit   INT            DEFAULT 24,
    p_offset  INT            DEFAULT 0
) RETURNS TABLE (
    user_id      INT,
    book_id      INT,
    status       reading_status,
    date_added   TIMESTAMPTZ,
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    notes        TEXT,
    user_related INT[],
    is_favorite  BOOLEAN,
    is_hidden    BOOLEAN,
    is_ebook     BOOLEAN,
    title        VARCHAR,
    book_slug    VARCHAR,
    author_name  VARCHAR,
    author_slug  VARCHAR,
    year         INT,
    pages        INT,
    rating       NUMERIC,
    subjects     TEXT[],
    moods        TEXT[],
    themes       TEXT[],
    cover_url    VARCHAR,
    hue          VARCHAR,
    relevance    NUMERIC,
    total_count  BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH scored AS (
        SELECT
            le.user_id,
            le.book_id,
            le.status,
            le.date_added,
            le.date_read,
            le.user_rating,
            le.review,
            le.notes,
            le.user_related,
            le.is_favorite,
            le.is_hidden,
            le.is_ebook,
            b.title,
            b.slug   AS book_slug,
            a.name   AS author_name,
            a.slug   AS author_slug,
            b.year,
            b.pages,
            b.rating,
            b.subjects,
            b.moods,
            b.themes,
            b.cover_url,
            b.hue,
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
        FROM library_entries le
        JOIN books   b ON b.id = le.book_id
        JOIN authors a ON a.id = b.author_id
        -- Per term rather than one SUM, so the count of terms that actually hit
        -- something is available alongside the total. Ranking needs the total;
        -- deciding whether a book qualifies at all needs the count.
        CROSS JOIN LATERAL (
            SELECT
                SUM(scored_term.score)                                  AS term_score,
                COUNT(*) FILTER (WHERE scored_term.score > 0)::INT      AS matched_terms
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
        WHERE le.user_id = p_user_id
          AND (p_status IS NULL OR le.status = p_status)
    )
    SELECT
        s.user_id, s.book_id, s.status, s.date_added, s.date_read,
        s.user_rating, s.review, s.notes, s.user_related,
        s.is_favorite, s.is_hidden, s.is_ebook,
        s.title, s.book_slug, s.author_name, s.author_slug,
        s.year, s.pages, s.rating, s.subjects, s.moods, s.themes, s.cover_url, s.hue,
        s.relevance,
        COUNT(*) OVER ()::BIGINT AS total_count
    FROM scored s
    -- Every term has to hit something, not just one of them. Relevance is a sum,
    -- so `relevance > 0` let a single stray tag carry a book: "popular science
    -- books on astronomy" returned The Two Towers on the strength of the subjects
    -- "Popular Carousel" and "Science-fiction anglaise", with nothing matching
    -- astronomy at all. Each word narrows, which is both what a search box is
    -- expected to do and what the library page's own filter already does.
    WHERE (p_terms IS NULL OR CARDINALITY(p_terms) = 0 OR s.matched_terms = CARDINALITY(p_terms))
    ORDER BY
        -- 'added' is the library's own default ordering (fn_get_user_library),
        -- and the sort a query-less browse falls back to; the rest mirror
        -- fn_search_books so both search boxes offer the same options.
        CASE WHEN p_sort = 'added'  THEN s.date_added END DESC NULLS LAST,
        CASE WHEN p_sort = 'rating' THEN s.rating     END DESC NULLS LAST,
        CASE WHEN p_sort = 'newest' THEN s.year       END DESC NULLS LAST,
        CASE WHEN p_sort = 'oldest' THEN s.year       END ASC NULLS LAST,
        CASE WHEN p_sort = 'title'  THEN s.title      END ASC,
        s.relevance DESC,
        s.rating DESC NULLS LAST,
        s.book_id ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
