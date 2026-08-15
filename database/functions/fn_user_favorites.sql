-- Favouriting readers, and the mutual check that governs messaging.

-- Idempotent: favouriting twice is not an error, it is the same state.
-- Self-favouriting is refused by the CHECK on the table rather than here, so
-- it cannot be bypassed by a caller written later.
CREATE OR REPLACE FUNCTION fn_add_user_favorite(
    p_user_id INT,
    p_handle  VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    target_id INT;
BEGIN
    SELECT u.id INTO target_id FROM users u WHERE LOWER(u.handle) = LOWER(p_handle);
    IF target_id IS NULL OR target_id = p_user_id THEN
        RETURN FALSE;
    END IF;

    INSERT INTO user_favorites (user_id, favorite_user_id)
    VALUES (p_user_id, target_id)
    ON CONFLICT DO NOTHING;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION fn_remove_user_favorite(
    p_user_id INT,
    p_handle  VARCHAR
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    target_id INT;
BEGIN
    SELECT u.id INTO target_id FROM users u WHERE LOWER(u.handle) = LOWER(p_handle);
    IF target_id IS NULL THEN
        RETURN FALSE;
    END IF;

    DELETE FROM user_favorites
    WHERE user_id = p_user_id AND favorite_user_id = target_id;

    RETURN TRUE;
END;
$$;

-- Owner-only. There is deliberately no public equivalent: favourite books and
-- authors are taste and are published, but who a reader follows is a social
-- graph and stays private.
CREATE OR REPLACE FUNCTION fn_get_user_favorites(
    p_user_id INT
)
RETURNS TABLE (
    handle       VARCHAR,
    display_name VARCHAR,
    is_mutual    BOOLEAN,
    created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.handle,
        u.display_name,
        EXISTS (
            SELECT 1 FROM user_favorites back
            WHERE back.user_id = uf.favorite_user_id
              AND back.favorite_user_id = p_user_id
        ) AS is_mutual,
        uf.created_at
    FROM user_favorites uf
    JOIN users u ON u.id = uf.favorite_user_id
    WHERE uf.user_id = p_user_id
    ORDER BY uf.created_at DESC;
END;
$$;

-- True only when the pair exists in both directions. Messaging reads this, and
-- reads it in SQL rather than in a caller, so no route can forget it.
CREATE OR REPLACE FUNCTION fn_is_mutual_favorite(
    p_user_id  INT,
    p_other_id INT
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_favorites a
        WHERE a.user_id = p_user_id AND a.favorite_user_id = p_other_id
    ) AND EXISTS (
        SELECT 1 FROM user_favorites b
        WHERE b.user_id = p_other_id AND b.favorite_user_id = p_user_id
    );
END;
$$;

-- What the profile page needs about the reader looking at it.
CREATE OR REPLACE FUNCTION fn_get_favorite_state(
    p_user_id INT,
    p_handle  VARCHAR
)
RETURNS TABLE (is_favorite BOOLEAN, is_mutual BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
    target_id INT;
BEGIN
    SELECT u.id INTO target_id FROM users u WHERE LOWER(u.handle) = LOWER(p_handle);
    IF target_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        EXISTS (
            SELECT 1 FROM user_favorites uf
            WHERE uf.user_id = p_user_id AND uf.favorite_user_id = target_id
        ),
        fn_is_mutual_favorite(p_user_id, target_id);
END;
$$;
