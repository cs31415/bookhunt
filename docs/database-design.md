# BookHunt — Database Design

## Tables

### `users`
Registered app users. Stores credentials, profile info, and password-reset state.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | Auto-incrementing unique identifier |
| email | VARCHAR(255) UNIQUE NOT NULL | Login email; used for auth and password reset |
| password_hash | VARCHAR(255) NOT NULL | bcrypt-hashed password |
| display_name | VARCHAR(255) NOT NULL | Public name shown in the UI |
| preferences | JSONB DEFAULT '{}' | User settings (e.g. accent color, dark mode, fonts) |
| is_discoverable | BOOLEAN DEFAULT FALSE | Whether this user's library is visible to others |
| reset_token | VARCHAR(255) UNIQUE | nullable; one-time token for password reset flow |
| reset_token_expires_at | TIMESTAMPTZ | nullable; expiry time for the reset token |
| created_at | TIMESTAMPTZ DEFAULT NOW() | Account creation timestamp |

### `authors`
Book authors. Upserted automatically when books are imported from Google Books.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | Auto-incrementing unique identifier |
| slug | VARCHAR(255) UNIQUE NOT NULL | URL-safe identifier derived from name; used in routes (`/author/:slug`) |
| name | VARCHAR(255) NOT NULL | Full display name of the author |
| birth_year | INT | nullable; supports ancient dates (e.g. Marcus Aurelius = 121) |
| country | VARCHAR(255) | nullable; country of origin or primary residence |
| bio | TEXT | nullable; short biographical blurb |

### `books`
Central book catalog. Books are created on-demand when a user adds a Google Books result to their library. AI-generated metadata (genres, themes) is populated lazily.

| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | Auto-incrementing unique identifier |
| slug | VARCHAR(255) UNIQUE NOT NULL | URL-safe identifier derived from title; used in routes (`/book/:slug`) |
| title | VARCHAR(500) NOT NULL | Full book title |
| author_id | INT NOT NULL REFERENCES authors(id) | Foreign key to the book's author |
| year | INT | nullable; original publication year |
| publisher | VARCHAR(500) | nullable; publisher name from Google Books |
| pages | INT | nullable; page count, also used to estimate reading time (pages × 1.4 min) |
| rating | NUMERIC(3,1) | nullable; average rating from Google Books (0.0–5.0) |
| subjects | TEXT[] DEFAULT '{}' | Topic categories from Google Books (e.g. {"Evolution","Biology","Science"}) |
| moods | TEXT[] DEFAULT '{}' | Reader mood/feel tags (e.g. {"Mind-expanding","Rigorous"}) |
| genres | TEXT[] DEFAULT '{}' | AI-generated micro-genre tags (e.g. "Popular Science","Paradigm-Shifter") |
| themes | TEXT[] DEFAULT '{}' | AI-generated deeper thematic tags (e.g. "altruism & selfishness","units of selection") |
| hue | VARCHAR(7) DEFAULT '#6f7a55' | Hex color used as background for the procedural SVG cover |
| blurb | TEXT DEFAULT '' | Short description/synopsis of the book |
| cover_url | VARCHAR(1000) | nullable; external cover image URL from Google Books |
| google_books_id | VARCHAR(255) | nullable; Google Books volume ID for deduplication and linking |
| openlibrary_id | VARCHAR(255) | nullable; OpenLibrary edition ID (e.g. `OL7170815M`) for deduplication and linking, used when a book has no `google_books_id` |
| source | VARCHAR(20) | nullable; which API the book was originally sourced from (`google_books` or `open_library`) |
| isbn13 | VARCHAR(20) | nullable; ISBN-13 identifier |
| language | VARCHAR(50) DEFAULT 'English' | Language with optional translation note (e.g. "English · trans. Russian") |
| related | INT[] DEFAULT '{}' | IDs of hand-curated related books (editorial picks, not AI-generated) |

Indexes:
- `CREATE INDEX idx_books_author_id ON books(author_id);`
- `CREATE UNIQUE INDEX idx_books_google_books_id ON books(google_books_id);`
- `CREATE UNIQUE INDEX idx_books_openlibrary_id ON books(openlibrary_id);`

### `library_entries`
Per-user bookshelf. Each row represents a book in a user's personal library, with reading status, rating, notes, and user-curated related books. Composite primary key on (user_id, book_id).

| Column | Type | Notes |
|--------|------|-------|
| user_id | INT REFERENCES users(id) ON DELETE CASCADE | The user who owns this library entry; cascades on user deletion |
| book_id | INT REFERENCES books(id) | The book in the user's library; must exist in `books` table first |
| status | reading_status DEFAULT 'queued' | Current reading status (queued, reading, finished, abandoned) |
| date_added | TIMESTAMPTZ DEFAULT NOW() | When the book was added to the user's library |
| date_read | TIMESTAMPTZ | nullable; when the user finished reading the book |
| user_rating | INT | nullable; user's personal rating (1–5 stars) |
| review | TEXT | nullable; user's written review of the book |
| notes | TEXT | nullable; private freeform notes (auto-saving in the UI) |
| user_related | INT[] DEFAULT '{}' | Book IDs the user has manually linked as related reads |
| PRIMARY KEY (user_id, book_id) | | Composite key; a user can have each book only once |

Indexes:
- `CREATE INDEX idx_library_user_id ON library_entries(user_id);`
- `CREATE INDEX idx_library_book_id ON library_entries(book_id);`

### `ai_summaries`
Cache for AI-generated book summaries. One summary per book, regenerated on demand. Avoids redundant Claude API calls.

| Column | Type | Notes |
|--------|------|-------|
| book_id | INT PRIMARY KEY REFERENCES books(id) | The book this summary belongs to; one-to-one with `books` |
| summary | TEXT NOT NULL | AI-generated multi-paragraph summary of the book |
| generated_at | TIMESTAMPTZ DEFAULT NOW() | When the summary was last generated or regenerated |

## Enum

```sql
CREATE TYPE reading_status AS ENUM ('queued', 'reading', 'finished', 'abandoned');
```

## Functions

### Auth
- `fn_register_user(p_email, p_password_hash, p_display_name)` → `users` row
- `fn_find_user_by_email(p_email)` → `users` row or NULL
- `fn_set_reset_token(p_email, p_token, p_expires_at)` → BOOLEAN
- `fn_reset_password(p_token, p_new_hash)` → BOOLEAN (validates token not expired, clears it)

### Books & Authors
- `fn_upsert_book_from_google(p_google_books_id, p_slug, p_title, p_author_name, p_year, p_publisher, p_pages, p_rating, p_subjects, p_blurb, p_cover_url, p_isbn13, p_language, p_hue)` → creates book + author if not exists, returns book row. Author is upserted by name (slug derived from name).
- `fn_get_all_books(p_limit, p_offset)` → books + author name, sorted by rating DESC, title ASC
- `fn_get_book_by_slug(p_slug)` → book + author row
- `fn_get_book_by_google_id(p_google_books_id)` → book row or NULL (to check if already imported)
- `fn_get_author_by_slug(p_slug)` → author row
- `fn_get_books_by_author(p_author_id, p_exclude_book_id, p_limit)` → books by that author
- `fn_search_books(p_query, p_subjects, p_moods, p_decade, p_sort)` → scored results against locally stored books (title +6, author +5, subject +3, genre +3, theme +3, mood +2, blurb +1)
- `fn_get_related_books(p_book_id, p_limit)` → explicit related + subject-overlap fallback
- `fn_update_book_ai_metadata(p_book_id, p_genres, p_themes)` → store AI-generated genres and themes

### Library
- `fn_get_user_library(p_user_id)` → all library entries with book + author data
- `fn_add_to_library(p_user_id, p_book_id, p_status)` → upsert library entry (book must exist in books table first — call `fn_upsert_book_from_google` before this for Google Books results)
- `fn_update_library_entry(p_user_id, p_book_id, p_status, p_user_rating, p_notes, p_review)` → updated row
- `fn_remove_from_library(p_user_id, p_book_id)` → BOOLEAN
- `fn_library_stats(p_user_id)` → counts by status, top subjects, top authors
- `fn_add_user_related(p_user_id, p_book_id, p_related_book_id)` → updated user_related array
- `fn_remove_user_related(p_user_id, p_book_id, p_related_book_id)` → updated user_related array

### Recommendations
- `fn_recommendations(p_user_id, p_limit)` → scored unread books based on subject/author overlap with user's engaged books (finished weight = userRating or 3, reading/queued weight = 2)

### AI Summaries
- `fn_get_ai_summary(p_book_id)` → cached summary or NULL
- `fn_save_ai_summary(p_book_id, p_summary)` → upsert

## No Seed Script
The app starts completely empty. All books enter the system through Google Books search or photo import. When a user adds a book to their library, it is created in the `books` and `authors` tables from Google Books data if it doesn't already exist. AI generates themes, genres, and summaries lazily with caching.
