# BookHunt — Implementation Plan

## Context

BookHunt is a personal book explorer app being rebuilt as a brand-new stack: a **Node.js + Express API** (separate repo) and a **Vite + React Router frontend** (separate repo). A fully-realized static prototype lives in `/assets/` with 5 connected views, a warm literary design system, working Google Books + AI integrations, and a light/dark mode toggle.

### Architecture Decisions
- **Data layer**: PostgreSQL with stored procedures (no ORM)
- **API**: Node.js + Express, TypeScript, raw `pg` driver
- **Auth**: JWT + bcrypt (stateless tokens)
- **Frontend**: Vite + React Router, TypeScript (separate repo)
- **Integrations**: Claude API (AI), Google Books API, Cloudflare R2 (uploads), Resend (email)

---

## M1 — Database Design

See [database-design.md](database-design.md) for full schema: tables, columns, indexes, enums, and stored procedures.

---

## M2 — API Design

See [api-design.md](api-design.md) for full API spec: project setup, middleware, and all endpoints.

---

## M3 — Discover (Home) Page

**Route**: `/` (default)

### Sections (top to bottom)
1. **Hero** — large search bar with example query pills ("books for an intelligent layman on evolution", etc.). Submits to Search view.
2. **Currently Reading** — grid of books with `status=reading`. Shows cover, title, author, and note preview (italic). Cards navigate to Book Detail.
3. **Recommended For You** — 4 BookCards from `GET /api/recommendations`. Each shows a `reason` eyebrow ("More from Dawkins", "Because you read evolution"). "See more" button goes to Search with recs mode.
4. **Library Snapshot** — card with total book count, descriptive text, pie chart by status (clickable slices → Library filtered by status), and CTA button ("Open library" when populated, "Add your first book" when empty). Empty state: dashed circle placeholder with "Your reading breakdown appears here".
5. **Footer** — logo, "BookHunt" wordmark, "a personal reading companion" tagline, meta text

### Components
- `SearchBar` (big mode, with example pills)
- `BookCard` (reusable grid card with cover, title, author, rating, status badge)
- `PieChart` (SVG, interactive slices, hover highlight, click handler)
- `SectionHead` (eyebrow + title + optional action)
- `Cover` (procedural SVG cover or real image for Google Books results)

### API Calls
- `GET /api/library` (extract reading books)
- `GET /api/recommendations?limit=4`

---

## M4 — Search Page

**Route**: `/search?q=...`

### Layout
- **Search bar** at top (pre-filled from query param or hero)
- **Two-column**: filter sidebar (232px sticky) + results grid

### Filter Sidebar
- **In my library only** toggle (switch)
- **Category** — pills from all subjects in catalog (clickable filter)
- **Mood** — pills from all moods (clickable filter)
- **Status** — Finished, Reading, Queued, Abandoned pills
- **Century** — derived from book years (e.g. "1800s", "1900s")
- **Clear filters** button when any active

### Sort Options
- Relevance (default), Highest rated, Newest, Oldest, Title A-Z

### Results Area
- Result count + sort dropdown
- **AI interpretation badge** — when AI search was used, show AI badge with interpretation text
- **Catalog results** — BookCard grid (auto-fill, minmax 108px)
- **Google Books section** — separated by heading "More from Google Books" with count. Deduplicated against catalog results by normalized title. Google Books results are first-class: each opens a full detail page.
- **Pagination** — page controls when results exceed 60 per page (prev/next + numbered pills with ellipsis)
- **Loading skeleton** — 6 shimmer placeholders during search
- **Empty state** — "No books match" with suggestion to broaden query

### Entry Points
- Hero search bar on Discover
- Top bar search (all pages except Home)
- Theme pill tap on Book Detail → `/search?q=<theme>&theme=true`
- Mood pill tap on Book Detail → `/search?mood=<mood>`

### API Calls
- `GET /api/search?q=...&subjects=...&moods=...&decade=...&sort=...`
- `GET /api/search/google?q=...&limit=16` (parallel)
- `POST /api/ai/search` (when AI mode)

---

## M5 — Book Detail Page

**Route**: `/book/:slug`

### Hero Section (two-column: 144px cover + content)
**Left column:**
- Procedural Cover (144px) or real image for Google Books, with +/− corner button for quick add/remove from library
- ActionMenu dropdown (Queued / Reading / Finished / Abandoned status selector)
- "View on Google Books" external link

**Right column:**
- Title (large, responsive clamp 30–46px), author link (rust colored, clickable → Author page)
- **Two rating rows**: Average rating (stars + numeric + count) | My rating (interactive stars, "Rate it" prompt)
- Meta line: year · pages · estimated reading time (pages × 1.4 min)
- Blurb paragraph
- **Themes section**: "Themes" eyebrow label. Merged AI-generated genres + themes, deduplicated. Each is a clickable pill → Search. Loading skeleton while AI generates.
- **Mood pills**: clickable → `/search?mood=<mood>`

### Specifications Card
Grid of spec cells: Category (clickable subject pills), Publisher, Language, ISBN-13

### Tabbed Content (Summary | My Notes | Reader Reviews)
**Summary tab:**
- Loading skeleton with spinner ("Writing a summary…")
- 3-paragraph AI summary or fallback to blurb with "try Regenerate" hint

**My Notes tab:**
- Your rating (interactive stars)
- Character count + "saved" indicator
- Textarea for freeform notes
- Note: saving a note auto-adds book to library

**Reader Reviews tab:**
- Deterministic reviews generated from book properties
- Each: avatar, username, timeframe, star rating, review text

### Sidebar (300px)
- "More by [Author surname]" — BookRow list (compact: 52px cover + title + author + status badge)
- If no other books: author bio card linking to Author page

### Related Reads Section (below tabs)
- "Related reads" section heading
- Explanatory text for non-library books: "Add this book to your library to curate its related reads"
- User-curated related + algorithm-suggested related, combined
- Library-aware: in-library books get full color + rust border + sort first; others are dimmed (grayscale, 45% opacity) with + button
- RelatedCard: cover with +/- corner buttons, "Added by you" vs "Suggested" eyebrow, status badge or rating
- RelatedPicker: search input to find catalog books, list with + to add

### API Calls
- `GET /api/books/:slug` (book + author + library status)
- `GET /api/ai/summary/:bookId`
- `POST /api/ai/themes/:bookId`
- `GET /api/books/by-author/:authorId?exclude=:bookId`
- `GET /api/library/:bookId/related` (user-curated related)

---

## M6 — Author Page

**Route**: `/author/:slug`

### Layout
- **Hero** (two-column: 120px round portrait placeholder + content)
  - Meta line: country · birth year (CE suffix for ancient authors)
  - Name (large title)
  - Bio paragraph
  - Book count ("X books in the catalog" or "X books on Google Books" for external)
- **Bibliography** — BookCard grid of all books by this author
- For external (Google Books) authors: meta line shows "Author · Google Books", live fetch of their titles via `GET /api/search/google?q=inauthor:"Name"`, "Finding titles…" loading state

### API Calls
- `GET /api/authors/:slug`

---

## M7 — Library Page

**Route**: `/library`

### Empty State
- Centered content: bookshelf icon, "Your shelves are empty" heading, description, "Discover books" + "Add from a photo" buttons

### Populated State
**Header:** eyebrow "Your library", title "N books", "Add from a photo" button

**Stats Charts** (3-column grid):
- **By Status** — PieChart with status colors (sage=finished, rust=reading, slate=queued, muted=abandoned). Clickable slices filter shelf.
- **By Subject** — PieChart of top 7 subjects. Clickable.
- **By Author** — PieChart of top 7 authors. Clickable.

**Status Tabs** (pill bar):
- All (N), Finished (N), Reading (N), Queued (N), Abandoned (N)
- Active chart filter shown as dismissible pill: "subject: Evolution ×"
- Books sorted by date added (newest first)

**Book Grid:**
- BookCard grid (auto-fill, minmax 102px) with status badges
- Pagination controls when shelf exceeds 60 books (prev/next + numbered pills)

### ScanModal (Photo Import)
Three phases:
1. **Upload** — drop zone with camera icon, "Drop a photo of your bookshelf", file input
2. **Scanning** — image preview with animated scanline, "Reading spines…" overlay
3. **Results** — detected books list with cover, title, author. Each has status cycle button (queued → reading → finished) and toggle checkbox. "Add N to library" confirmation.

### API Calls
- `GET /api/library`
- `POST /api/upload/presign`
- `POST /api/upload/scan`

---

## M8 — Shared Components & Design System

### Design Tokens (from `styles.css`)
- **Default font**: Special Elite (one-font mode — same font for headings, body, and covers)
- **Fallback fonts**: Spectral (serif), Work Sans (sans), IBM Plex Mono (mono/eyebrows)
- **Colors**: paper/ink warm palette, rust/sage/slate/gold/plum accents, 8-color chart palette
- **Radii**: sm(4), md(8), lg(14, default), xl(22)
- **Shadows**: 3 levels
- **User Preferences** (persisted in `users.preferences` JSONB):
  - Light / dark mode toggle (light is default; dark mode uses the dark paper-tone palette from the prototype)

### Reusable Components
- `Cover` — procedural SVG book cover (author surname, title wrapped, year, hue background) OR real image with fallback
- `Stars` — 5-star rating (display + interactive modes, half-star support)
- `StatusBadge` — colored dot + label pill
- `BookCard` — grid card (cover, title, author, year, rating, status badge overlay, optional reason eyebrow)
- `BookRow` — compact horizontal row (52px cover, title, author, status/rating)
- `PieChart` — SVG pie with hover highlight, slice click, legend
- `SectionHead` — eyebrow + title + optional action slot
- `SearchBar` — pill-shaped search input with submit button (big + small variants)
- `ActionMenu` — status dropdown (queued/reading/finished/abandoned)
- `RelatedCard` — cover with +/− corner buttons, library-aware styling (grayscale/dimmed for non-library), "Added by you" vs "Suggested" eyebrow
- `RelatedPicker` — search input to find catalog books to link as related

### Responsive Breakpoints
- **≤860px** (tablet): filter rail un-sticks and stacks above results; book detail hero/body collapse to single column
- **≤640px** (phone): tighter gutters (18px), hide top nav items (show MobileNav bottom bar instead), header search goes full-width, author portrait shrinks to 92px
- **≤430px** (small phone): hide header wordmark, tightest gutters (14px)

### Navigation
- **TopBar** (sticky, rust-colored): back button, logo + "BookHunt" wordmark, nav items (Discover/Search/Library), search field (hidden on Home), user avatar
- **MobileNav** (phones only, ≤640px): fixed bottom tab bar with Discover/Search/Library icons + labels, backdrop blur
- **Footer**: logo, "BookHunt" wordmark, "a personal reading companion" tagline, meta text
- **Stack-based routing**: every link pushes a view, Back button pops

---

## M9 — Google Books Integration

Live integration directly from the frontend (keyless, CORS-enabled):
- `googleSearch(query, limit)` — search volumes, map to app's book shape (default 12 results)
- `googleByAuthor(name, limit)` — author-specific search via `inauthor:` query (default 12 results)
- Volume mapping: normalize to app book format with deterministic hue (8-color palette), external flag, HTTPS cover image URL, ratings count, language mapping, ISBN extraction
- Client-side cache in localStorage (`bx_gb_cache_v1`) for books + authors — persisted on each fetch
- Rate-limit handling: 429 → "Search results currently unavailable" notice with retry guidance
- Google Books results are first-class citizens: full detail pages, author pages with live title fetch, can be added to library
- External authors get auto-generated bio text and `external: true` flag

---

## Verification

After each milestone:
1. API milestones (M1-M2): run migration, verify schema with `psql`, test each stored procedure, run API endpoint tests
2. Frontend milestones: start Vite dev server, exercise the golden path:
   - Discover → search → book detail → author → back
   - Add a book → library → change status → remove
   - Click theme pill → search pre-filled → navigate
   - Click pie chart slice → library filtered
3. Cross-cutting: verify Google Books search returns results, AI features fall back gracefully when unavailable
