# Lazy DB Initialization Design

## Goal

Remove the need for `DATABASE_URL` during CI typecheck and Next.js build when no database query is executed.

## Problem

`packages/db/src/client.ts` currently creates the Drizzle client at module load time:

```ts
export const db = getDb();
```

Any import of `@ocean-find/db` immediately evaluates `getDb()`, which throws if `DATABASE_URL` is unset. This makes CI builds depend on a database secret even when the build only needs type information or module evaluation.

## Decision

Use an explicit lazy accessor function:

```ts
export function getDb() { ... }
```

The function will cache the initialized Drizzle client on first successful call and return the cached instance on subsequent calls.

All runtime consumers will switch from importing `db` to calling `getDb()` at the point of use.

## Why This Approach

This keeps initialization explicit and avoids hidden behavior.

Compared with a `Proxy`-based lazy `db` export:

- easier to read and debug
- no magic property interception
- no risk of subtle method binding behavior
- simpler type surface

## Affected Files

- `packages/db/src/client.ts`
- runtime consumers in `apps/web/src/server/**`
- `apps/scraper/src/index.ts`
- `.github/workflows/ci.yml`

## Implementation Outline

1. Replace eager `db` export with a cached `getDb()` export.
2. Keep schema exports unchanged.
3. Update all current `db` consumers to call `getDb()` locally before queries.
4. Remove `DATABASE_URL` from CI steps that no longer require it.
5. Verify typecheck, tests, and web build still pass.

## Non-Goals

- No database API redesign beyond lazy initialization.
- No changes to query logic.
- No changes to schema or migrations.

## Acceptance Criteria

- Importing `@ocean-find/db` does not throw when `DATABASE_URL` is unset.
- CI typecheck no longer requires `DATABASE_URL`.
- CI Next.js build no longer requires `DATABASE_URL` unless some runtime code path actively queries the database during build.
- Existing runtime DB usage still works unchanged apart from replacing `db` with `getDb()` at call sites.
