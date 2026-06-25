-- BookHunt schema: enum, tables, and indexes

BEGIN;

-- reading status enum
CREATE TYPE reading_status AS ENUM ('queued', 'reading', 'finished', 'abandoned');

-- users
CREATE TABLE users (
    id                    SERIAL PRIMARY KEY,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    display_name          VARCHAR(255) NOT NULL,
    preferences           JSONB DEFAULT '{}',
    is_discoverable       BOOLEAN DEFAULT FALSE,
    reset_token           VARCHAR(255) UNIQUE,
    reset_token_expires_at TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- authors
CREATE TABLE authors (
    id         SERIAL PRIMARY KEY,
    slug       VARCHAR(255) UNIQUE NOT NULL,
    name       VARCHAR(255) NOT NULL,
    birth_year INT,
    country    VARCHAR(255),
    bio        TEXT
);

-- books
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

-- library entries
CREATE TABLE library_entries (
    user_id      INT REFERENCES users(id) ON DELETE CASCADE,
    book_id      INT REFERENCES books(id),
    status       reading_status DEFAULT 'queued',
    date_added   TIMESTAMPTZ DEFAULT NOW(),
    date_read    TIMESTAMPTZ,
    user_rating  INT,
    review       TEXT,
    notes        TEXT,
    user_related INT[] DEFAULT '{}',
    PRIMARY KEY (user_id, book_id)
);

CREATE INDEX idx_library_user_id ON library_entries(user_id);
CREATE INDEX idx_library_book_id ON library_entries(book_id);

-- ai summaries
CREATE TABLE ai_summaries (
    book_id      INT PRIMARY KEY REFERENCES books(id),
    summary      TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
