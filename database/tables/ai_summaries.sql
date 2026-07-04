CREATE TABLE ai_summaries (
    book_id      INT PRIMARY KEY REFERENCES books(id),
    summary      TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);
