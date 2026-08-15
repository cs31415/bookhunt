-- Private messaging. The mutual-favourite rule is enforced here, in SQL, so no
-- route written later can send a message around it.

-- Returns the stored row, or nothing at all when the pair is not mutual. The
-- controller reads no rows as 403: it cannot send, and no row was written.
CREATE OR REPLACE FUNCTION fn_send_message(
    p_sender_id INT,
    p_handle    VARCHAR,
    p_body      TEXT
)
RETURNS TABLE (
    id           INT,
    sender_id    INT,
    recipient_id INT,
    body         TEXT,
    created_at   TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
DECLARE
    target_id INT;
BEGIN
    SELECT u.id INTO target_id FROM users u WHERE LOWER(u.handle) = LOWER(p_handle);
    IF target_id IS NULL OR target_id = p_sender_id THEN
        RETURN;
    END IF;

    -- The whole permission model, in one line. Un-favouriting either way stops
    -- delivery immediately, which is what makes it a block.
    IF NOT fn_is_mutual_favorite(p_sender_id, target_id) THEN
        RETURN;
    END IF;

    RETURN QUERY
    INSERT INTO messages (sender_id, recipient_id, body)
    VALUES (p_sender_id, target_id, p_body)
    RETURNING messages.id, messages.sender_id, messages.recipient_id,
              messages.body, messages.created_at;
END;
$$;

-- One row per counterpart: the latest message either way, and how many of
-- theirs are unread.
CREATE OR REPLACE FUNCTION fn_get_conversations(
    p_user_id INT
)
RETURNS TABLE (
    handle        VARCHAR,
    display_name  VARCHAR,
    last_body     TEXT,
    last_at       TIMESTAMPTZ,
    last_from_me  BOOLEAN,
    unread_count  BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH threads AS (
        SELECT
            CASE WHEN m.sender_id = p_user_id THEN m.recipient_id ELSE m.sender_id END AS other_id,
            m.body,
            m.created_at,
            m.sender_id = p_user_id AS from_me,
            -- Unread counts only what they sent to us; our own are never unread.
            (m.recipient_id = p_user_id AND m.read_at IS NULL) AS unread
        FROM messages m
        WHERE m.sender_id = p_user_id OR m.recipient_id = p_user_id
    ),
    latest AS (
        SELECT DISTINCT ON (t.other_id)
            t.other_id, t.body, t.created_at, t.from_me
        FROM threads t
        ORDER BY t.other_id, t.created_at DESC
    )
    SELECT
        u.handle,
        u.display_name,
        l.body,
        l.created_at,
        l.from_me,
        (SELECT COUNT(*) FROM threads t2 WHERE t2.other_id = l.other_id AND t2.unread)
    FROM latest l
    JOIN users u ON u.id = l.other_id
    ORDER BY l.created_at DESC;
END;
$$;

-- One thread, oldest first, so the newest sits at the bottom where a reader
-- expects it.
CREATE OR REPLACE FUNCTION fn_get_conversation(
    p_user_id INT,
    p_handle  VARCHAR,
    p_limit   INT DEFAULT 50,
    p_offset  INT DEFAULT 0
)
RETURNS TABLE (
    id          INT,
    body        TEXT,
    created_at  TIMESTAMPTZ,
    from_me     BOOLEAN,
    total_count BIGINT
)
LANGUAGE plpgsql AS $$
DECLARE
    other_id INT;
BEGIN
    SELECT u.id INTO other_id FROM users u WHERE LOWER(u.handle) = LOWER(p_handle);
    IF other_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT m.id, m.body, m.created_at,
           m.sender_id = p_user_id AS from_me,
           COUNT(*) OVER ()::BIGINT
    FROM messages m
    WHERE (m.sender_id = p_user_id AND m.recipient_id = other_id)
       OR (m.sender_id = other_id AND m.recipient_id = p_user_id)
    ORDER BY m.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Marks what they sent us as read. Never touches our own messages, which have
-- no meaningful read state from this side.
CREATE OR REPLACE FUNCTION fn_mark_conversation_read(
    p_user_id INT,
    p_handle  VARCHAR
) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    other_id INT;
    marked   BIGINT;
BEGIN
    SELECT u.id INTO other_id FROM users u WHERE LOWER(u.handle) = LOWER(p_handle);
    IF other_id IS NULL THEN
        RETURN 0;
    END IF;

    WITH updated AS (
        UPDATE messages m
        SET read_at = NOW()
        WHERE m.recipient_id = p_user_id
          AND m.sender_id = other_id
          AND m.read_at IS NULL
        RETURNING 1
    )
    SELECT COUNT(*) INTO marked FROM updated;

    RETURN marked;
END;
$$;

CREATE OR REPLACE FUNCTION fn_unread_message_count(
    p_user_id INT
) RETURNS BIGINT
LANGUAGE plpgsql AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) FROM messages m
        WHERE m.recipient_id = p_user_id AND m.read_at IS NULL
    );
END;
$$;
