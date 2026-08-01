-- The theme tags already in use across the catalog, most-used first.
--
-- Fed back into the theme-generation prompt so the model reuses existing tags
-- instead of coining a fresh phrase per book. Without it themes fragment --
-- 'Socio-political evolution' and 'Sociopolitical evolution' end up as two
-- themes -- and a theme shared by no other book cannot function as a filter.
--
-- Count-descending order carries two meanings: it is the slice worth showing
-- the model when p_limit truncates, and it makes the first match the canonical
-- spelling when foldThemes maps a variant onto an existing tag.
CREATE OR REPLACE FUNCTION fn_theme_vocabulary(
    p_limit INT DEFAULT 150
) RETURNS TABLE (
    theme TEXT,
    cnt   BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT th AS theme, COUNT(*)::BIGINT AS cnt
    FROM books b,
         unnest(b.themes) AS th
    GROUP BY th
    ORDER BY cnt DESC, th ASC
    LIMIT p_limit;
END;
$$;
