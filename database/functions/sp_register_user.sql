-- Register a new user; lets the UNIQUE constraint on email raise on duplicates
CREATE OR REPLACE FUNCTION sp_register_user(
    p_email        VARCHAR,
    p_password_hash VARCHAR,
    p_display_name  VARCHAR
)
RETURNS TABLE(id INT, email VARCHAR, display_name VARCHAR, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO users (email, password_hash, display_name)
    VALUES (p_email, p_password_hash, p_display_name)
    RETURNING users.id, users.email, users.display_name, users.created_at;
END;
$$;
