# BookHunt — API Design

## Project Setup
- TypeScript + Express
- `pg` driver with connection pool
- JWT middleware (jsonwebtoken + bcryptjs)
- CORS configured for frontend origin
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLAUDE_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `R2_*` credentials

## Middleware
- `authRequired` — validates JWT, attaches `req.user = { id, email }`
- `authOptional` — same but allows unauthenticated requests (sets `req.user = null`)
- `rateLimiter(windowMs, max)` — for AI endpoints

## Endpoints

All routers are mounted under `/api` (e.g. `app.use('/api', router)`). Paths below are relative to that prefix.

### Auth (`/auth`)
| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | /register | None | `{ email, password, displayName, handle }` | 201 `{ user: { id, email, displayName, handle }, verificationRequired: true }` — no session token; 409 if the address is taken (case-insensitively) or 409 `{ code: 'HANDLE_TAKEN', field: 'handle' }` if the handle is, 400 on a malformed field |
| POST | /login | None | `{ email, password }` | `{ user: { id, email, displayName, handle }, token }` — 401 on bad credentials, 403 `{ code: 'EMAIL_NOT_VERIFIED' }` until the address is confirmed |
| POST | /verify-email | None | `{ token }` | `{ user: { id, email, displayName, handle }, token }` — signs the reader in; 400 if unknown, expired or already used |
| POST | /resend-verification | None | `{ email }` | `{ ok: true }` (always 200) |
| POST | /forgot-password | None | `{ email }` | `{ ok: true }` (always 200) |
| POST | /reset-password | None | `{ token, password }` | `{ ok: true }` |

Registration is gated on email verification: an account is created unverified,
emailed a link good for 24 hours, and refused at sign-in until it is used.
Passwords are a minimum of 8 characters. Every `/auth` route is rate limited.

A handle is 3-30 characters, starts with a letter, then letters, numbers and
underscores, and is folded to lowercase on the way in. It becomes the public
profile URL at the bare root path, so reserved words -- every current and
foreseeable top-level route -- are refused. The list lives in
`src/lib/validate/reserved-handles.ts` and a new top-level route has to be added
there before it ships.

### Users (`/users`)
| Method | Path | Auth | Params/Body | Response |
|--------|------|------|-------------|----------|
| PUT | /me | Bearer | `{ displayName?, handle?, isDiscoverable?, preferences? }` | `{ user: { id, email, displayName, handle, isDiscoverable } }`. An absent field is left alone; `isDiscoverable` is the master switch for the public profile and is off by default. 400 names the offending `field`; 409 `{ code: 'HANDLE_TAKEN' }` matches registration |
| GET | /search | None | `?q=` | `{ users: [{ handle, displayName, bookCount }] }`, up to 10, exact handle prefixes first. Only readers with a public page are findable |
| GET | /favorites | Bearer | — | `{ users: [{ handle, displayName, isMutual }] }`. Owner-only, no public equivalent |
| POST/DELETE | /:handle/favorite | Bearer | — | `{ ok: true }`; 404 for an unknown handle or your own. Idempotent. A mutual pair is what permits messaging, so removing one is how you block someone |
| GET | /:handle | None | — | `{ profile: { handle, displayName, joinedAt, counts } }`. 404 for an unknown handle **and** for one whose page is private — deliberately indistinguishable |
| GET | /:handle/library | None | `?status=&favorites=&page=&limit=` | `{ entries, total, page, pageSize }`. Hidden books never appear, and rows carry no notes or reviews: those are absent from the stored function's row type rather than filtered out |
| GET | /handle-available | None | `?handle=` | `{ handle, available, reason }` where `handle` is the normalized form and `reason` is null when it can be claimed. Advisory only -- `/auth/register` is the authority and answers 409. Rate limited to 30/min |

### Messages (`/messages`)
Every route requires Bearer auth. Both readers must have favourited each other; un-favouriting either way stops delivery, which is how blocking works.

| Method | Path | Request | Response |
|--------|------|---------|----------|
| GET | / | — | `{ conversations: [{ handle, displayName, lastMessage, unreadCount }] }`, newest first |
| GET | /unread-count | — | `{ count }`. Polled by the header badge, so it stays cheap |
| GET | /:handle | `?page=` | `{ messages, total, page, pageSize }`, oldest first |
| POST | /:handle | `{ body }` | 201 `{ message }`; 400 empty or over 2000 chars; 403 `{ code: 'NOT_MUTUAL_FAVORITE' }`; 422 `{ code: 'MESSAGE_REJECTED' }` |
| POST | /:handle/read | — | `{ marked }` — clears only what they sent |

The two failure codes are deliberately distinct: one is fixed by favouriting someone back, the other by editing the words.

### Books (`/books`)
| Method | Path | Auth | Params/Body | Response |
|--------|------|------|-------------|----------|
| GET | /:slug | Optional | — | `{ book: BookWithAuthor, inLibrary: boolean, libraryEntry? }` |

### Authors (`/authors`)
| Method | Path | Auth | Params | Response |
|--------|------|------|--------|----------|
| GET | /:slug | None | — | `{ author, books: Book[] }` |

### Search (`/search`)
| Method | Path | Auth | Params | Response |
|--------|------|------|--------|----------|
| GET | / | Optional | `?q&subjects[]&moods[]&decade&authorSlug&status&inLibraryOnly&sort(relevance\|rating\|newest\|oldest\|title)&page&limit` | `{ books: CatalogSearchResult[], total, page, pageSize, query }` — catalog-only text/facet search via `fn_search_books`; `status`/`inLibraryOnly` are honored only when authenticated. Each result includes `in_library`/`library_status`. |

External (Google Books/OpenLibrary) search is a separate concern — see `POST /ai/search` below. There is no `/search/google` route.

### Library (`/library`)
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | / | Required | `?page&limit` | `{ entries: LibraryEntryWithBook[], stats, total, page, pageSize }` |
| POST | / | Required | `{ googleBooksId, status? }` | `{ entry }` — upserts book from Google Books data first, then adds to library |
| PUT/DELETE | /:bookId/favorite | Bearer | — | `{ entry: { user_id, book_id, is_favorite, is_hidden } }` — PUT marks, DELETE unmarks; 404 if the book is not owned |
| PUT/DELETE | /:bookId/hidden | Bearer | — | Same shape. PUT hides the book from the public profile, DELETE shows it again. The owner's own library is unaffected either way |
| PUT | /:bookId | Required | `{ status?, userRating?, notes?, review? }` | `{ entry }` |
| DELETE | /:bookId | Required | — | `{ ok: true }` |
| POST | /:bookId/related | Required | `{ relatedBookId }` | `{ userRelated: int[] }` |
| DELETE | /:bookId/related/:relatedBookId | Required | — | `{ userRelated: int[] }` |

### AI (`/ai`)
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | /summary/:bookId | None | — | `{ bookId, summary, generatedAt }` |
| POST | /summary/:bookId | None | — | `{ bookId, summary, generatedAt }` (regenerate) |
| POST | /themes/:bookId | None | — | `{ genres: string[], themes: string[] }` |
| POST | /search | Optional | `{ query, catalogContext }` | `{ ids: string[], interpretation }` |

### Recommendations (`/recommendations`)
| Method | Path | Auth | Params | Response |
|--------|------|------|--------|----------|
| GET | / | Required | `?limit&excludeId` | `{ recommendations: { book, reason }[] }` |

