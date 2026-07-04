-- Returns personalized book recommendations for a user based on their library.
-- Scores candidate books by subject affinity, author affinity, and catalog
-- rating. Falls back to highest-rated books for users with no library entries.
CREATE OR REPLACE FUNCTION sp_recommendations(
    p_user_id INT,
    p_limit   INT DEFAULT 6
)
RETURNS TABLE (
    book_id     INT,
    slug        VARCHAR,
    title       VARCHAR,
    author_name VARCHAR,
    author_slug VARCHAR,
    year        INT,
    rating      NUMERIC,
    cover_url   VARCHAR,
    hue         VARCHAR,
    subjects    TEXT[],
    score       NUMERIC,
    reason      TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_has_engaged BOOLEAN;
BEGIN
    -- Check whether the user has any engaged books (finished, reading, queued).
    SELECT EXISTS (
        SELECT 1
        FROM library_entries le
        WHERE le.user_id = p_user_id
          AND le.status IN ('finished', 'reading', 'queued')
    ) INTO v_has_engaged;

    -- Cold start: no engaged books -- return highest-rated catalog books.
    IF NOT v_has_engaged THEN
        RETURN QUERY
        SELECT
            b.id              AS book_id,
            b.slug::VARCHAR,
            b.title::VARCHAR,
            a.name::VARCHAR   AS author_name,
            a.slug::VARCHAR   AS author_slug,
            b.year,
            b.rating,
            b.cover_url::VARCHAR,
            b.hue::VARCHAR,
            b.subjects,
            COALESCE(b.rating, 0)::NUMERIC AS score,
            'Highly rated in the catalog'::TEXT AS reason
        FROM books b
        JOIN authors a ON a.id = b.author_id
        WHERE NOT EXISTS (
            SELECT 1 FROM library_entries le
            WHERE le.user_id = p_user_id AND le.book_id = b.id
        )
        ORDER BY b.rating DESC NULLS LAST
        LIMIT p_limit;

        RETURN;
    END IF;

    -- Personalized recommendations for users with engaged books.
    RETURN QUERY
    WITH engaged AS (
        -- Engaged books with computed weights.
        SELECT
            le.book_id,
            b.author_id,
            b.subjects AS book_subjects,
            CASE
                WHEN le.status = 'finished' THEN
                    CASE WHEN COALESCE(le.user_rating, 0) = 0 THEN 3
                         ELSE le.user_rating
                    END
                ELSE 2  -- reading or queued
            END AS weight
        FROM library_entries le
        JOIN books b ON b.id = le.book_id
        WHERE le.user_id = p_user_id
          AND le.status IN ('finished', 'reading', 'queued')
    ),

    subject_weights AS (
        -- Aggregate weight per subject across all engaged books.
        SELECT
            s.subject,
            SUM(e.weight)::NUMERIC AS sw
        FROM engaged e,
             LATERAL unnest(e.book_subjects) AS s(subject)
        GROUP BY s.subject
    ),

    author_weights AS (
        -- Aggregate weight per author across all engaged books.
        SELECT
            e.author_id,
            SUM(e.weight)::NUMERIC AS aw
        FROM engaged e
        GROUP BY e.author_id
    ),

    candidates AS (
        -- Score every book NOT already in the user's library.
        SELECT
            b.id AS book_id,
            b.slug,
            b.title,
            a.name  AS author_name,
            a.slug  AS author_slug,
            b.year,
            b.rating,
            b.cover_url,
            b.hue,
            b.subjects,
            b.author_id,
            -- Subject affinity: sum of subject weights for matching subjects.
            COALESCE((
                SELECT SUM(sw.sw)
                FROM subject_weights sw
                WHERE sw.subject = ANY(b.subjects)
            ), 0)
            -- Author affinity: author weight * 2 if same author.
            + COALESCE((
                SELECT aw.aw * 2
                FROM author_weights aw
                WHERE aw.author_id = b.author_id
            ), 0)
            -- Catalog rating bonus.
            + COALESCE(b.rating, 0) AS total_score,
            -- Top matching subject (by weight) for reason generation.
            (
                SELECT sw.subject
                FROM subject_weights sw
                WHERE sw.subject = ANY(b.subjects)
                ORDER BY sw.sw DESC
                LIMIT 1
            ) AS top_subject
        FROM books b
        JOIN authors a ON a.id = b.author_id
        WHERE NOT EXISTS (
            SELECT 1 FROM library_entries le
            WHERE le.user_id = p_user_id AND le.book_id = b.id
        )
    )

    SELECT
        c.book_id,
        c.slug::VARCHAR,
        c.title::VARCHAR,
        c.author_name::VARCHAR,
        c.author_slug::VARCHAR,
        c.year,
        c.rating,
        c.cover_url::VARCHAR,
        c.hue::VARCHAR,
        c.subjects,
        c.total_score::NUMERIC AS score,
        (CASE
            WHEN EXISTS (
                SELECT 1 FROM author_weights aw WHERE aw.author_id = c.author_id
            )
            THEN 'More from ' || SPLIT_PART(c.author_name, ' ', CARDINALITY(STRING_TO_ARRAY(c.author_name, ' ')))
            WHEN c.top_subject IS NOT NULL
            THEN 'Because you read ' || LOWER(c.top_subject)
            ELSE 'A strong match'
        END)::TEXT AS reason
    FROM candidates c
    ORDER BY c.total_score DESC, c.rating DESC NULLS LAST
    LIMIT p_limit;
END;
$$;
