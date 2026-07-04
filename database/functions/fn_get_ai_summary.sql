-- Retrieve an AI-generated summary for a book by its ID
CREATE OR REPLACE FUNCTION fn_get_ai_summary(
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
