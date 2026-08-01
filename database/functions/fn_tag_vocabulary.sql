-- The tags of one kind already in use across the catalog, most-used first.
--
-- Fed back into every prompt that generates tags, so the model reuses existing
-- values instead of coining a fresh phrase per book. Without it tags fragment --
-- 'Socio-political evolution' and 'Sociopolitical evolution' end up as two
-- themes -- and a tag shared by no other book cannot function as a filter.
--
-- Count-descending order carries two meanings: it is the slice worth showing
-- the model when p_limit truncates, and it makes the first match the canonical
-- spelling when foldThemes maps a variant onto an existing tag.
--
-- Replaces fn_theme_vocabulary. Themes were only the first kind to need this;
-- categories fragmented just as badly -- 94 distinct genres across the library
-- with 10 of them on more than one book.
DROP FUNCTION IF EXISTS fn_theme_vocabulary(INT);

CREATE OR REPLACE FUNCTION fn_tag_vocabulary(
    p_kind  TEXT,
    p_limit INT DEFAULT 150
) RETURNS TABLE (
    tag TEXT,
    cnt BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    -- A CASE over the three columns rather than dynamic SQL on a column name:
    -- the set of taggable columns is fixed and small, so this keeps an unknown
    -- kind a clean error instead of an injection surface.
    IF p_kind NOT IN ('subjects', 'themes', 'moods') THEN
        RAISE EXCEPTION 'fn_tag_vocabulary: unknown kind %', p_kind;
    END IF;

    RETURN QUERY
    SELECT t AS tag, COUNT(*)::BIGINT AS cnt
    FROM books b,
         unnest(
             CASE p_kind
                 WHEN 'subjects' THEN b.subjects
                 WHEN 'themes'   THEN b.themes
                 WHEN 'moods'    THEN b.moods
             END
         ) AS t
    GROUP BY t
    ORDER BY cnt DESC, t ASC
    LIMIT p_limit;
END;
$$;
