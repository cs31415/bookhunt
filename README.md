# BookHunt

Personal book explorer app — search, curate a library, get AI-powered summaries and recommendations.

## Tech Stack

- **API**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (stored procedures, no ORM)
- **AI**: LLM APIs (Anthropic/OpenAI/Google, configurable per model) for summaries and themes
- **Search**: Google Books API
- **Auth**: JWT + bcrypt

## Project Structure

```
src/
  routes/             Slim wiring (Swagger docs + middleware + controller refs)
  controllers/        HTTP handling (req/res parsing, status codes)
  models/             Orchestration (coordinates data + external APIs)
  data/               Database access (pool.query wrappers)
  lib/                Shared clients (db, LLM adapters, book providers)
  middleware/         Auth + rate limiting
database/              PostgreSQL schema (tables/ and functions/) with setup scripts
docs/                  API design, database design, implementation plan
scripts/               Dev utility scripts
assets/                Static prototype/design files
```

## Database Setup

```bash
psql -d <your_database> -f database/setup_tables.sql
psql -d <your_database> -f database/setup_functions.sql
```

Each table and function lives in its own file under `database/tables/` and `database/functions/`. The setup scripts include them in dependency order.

Those two scripts build an empty database. They create what is missing but never
alter what is already there, so a database that predates a column needs the
matching script in `database/alter/`, oldest first. The API checks this at boot
and exits rather than serving 500s from half its routes; `SKIP_SCHEMA_CHECK=true`
overrides it.

Deploying schema to production is a fixed order — migrate, then ship — and one of
the steps is a data backfill rather than SQL. The runbook lives with the rest of
the operational docs, in
[bookhunt-deploy](https://github.com/cs31415/bookhunt-deploy#deploying-a-change).

## Setup

```bash
cp .env.example .env
# Fill in your credentials in .env
npm install
npm run dev
```

## Scripts

Dev utility scripts live in `scripts/`. They read config from `scripts/.env`.

```bash
cd scripts
cp .env.example .env
# Fill in your credentials in .env
```

| Script | Description |
|---|---|
| `test-create-user.js` | Creates a test user via the API |
| `wipe-user.js` | Deletes a user and all associated data |

Run with `node scripts/<script>.js` from the repo root.

## Testing

```bash
npm test              # run all tests once
npm run test:watch    # re-run on file changes
```

Tests live in `src/tests/` mirroring the source structure:

| Suite | Coverage |
|---|---|
| `middleware/auth` | `authRequired`, `authOptional` — valid token, missing/invalid header |
| `controllers/auth` | `login`, `register`, `forgot-password` — happy path, error cases |
| `controllers/library` | `get-library` |
| `controllers/ai` | `search` — validation, sorting, `inLibraryOnly`, unauthenticated |
| `models/library` | `get-library`, `add-to-library` |
| `models/ai` | `search` — Google Books mapping, limit clamping, library matching |
| `data/auth-data` | All four functions — stored procedure args |
| `data/library-data` | All six functions — stored procedure args |

## API Docs

Swagger UI is available at `/api/docs` when the server is running.
