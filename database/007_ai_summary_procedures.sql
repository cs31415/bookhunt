-- BookHunt AI summary stored procedures

BEGIN;

-- Retrieve an AI-generated summary for a book by its ID
CREATE OR REPLACE FUNCTION sp_get_ai_summary(
    p_book_id INT
)
RETURNS TABLE(summary TEXT, generated_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT ai_summaries.summary, ai_summaries.generated_at
    FROM ai_summaries
    WHERE ai_summaries.book_id = p_book_id;
END;
$$;

-- Upsert an AI-generated summary for a book
CREATE OR REPLACE FUNCTION sp_save_ai_summary(
    p_book_id  INT,
    p_summary  TEXT
)
RETURNS TABLE(book_id INT, summary TEXT, generated_at TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO ai_summaries (book_id, summary, generated_at)
    VALUES (p_book_id, p_summary, NOW())
    ON CONFLICT (book_id) DO UPDATE
        SET summary      = p_summary,
            generated_at = NOW()
    RETURNING ai_summaries.book_id, ai_summaries.summary, ai_summaries.generated_at;
END;
$$;

COMMIT;
