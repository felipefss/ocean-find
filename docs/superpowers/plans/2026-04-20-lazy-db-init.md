# Lazy DB Initialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the need for `DATABASE_URL` during CI typecheck and Next.js build by making database initialization happen only when runtime code actually performs database work.

**Architecture:** Replace the eager `db` export in `packages/db` with a cached `getDb()` accessor, then update every consumer so DB creation happens inside runtime code paths instead of at module import time. The key special case is Auth.js: its adapter must move from top-level initialization to request-time config so `next build` can import the module without needing `DATABASE_URL`.

**Tech Stack:** TypeScript, Drizzle ORM, Next.js 16, Auth.js v5, Vitest, GitHub Actions

---

### Task 1: Add a regression test for lazy DB initialization

**Files:**

- Modify: `packages/db/package.json`
- Create: `packages/db/src/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  neonCalls: [] as string[],
  drizzleCalls: 0,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn((url: string) => {
    state.neonCalls.push(url);
    return { url };
  }),
}));

vi.mock("drizzle-orm/neon-http", () => ({
  drizzle: vi.fn(() => {
    state.drizzleCalls += 1;
    return { tag: "db-instance" };
  }),
}));

describe("getDb", () => {
  beforeEach(() => {
    vi.resetModules();
    state.neonCalls = [];
    state.drizzleCalls = 0;
    delete process.env.DATABASE_URL;
  });

  it("does not throw when the module is imported without DATABASE_URL", async () => {
    await expect(import("./client")).resolves.toBeDefined();
  });

  it("throws when getDb is called without DATABASE_URL", async () => {
    const { getDb } = await import("./client");

    expect(() => getDb()).toThrow(
      "DATABASE_URL environment variable is not set",
    );
  });

  it("creates and caches the db instance on first access", async () => {
    process.env.DATABASE_URL = "postgres://example";
    const { getDb } = await import("./client");

    const first = getDb();
    const second = getDb();

    expect(first).toBe(second);
    expect(state.neonCalls).toEqual(["postgres://example"]);
    expect(state.drizzleCalls).toBe(1);
  });
});
```

- [ ] **Step 2: Enable the DB package test runner**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 3: Run the DB package test to verify it fails**

Run: `pnpm --filter @ocean-find/db exec vitest run src/client.test.ts`

Expected: FAIL because importing `./client` still evaluates `export const db = getDb()` and throws when `DATABASE_URL` is missing.

- [ ] **Step 4: Commit the failing test setup**

```bash
git add packages/db/package.json packages/db/src/client.test.ts
git commit -m "test: add lazy db initialization regression test"
```

### Task 2: Implement cached `getDb()` in the shared DB package

**Files:**

- Modify: `packages/db/src/client.ts`

- [ ] **Step 1: Replace the eager export with a cached accessor**

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const sql = neon(url);
  return drizzle(sql, { schema });
}

type Database = ReturnType<typeof createDb>;

let dbInstance: Database | undefined;

export function getDb(): Database {
  if (!dbInstance) {
    dbInstance = createDb();
  }

  return dbInstance;
}

export * from "./schema";
```

- [ ] **Step 2: Run the DB package test to verify it passes**

Run: `pnpm --filter @ocean-find/db exec vitest run src/client.test.ts`

Expected: PASS with 3 passing tests.

- [ ] **Step 3: Run DB package typecheck**

Run: `pnpm --filter @ocean-find/db build`

Expected: `tsc` exits with code 0.

- [ ] **Step 4: Commit the DB package change**

```bash
git add packages/db/src/client.ts packages/db/package.json packages/db/src/client.test.ts
git commit -m "refactor: lazily initialize shared db client"
```

### Task 3: Update runtime consumers to call `getDb()` inside runtime paths

**Files:**

- Modify: `apps/web/src/server/routers/bookmarks.ts`
- Modify: `apps/web/src/server/routers/employers.ts`
- Modify: `apps/web/src/server/routers/savedSearches.ts`
- Modify: `apps/scraper/src/index.ts`

- [ ] **Step 1: Update the web routers**

```ts
import { getDb } from "@ocean-find/db";

// inside each procedure callback
const db = getDb();
```

Apply that pattern to every query and mutation that currently uses the imported `db` singleton.

- [ ] **Step 2: Update the scraper route**

```ts
import { designatedEmployers, getDb } from "@ocean-find/db";

// inside the route handler, before the insert
const db = getDb();
```

- [ ] **Step 3: Run targeted typecheck for consumers**

Run: `pnpm --filter @ocean-find/web exec tsc --noEmit && pnpm --filter @ocean-find/scraper exec tsc --noEmit`

Expected: both commands exit with code 0.

- [ ] **Step 4: Commit the runtime consumer updates**

```bash
git add apps/web/src/server/routers/bookmarks.ts apps/web/src/server/routers/employers.ts apps/web/src/server/routers/savedSearches.ts apps/scraper/src/index.ts
git commit -m "refactor: use getDb in runtime query paths"
```

### Task 4: Make Auth.js initialize the adapter at request time

**Files:**

- Modify: `apps/web/src/server/auth.ts`

- [ ] **Step 1: Change Auth.js setup from top-level adapter construction to lazy config**

```ts
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import {
  accounts,
  getDb,
  sessions,
  users,
  verificationTokens,
} from "@ocean-find/db";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
}));
```

- [ ] **Step 2: Run a build without `DATABASE_URL`**

Run:

```bash
cd apps/web && env -u DATABASE_URL NEXTAUTH_URL=https://ocean-find.vercel.app NEXT_PUBLIC_SCRAPER_URL=http://localhost:3001 AUTH_SECRET=test-secret GITHUB_CLIENT_ID=test GITHUB_CLIENT_SECRET=test GOOGLE_CLIENT_ID=test GOOGLE_CLIENT_SECRET=test pnpm build
```

Expected: Next.js build succeeds without a `DATABASE_URL` present.

- [ ] **Step 3: Commit the Auth.js lazy init change**

```bash
git add apps/web/src/server/auth.ts
git commit -m "refactor: lazily initialize auth db adapter"
```

### Task 5: Remove `DATABASE_URL` from CI and run full verification

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Remove `DATABASE_URL` from typecheck and Next.js build env**

```yaml
- name: Typecheck
  run: |
    pnpm --filter @ocean-find/web exec tsc --noEmit
    pnpm --filter @ocean-find/scraper exec tsc --noEmit

- name: Test
  run: |
    pnpm --filter @ocean-find/db exec vitest run
    pnpm --filter @ocean-find/scraper exec vitest run
    pnpm --filter @ocean-find/web exec vitest run

- name: Build Next.js
  run: pnpm --filter @ocean-find/web build
  env:
    AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
    NEXTAUTH_URL: https://ocean-find.vercel.app
    GITHUB_CLIENT_ID: ${{ secrets.GITHUB_CLIENT_ID }}
    GITHUB_CLIENT_SECRET: ${{ secrets.GITHUB_CLIENT_SECRET }}
    GOOGLE_CLIENT_ID: ${{ secrets.GOOGLE_CLIENT_ID }}
    GOOGLE_CLIENT_SECRET: ${{ secrets.GOOGLE_CLIENT_SECRET }}
    NEXT_PUBLIC_SCRAPER_URL: ${{ secrets.NEXT_PUBLIC_SCRAPER_URL }}
```

- [ ] **Step 2: Run full local verification**

Run:

```bash
pnpm biome check .
pnpm --filter @ocean-find/db exec vitest run
pnpm --filter @ocean-find/web exec vitest run
pnpm --filter @ocean-find/scraper exec vitest run
pnpm --filter @ocean-find/db build
pnpm --filter @ocean-find/web exec tsc --noEmit
pnpm --filter @ocean-find/scraper exec tsc --noEmit
cd apps/web && env -u DATABASE_URL NEXTAUTH_URL=https://ocean-find.vercel.app NEXT_PUBLIC_SCRAPER_URL=http://localhost:3001 AUTH_SECRET=test-secret GITHUB_CLIENT_ID=test GITHUB_CLIENT_SECRET=test GOOGLE_CLIENT_ID=test GOOGLE_CLIENT_SECRET=test pnpm build
```

Expected:

- Biome reports 0 errors
- All Vitest suites pass
- All TypeScript checks pass
- Next.js build passes without `DATABASE_URL`

- [ ] **Step 3: Commit the CI update**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: stop requiring database url for build and typecheck"
```
