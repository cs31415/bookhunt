-- Return a JSON object with total count, counts by status, top subjects
-- (with counts), and top authors (with counts).
CREATE OR REPLACE FUNCTION fn_library_stats(
    p_user_id INT
) RETURNS JSON
LANGUAGE plpgsql AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total', (
            SELECT COUNT(*)
            FROM library_entries
            WHERE user_id = p_user_id
        ),
        'by_status', (
            SELECT COALESCE(json_object_agg(s.status, s.cnt), '{}')
            FROM (
                SELECT le.status, COUNT(*) AS cnt
                FROM library_entries le
                WHERE le.user_id = p_user_id
                GROUP BY le.status
            ) s
        ),
        'top_subjects', (
            SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
            FROM (
                SELECT subj AS subject, COUNT(*) AS cnt
                FROM library_entries le
                JOIN books b ON b.id = le.book_id,
                     unnest(b.subjects) AS subj
                WHERE le.user_id = p_user_id
                GROUP BY subj
                ORDER BY cnt DESC, subj ASC
                LIMIT 10
            ) t
        ),
        'top_authors', (
            SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
            FROM (
                SELECT a.name AS author, COUNT(*) AS cnt
                FROM library_entries le
                JOIN books   b ON b.id = le.book_id
                JOIN authors a ON a.id = b.author_id
                WHERE le.user_id = p_user_id
                GROUP BY a.name
                ORDER BY cnt DESC, a.name ASC
                LIMIT 10
            ) t
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;
