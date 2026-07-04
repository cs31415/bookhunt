CREATE TABLE books (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    title           VARCHAR(500) NOT NULL,
    author_id       INT NOT NULL REFERENCES authors(id),
    year            INT,
    publisher       VARCHAR(500),
    pages           INT,
    rating          NUMERIC(3,1),
    subjects        TEXT[] DEFAULT '{}',
    moods           TEXT[] DEFAULT '{}',
    genres          TEXT[] DEFAULT '{}',
    themes          TEXT[] DEFAULT '{}',
    hue             VARCHAR(7) DEFAULT '#6f7a55',
    blurb           TEXT DEFAULT '',
    cover_url       VARCHAR(1000),
    google_books_id VARCHAR(255),
    isbn13          VARCHAR(20),
    language        VARCHAR(50) DEFAULT 'English',
    related         INT[] DEFAULT '{}'
);

CREATE INDEX idx_books_author_id ON books(author_id);
CREATE UNIQUE INDEX idx_books_google_books_id ON books(google_books_id);
