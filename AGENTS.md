# AGENTS.md — Ocean Find

> Atlantic Canada Job Search App
> Read this file before writing any code. It is the authoritative guide for this codebase.

---

## What This App Does

A job search app specialized in jobs in the 4 Atlantic Canadian provinces (NB, NS, PE, NL).
Users search by job title and province(s). The app scrapes multiple job boards in parallel,
filters results to Atlantic Canada, then cross-references against a "Designated Employers"
list stored in the database. Results stream to the browser in real time via SSE.

---

## Architecture

Two deployable services in a pnpm monorepo:

| Service          | Tech                               | Host               |
| ---------------- | ---------------------------------- | ------------------ |
| `apps/web`       | Next.js 15 + App Router + tRPC v11 | Vercel             |
| `apps/scraper`   | Express + Playwright (Docker)      | Render (free tier) |
| `packages/db`    | Drizzle ORM + Neon PostgreSQL      | shared             |
| `packages/types` | Shared TypeScript types            | internal           |

**Key architecture decision**: The browser connects directly to the Render SSE endpoint
for streaming. Nothing is proxied through Vercel. This bypasses Vercel's 10s function limit.

---

## Monorepo Structure

```
ocean-find/
├── apps/
│   ├── web/                    # Next.js 15 app (Vercel)
│   │   ├── src/app/            # App Router pages
│   │   ├── src/components/     # React components
│   │   ├── src/lib/trpc/       # tRPC client setup
│   │   └── src/server/         # tRPC routers, Auth.js config
│   └── scraper/                # Express + Playwright (Render)
│       ├── src/scrapers/       # One file per job board
│       ├── src/parsers/        # Employer list parsers
│       ├── src/lib/            # Province detection, employer filter
│       └── Dockerfile
├── packages/
│   ├── db/                     # Drizzle schema + Neon client
│   │   ├── src/schema.ts       # All table definitions
│   │   └── src/client.ts       # Neon + Drizzle init
│   └── types/                  # Job, Province, Employer interfaces
├── .github/
│   └── workflows/
│       ├── ci.yml              # PR gate: biome + vitest + build
│       └── deploy.yml          # Manual deploy trigger
├── biome.json                  # Root Biome config (replaces ESLint + Prettier)
├── .husky/                     # pre-commit: biome check --apply
├── package.json                # pnpm workspace root
└── pnpm-workspace.yaml
```

---

## Technologies

| Purpose          | Tool                                                               |
| ---------------- | ------------------------------------------------------------------ |
| Framework        | Next.js 15 (App Router)                                            |
| API layer        | tRPC v11                                                           |
| Database         | Neon PostgreSQL (serverless)                                       |
| ORM              | Drizzle ORM                                                        |
| Auth             | Auth.js v5 (NextAuth) — GitHub + Google OAuth                      |
| Styling          | Tailwind CSS v4                                                    |
| UI components    | shadcn/ui                                                          |
| Linter/formatter | Biome (replaces ESLint + Prettier)                                 |
| Pre-commit       | Husky + lint-staged                                                |
| Scraping         | Playwright + playwright-extra-plugin-stealth                       |
| Job API          | Adzuna (free tier, Canadian endpoint — primary Indeed replacement) |
| Fuzzy matching   | fuse.js (employer name matching)                                   |
| PDF parsing      | pdf-parse                                                          |
| HTML parsing     | cheerio                                                            |
| Testing          | Vitest                                                             |
| CI/CD            | GitHub Actions                                                     |

---

## Environment Variables

Create `.env.local` in `apps/web` and `.env` in `apps/scraper`. Both share `AUTH_SECRET`.

```
# Shared
AUTH_SECRET=                        # Random 32-char secret (shared between web + scraper)
DATABASE_URL=                       # Neon PostgreSQL connection string

# apps/web only
NEXTAUTH_URL=                       # e.g. https://ocean-find.vercel.app
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_SCRAPER_URL=            # Render service URL e.g. https://ocean-find-scraper.onrender.com

# apps/scraper only
ADZUNA_APP_ID=                      # From developer.adzuna.com
ADZUNA_APP_KEY=
```

---

## Database Schema (`packages/db/src/schema.ts`)

Auth.js tables (managed by `@auth/drizzle-adapter`):

- `users` — id, name, email, emailVerified, image
- `accounts` — OAuth provider accounts
- `sessions` — active sessions
- `verificationTokens`

App tables:

- `designated_employers` — id, name, province (`NB` | `NS` | `PE` | `NL`), createdAt, updatedAt
- `bookmarks` — id, userId (FK), jobData (JSONB), createdAt
- `saved_searches` — id, userId (FK), name, query (text), provinces (text[]), results (JSONB), createdAt

---

## Shared Types (`packages/types/src/index.ts`)

```typescript
export type Province = "NB" | "NS" | "PE" | "NL";

export interface Job {
  id: string; // scraper-generated UUID
  title: string;
  company: string;
  location: string;
  province: Province | null;
  url: string;
  source: string; // e.g. "jobbank", "adzuna", "careerbeacon"
  postedAt?: string;
}

export interface ScraperEvent {
  type: "batch" | "done" | "error";
  source?: string;
  jobs?: Job[];
  message?: string;
}
```

---

## Job Scrapers (`apps/scraper/src/scrapers/`)

One file per source. All implement this interface:

```typescript
interface Scraper {
  name: string;
  scrape(query: string, provinces: Province[]): Promise<Job[]>;
}
```

### Sources

| Source                                | Method               | Notes                                                     |
| ------------------------------------- | -------------------- | --------------------------------------------------------- |
| Indeed (indeed.ca)                    | Playwright + stealth | likely blocked; fails gracefully                          |
| Adzuna                                | REST API             | Free tier, Canadian endpoint — primary Indeed replacement |
| Job Bank (jobbank.gc.ca)              | Playwright           | Atlantic-focused; check for public API first              |
| NB Jobs (nbjobs.ca)                   | Playwright + stealth |                                                           |
| Nova Scotia Jobs (jobs.novascotia.ca) | Playwright + stealth |                                                           |
| NL Job Bank (nl.jobbank.gc.ca)        | Playwright + stealth |                                                           |
| Career Beacon (careerbeacon.com)      | Playwright + stealth |                                                           |
| Canada Jobs (canadajobs.com)          | Playwright + stealth |                                                           |
| RemoteHub                             | Playwright + stealth | filter `?locations=CA`                                    |
| Workopolis                            | Playwright + stealth |                                                           |
| Simply Hired (simplyhired.ca)         | Playwright + stealth |                                                           |
| Talent Egg (talentegg.ca)             | Playwright + stealth |                                                           |
| Monster (monster.ca)                  | Playwright + stealth | likely blocked; fails gracefully                          |

Rules:

- Each scraper has a **15-second timeout** (abort and return partial results)
- Return empty array on failure — **never throw** — log the error
- Use `playwright-extra` + `puppeteer-extra-plugin-stealth` for all Playwright scrapers
- Province detection runs on each `job.location` after scraping

### Province Detection

Detect Atlantic provinces from a location string. Look for:

- Full names: `"New Brunswick"`, `"Nova Scotia"`, `"Prince Edward Island"`, `"Newfoundland and Labrador"`
- Abbreviations: `"NB"`, `"NS"`, `"PE"`, `"PEI"`, `"NL"`
- City-to-province mapping for common Atlantic cities (Moncton→NB, Halifax→NS, Charlottetown→PE, St. John's→NL)

---

## SSE Streaming Endpoint (`apps/scraper`)

`GET /api/search?query=<string>&provinces=<comma-separated>&token=<jwt>`

- Validates the NextAuth JWT using the shared `AUTH_SECRET`
- Runs all scrapers in parallel (`Promise.allSettled`)
- As each scraper resolves, immediately emits an SSE event:
  ```
  data: {"type":"batch","source":"jobbank","jobs":[...]}
  data: {"type":"batch","source":"adzuna","jobs":[...]}
  data: {"type":"done"}
  ```
- Filters jobs: (1) province match against selected provinces, (2) employer name must fuzzy-match
  a record in the `designated_employers` table
- Employer list is loaded from DB at request start and cached in memory for 5 minutes (fuse.js index)

---

## Employer Loading (`apps/scraper/src/parsers/`)

`POST /api/employers/load` — requires valid JWT in the `Authorization: Bearer <token>` header

Parsers (one per province):

| Province      | Source URL                                                                                                                    | Method                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| PEI           | https://www.princeedwardisland.ca/en/information/office-of-immigration/atlantic-immigration-program-designated-employers      | cheerio — parse `<ul>` list items                                                                                                            |
| Nova Scotia   | https://liveinnovascotia.com/sites/default/files/2024-07/Designated_AIP_employers.pdf                                         | axios + pdf-parse                                                                                                                            |
| New Brunswick | https://www2.gnb.ca/content/dam/gnb/Corporate/Promo/Immigration/designated-employers-employeurs-designes.pdf                  | axios + pdf-parse                                                                                                                            |
| NL            | https://www.gov.nl.ca/immigration/immigrating-to-newfoundland-and-labrador/atlantic-immigration-program/designated-employers/ | Inspect network tab for paginated raw URL first; if found use direct fetch + cheerio. Otherwise use Playwright to walk all pagination pages. |

Each parser returns `string[]` of employer names. The endpoint upserts all records to
`designated_employers` and streams progress in the HTTP response body using SSE-formatted events.
Because this is a mutating `POST` request and requires an `Authorization` header, the browser
client must consume it with `fetch` streaming rather than native `EventSource`.

```
data: {"province":"PEI","status":"loading"}
data: {"province":"PEI","status":"done","count":142}
data: {"province":"NS","status":"loading"}
...
data: {"type":"done","total":892}
```

---

## Frontend (`apps/web`)

### Pages

- `/` — Search page (main)
- `/bookmarks` — Saved bookmarked jobs

### Key Components

**SearchBar** — text input + province multi-select + search button

- Province selector: checkboxes or toggle group for NB, NS, PE, NL + "All"
- Search button disabled when `designated_employers` count = 0; show instruction banner instead
- "Saved Searches" button next to search bar — opens dropdown listing saved search names

**JobCard** — title, company, salary (if available), location badge, source badge, "View" external link, bookmark toggle

**ResultsList** — renders JobCards as they stream in; groups or labels by source

**`useStreamingSearch()` hook**

- Connects to `NEXT_PUBLIC_SCRAPER_URL/api/search?...` via `EventSource`
- Appends jobs to local state as SSE batch events arrive
- Exposes: `jobs`, `isLoading`, `isDone`, `error`, `start(query, provinces)`

**EmployerLoader** — "Load / Update Employers" button in header/settings area

- If no employers in DB: shows prominent banner with step-by-step instructions
- On click: opens modal, sends `POST /api/employers/load` with `Authorization: Bearer <token>`, reads the streamed response with `fetch`, and shows per-province status with counts

**SavedSearchesDropdown** — dropdown near search bar listing all saved search names

- Clicking a name restores the saved JSONB results snapshot (no re-search)
- Each item has an inline delete button

### tRPC Routers (`apps/web/src/server/routers/`)

```typescript
bookmarks.add(jobData: Job)       // save job to bookmarks
bookmarks.list()                  // list user's bookmarks
bookmarks.remove(id: string)      // delete a bookmark

savedSearches.save({ name, query, provinces, results })
savedSearches.list()
savedSearches.delete(id: string)

employers.count() → number        // used to gate the search button
```

---

## Render Cold Start Mitigation

On app load, send a fire-and-forget ping to `NEXT_PUBLIC_SCRAPER_URL/health`.
The scraper exposes `GET /health → 200 OK`.

Implement as a `useEffect` in the root layout client component. This wakes the Render
container in the background (~30s cold start) before the user hits search.

---

## Testing

Use **Vitest** in both `apps/web` and `apps/scraper`.

### What to test

- `packages/db` — Drizzle schema shape assertions (no live DB calls needed)
- `apps/scraper/src/lib/province-detection` — unit tests for all province name/abbreviation/city variants
- `apps/scraper/src/lib/employer-filter` — unit tests for fuse.js fuzzy matching edge cases (legal suffix stripping, accents, abbreviations)
- `apps/scraper/src/parsers/` — unit tests with mocked HTTP responses (saved HTML/PDF fixtures in `__fixtures__/`)
- `apps/scraper/src/scrapers/` — integration tests with mocked Playwright browser
- `apps/web/src/server/routers/` — tRPC router tests with mocked Drizzle DB calls

### What not to test (yet)

- E2E browser tests
- Live scraper calls against real websites

---

## CI/CD (`.github/workflows/`)

### `ci.yml` — runs on every PR targeting `main`

```yaml
steps:
  - pnpm install
  - pnpm biome check # lint + format — fail on any error
  - pnpm tsc --noEmit # TypeScript check (all packages)
  - pnpm vitest run # all unit + integration tests
  - pnpm --filter web build # Next.js production build
```

**Merging to `main` is blocked until all steps pass.**

### `deploy.yml` — manual trigger only (`workflow_dispatch`)

Triggered via GitHub UI "Run workflow" button. Steps:

1. Deploy `apps/web` to Vercel via Vercel CLI
2. Trigger Render deploy hook for `apps/scraper` (Docker image rebuild + deploy)

---

## Pre-commit Hook

Husky + lint-staged. On every `git commit`, runs:

```
biome check --apply --no-errors-on-unmatched
```

on all staged `.ts`, `.tsx`, `.js`, `.json` files. Commit is blocked if Biome reports
errors it cannot auto-fix.

---

## Biome Configuration (`biome.json` at repo root)

- Replaces ESLint + Prettier entirely
- Enable formatter + linter for JS/TS
- Ignore: `.next/`, `node_modules/`, `dist/`, `drizzle/` (generated migration files), `.husky/`

---

## Implementation Phases

### Phase 1 — Project Setup

1. Init pnpm monorepo; scaffold `apps/web` (Next.js 15) and `apps/scraper` (Express + TypeScript)
2. Create `packages/db` (Drizzle schema + Neon client) and `packages/types`
3. Configure Biome at repo root; wire into all `package.json` scripts
4. Configure Husky + lint-staged (depends on step 1)
5. Configure Tailwind CSS v4 + shadcn/ui in `apps/web`
6. Set up tRPC v11 in `apps/web` (`httpBatchLink` for mutations/queries)
7. Set up Auth.js v5 in `apps/web` (GitHub + Google OAuth, Drizzle adapter)
8. Write full Drizzle schema; run initial migration against Neon; generate types
9. Set up Vitest in `apps/web` and `apps/scraper`
10. Create Dockerfile for `apps/scraper` (base: `mcr.microsoft.com/playwright:...-noble`)
11. Create `.env.example` with all required variable names (no values)

### Phase 2 — Employer Loading (scraper service)

1. PEI parser (cheerio)
2. NS parser (axios + pdf-parse)
3. NB parser (axios + pdf-parse)
4. NL parser (network inspection first, then cheerio or Playwright fallback)
5. `POST /api/employers/load` streamed progress endpoint; JWT auth middleware
6. Unit tests for all 4 parsers with fixture files

### Phase 3 — Job Scrapers (scraper service)

1. All 12 scrapers implementing the shared `Scraper` interface
2. Province detection utility + comprehensive unit tests
3. Employer fuzzy-match filter (fuse.js) + unit tests
4. `GET /api/search` SSE endpoint with JWT auth middleware
5. 5-minute fuse.js index cache

### Phase 4 — Frontend: Search & Results (parallel with Phase 3)

1. Province selector component
2. Search input + search button with disabled/instruction state
3. `useStreamingSearch()` hook (EventSource client)
4. JobCard component
5. ResultsList with live streaming updates
6. Saved searches dropdown
7. Wake-up ping on app load (`GET /health`)

### Phase 5 — Bookmarks & Saved Searches

1. tRPC routes: `bookmarks.*` and `savedSearches.*`
2. Bookmark toggle on JobCard (optimistic UI)
3. `/bookmarks` page
4. Save search modal (name input → tRPC mutation)
5. Load saved search from dropdown (restores JSONB snapshot)

### Phase 6 — Employer Loading UI

1. "Load / Update Employers" button in header
2. No-employers banner on search page (disables search button, shows instructions)
3. Progress modal consuming streamed `fetch` response from `POST /api/employers/load`

### Phase 7 — CI/CD

1. `ci.yml` — PR gate workflow
2. `deploy.yml` — manual deploy workflow
