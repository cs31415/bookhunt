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
| POST | /register | None | `{ email, password, displayName }` | `{ user: { id, email, displayName }, token }` |
| POST | /login | None | `{ email, password }` | `{ user: { id, email, displayName }, token }` |
| POST | /forgot-password | None | `{ email }` | `{ ok: true }` (always 200) |
| POST | /reset-password | None | `{ token, password }` | `{ ok: true }` |

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
| GET | / | Required | — | `{ entries: LibraryEntryWithBook[], stats }` |
| POST | / | Required | `{ googleBooksId, status? }` | `{ entry }` — upserts book from Google Books data first, then adds to library |
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

### Upload (`/upload`)
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | /presign | Required | `{ contentType }` | `{ url, key }` |
| POST | /scan | Required | `{ imageKey }` | `{ detectedBooks: { title, author, matchedBookId? }[] }` |
