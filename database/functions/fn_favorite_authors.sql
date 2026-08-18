-- Favouriting authors, and reading the list back for the owner and for a
-- visitor to a public profile.

-- Idempotent; false when the slug matches no author.
CREATE OR REPLACE FUNCTION fn_add_favorite_author(
    p_user_id INT,
    p_slug    VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    target_id INT;
BEGIN
    SELECT a.id INTO target_id FROM authors a WHERE a.slug = p_slug;
    IF target_id IS NULL THEN RETURN FALSE; END IF;

    INSERT INTO user_favorite_authors (user_id, author_id)
    VALUES (p_user_id, target_id)
    ON CONFLICT DO NOTHING;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION fn_remove_favorite_author(
    p_user_id INT,
    p_slug    VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    target_id INT;
BEGIN
    SELECT a.id INTO target_id FROM authors a WHERE a.slug = p_slug;
    IF target_id IS NULL THEN RETURN FALSE; END IF;

    DELETE FROM user_favorite_authors
    WHERE user_id = p_user_id AND author_id = target_id;

    RETURN TRUE;
END;
$$;

-- The owner's own list. book_count is how many of that author's books this
-- reader owns, so the tab shows something beyond a name. is_hidden says whether
-- a visitor sees the author at all (LOS-282) -- the owner always does.
--
-- DROP is required because adding a column changes the RETURNS TABLE row type,
-- which CREATE OR REPLACE cannot do in place.
DROP FUNCTION IF EXISTS fn_get_favorite_authors(INT);
CREATE OR REPLACE FUNCTION fn_get_favorite_authors(
    p_user_id INT
)
RETURNS TABLE (name VARCHAR, slug VARCHAR, book_count BIGINT, is_hidden BOOLEAN)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT a.name, a.slug, COUNT(le.book_id), ufa.is_hidden
    FROM user_favorite_authors ufa
    JOIN authors a ON a.id = ufa.author_id
    LEFT JOIN books b ON b.author_id = a.id
    LEFT JOIN library_entries le
           ON le.book_id = b.id AND le.user_id = p_user_id
    WHERE ufa.user_id = p_user_id
    GROUP BY a.name, a.slug, ufa.is_hidden, ufa.created_at
    ORDER BY ufa.created_at DESC;
END;
$$;

-- The same list as a visitor sees it, gated on is_discoverable exactly as
-- fn_get_public_library is. Hidden entries are excluded from the count, so the
-- number agrees with what the library tab shows.
CREATE OR REPLACE FUNCTION fn_get_public_favorite_authors(
    p_handle VARCHAR
)
RETURNS TABLE (name VARCHAR, slug VARCHAR, book_count BIGINT)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT a.name, a.slug, COUNT(le.book_id)
    FROM users u
    JOIN user_favorite_authors ufa ON ufa.user_id = u.id
    JOIN authors a ON a.id = ufa.author_id
    LEFT JOIN books b ON b.author_id = a.id
    LEFT JOIN library_entries le
           ON le.book_id = b.id AND le.user_id = u.id AND NOT le.is_hidden
    WHERE LOWER(u.handle) = LOWER(p_handle)
      AND u.is_discoverable
      AND NOT ufa.is_hidden
    GROUP BY a.name, a.slug, ufa.created_at
    ORDER BY ufa.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION fn_is_favorite_author(
    p_user_id INT,
    p_slug    VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_favorite_authors ufa
        JOIN authors a ON a.id = ufa.author_id
        WHERE ufa.user_id = p_user_id AND a.slug = p_slug
    );
END;
$$;

-- Keeps a favourited author off the public page, or puts them back. Returns
-- false when the reader has not favourited that author, which is what tells the
-- route to answer 404 rather than silently doing nothing.
CREATE OR REPLACE FUNCTION fn_set_favorite_author_visibility(
    p_user_id   INT,
    p_slug      VARCHAR,
    p_is_hidden BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    target_id INT;
    updated   INT;
BEGIN
    SELECT a.id INTO target_id FROM authors a WHERE a.slug = p_slug;
    IF target_id IS NULL THEN RETURN FALSE; END IF;

    UPDATE user_favorite_authors
    SET is_hidden = p_is_hidden
    WHERE user_id = p_user_id AND author_id = target_id;

    GET DIAGNOSTICS updated = ROW_COUNT;
    RETURN updated > 0;
END;
$$;
