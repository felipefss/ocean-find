# Phase 3 Search Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the scraper service search pipeline for Atlantic Canada jobs: province detection, employer filtering, source scrapers, and the streamed `GET /api/search` SSE endpoint.

**Architecture:** Add pure search utilities under `apps/scraper/src/lib`, add one scraper module per source behind a shared `Scraper` interface, and move `/api/search` behavior into testable search orchestration helpers before wiring the Express route. Employer matching will load designated employers from Drizzle on demand and cache the Fuse index for five minutes. This plan assumes the explicit named source list in `AGENTS.md` is authoritative even though the phase text says "12 scrapers".

**Tech Stack:** TypeScript, Express 5, Playwright, Fuse.js, Vitest, Drizzle ORM, jose, axios

---

### Task 1: Add province detection utility with full unit coverage

**Files:**

- Create: `apps/scraper/src/lib/province-detection.ts`
- Create: `apps/scraper/src/__tests__/lib/province-detection.test.ts`

- [ ] **Step 1: Write the failing province detection tests**

```ts
import { describe, expect, it } from "vitest";
import { detectAtlanticProvince } from "../../lib/province-detection.js";

describe("detectAtlanticProvince", () => {
  it("matches full province names", () => {
    expect(detectAtlanticProvince("Saint John, New Brunswick")).toBe("NB");
    expect(detectAtlanticProvince("Halifax, Nova Scotia")).toBe("NS");
    expect(detectAtlanticProvince("Charlottetown, Prince Edward Island")).toBe("PE");
    expect(detectAtlanticProvince("Corner Brook, Newfoundland and Labrador")).toBe("NL");
  });

  it("matches province abbreviations", () => {
    expect(detectAtlanticProvince("Moncton, NB")).toBe("NB");
    expect(detectAtlanticProvince("Sydney, NS")).toBe("NS");
    expect(detectAtlanticProvince("Summerside, PEI")).toBe("PE");
    expect(detectAtlanticProvince("St. John's, NL")).toBe("NL");
  });

  it("maps known Atlantic cities when the province is missing", () => {
    expect(detectAtlanticProvince("Fredericton")).toBe("NB");
    expect(detectAtlanticProvince("Dartmouth")).toBe("NS");
    expect(detectAtlanticProvince("Charlottetown")).toBe("PE");
    expect(detectAtlanticProvince("Mount Pearl")).toBe("NL");
  });

  it("returns null for non-Atlantic locations", () => {
    expect(detectAtlanticProvince("Toronto, ON")).toBeNull();
    expect(detectAtlanticProvince("Remote - Canada")).toBeNull();
    expect(detectAtlanticProvince("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/lib/province-detection.test.ts`

Expected: FAIL with `Cannot find module '../../lib/province-detection.js'`.

- [ ] **Step 3: Implement the minimal province detector**

```ts
import type { Province } from "@ocean-find/types";

const provinceMatchers: Array<[Province, RegExp[]]> = [
  ["NB", [/\bnew brunswick\b/i, /\bnb\b/i]],
  ["NS", [/\bnova scotia\b/i, /\bns\b/i]],
  ["PE", [/\bprince edward island\b/i, /\bpei?\b/i]],
  ["NL", [/\bnewfoundland and labrador\b/i, /\bnl\b/i]],
];

const cityMatchers: Array<[Province, RegExp]> = [
  ["NB", /\b(moncton|fredericton|saint john|dieppe|bathurst)\b/i],
  ["NS", /\b(halifax|dartmouth|sydney|truro|new glasgow)\b/i],
  ["PE", /\b(charlottetown|summerside|stratford|cornwall)\b/i],
  ["NL", /\b(st\.?( john'?s)?|corner brook|mount pearl|gander)\b/i],
];

export function detectAtlanticProvince(location: string): Province | null {
  const value = location.trim();
  if (!value) return null;

  for (const [province, matchers] of provinceMatchers) {
    if (matchers.some((matcher) => matcher.test(value))) {
      return province;
    }
  }

  for (const [province, matcher] of cityMatchers) {
    if (matcher.test(value)) {
      return province;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run the targeted test to verify GREEN**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/lib/province-detection.test.ts`

Expected: PASS with 4 passing tests.

### Task 2: Add employer normalization and Fuse-based filtering

**Files:**

- Create: `apps/scraper/src/lib/employer-filter.ts`
- Create: `apps/scraper/src/__tests__/lib/employer-filter.test.ts`

- [ ] **Step 1: Write the failing employer filter tests**

```ts
import { describe, expect, it } from "vitest";
import { buildEmployerMatcher, normalizeEmployerName } from "../../lib/employer-filter.js";

describe("normalizeEmployerName", () => {
  it("strips punctuation and legal suffixes", () => {
    expect(normalizeEmployerName("Acme Holdings Inc.")).toBe("acme holdings");
    expect(normalizeEmployerName("Maritime Foods Ltd")).toBe("maritime foods");
  });

  it("normalizes accents and ampersands", () => {
    expect(normalizeEmployerName("Café & Mer Ltée")).toBe("cafe and mer");
  });
});

describe("buildEmployerMatcher", () => {
  const matcher = buildEmployerMatcher([
    { id: "1", name: "Acme Holdings Inc.", province: "NB" },
    { id: "2", name: "Cafe and Mer", province: "NS" },
  ]);

  it("matches normalized exact names", () => {
    expect(matcher.matches("Acme Holdings", "NB")).toBe(true);
  });

  it("matches accent and punctuation variants", () => {
    expect(matcher.matches("Café & Mer Ltée", "NS")).toBe(true);
  });

  it("does not match the wrong province", () => {
    expect(matcher.matches("Acme Holdings", "NS")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/lib/employer-filter.test.ts`

Expected: FAIL with `Cannot find module '../../lib/employer-filter.js'`.

- [ ] **Step 3: Implement normalization and fuzzy matching**

```ts
import Fuse from "fuse.js";
import type { Province } from "@ocean-find/types";

type EmployerRow = {
  id: string;
  name: string;
  province: Province;
};

const suffixPattern = /\b(inc|incorporated|corp|corporation|ltd|limited|llc|ltee|ltee\.|ltée)\b/gi;

export function normalizeEmployerName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(suffixPattern, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildEmployerMatcher(rows: EmployerRow[]) {
  const normalized = rows.map((row) => ({
    ...row,
    normalizedName: normalizeEmployerName(row.name),
  }));

  const fuse = new Fuse(normalized, {
    includeScore: true,
    threshold: 0.2,
    keys: ["normalizedName"],
  });

  return {
    matches(company: string, province: Province | null) {
      if (!province) return false;

      const normalizedCompany = normalizeEmployerName(company);
      return fuse
        .search(normalizedCompany)
        .some((result) => result.item.province === province && (result.score ?? 1) <= 0.2);
    },
  };
}
```

- [ ] **Step 4: Run the targeted test to verify GREEN**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/lib/employer-filter.test.ts`

Expected: PASS with 5 passing tests.

### Task 3: Extract search auth and employer cache helpers

**Files:**

- Modify: `apps/scraper/src/middleware/auth.ts`
- Create: `apps/scraper/src/lib/employer-cache.ts`
- Create: `apps/scraper/src/__tests__/lib/employer-cache.test.ts`

- [ ] **Step 1: Write the failing employer cache tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { createEmployerCache } from "../../lib/employer-cache.js";

describe("createEmployerCache", () => {
  it("reuses the cached matcher inside the ttl window", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1", name: "Acme", province: "NB" }]);

    const cache = createEmployerCache({ ttlMs: 300_000, loadEmployers: loader });

    const first = await cache.getMatcher();
    const second = await cache.getMatcher();

    expect(first).toBe(second);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reloads once the ttl expires", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1", name: "Acme", province: "NB" }])
      .mockResolvedValueOnce([{ id: "2", name: "Bravo", province: "NS" }]);

    const cache = createEmployerCache({ ttlMs: 1, loadEmployers: loader });

    await cache.getMatcher();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await cache.getMatcher();

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/lib/employer-cache.test.ts`

Expected: FAIL with `Cannot find module '../../lib/employer-cache.js'`.

- [ ] **Step 3: Implement token verification and employer cache**

```ts
import { eq } from "drizzle-orm";
import { designatedEmployers, getDb } from "@ocean-find/db";
import { buildEmployerMatcher } from "./employer-filter.js";

type EmployerRow = {
  id: string;
  name: string;
  province: "NB" | "NS" | "PE" | "NL";
};

export function createEmployerCache({
  ttlMs,
  loadEmployers,
}: {
  ttlMs: number;
  loadEmployers: () => Promise<EmployerRow[]>;
}) {
  let cachedAt = 0;
  let cachedMatcher: ReturnType<typeof buildEmployerMatcher> | null = null;

  return {
    async getMatcher() {
      const now = Date.now();
      if (cachedMatcher && now - cachedAt < ttlMs) {
        return cachedMatcher;
      }

      cachedMatcher = buildEmployerMatcher(await loadEmployers());
      cachedAt = now;
      return cachedMatcher;
    },
  };
}

export const employerCache = createEmployerCache({
  ttlMs: 300_000,
  async loadEmployers() {
    const db = getDb();
    return db.select().from(designatedEmployers);
  },
});
```

Update `auth.ts` so it exposes a pure `verifyToken(token: string)` helper shared by both `requireAuth` and `/api/search` query-token validation.

- [ ] **Step 4: Run the targeted cache tests plus scraper typecheck**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/lib/employer-cache.test.ts && pnpm --filter @ocean-find/scraper exec tsc --noEmit`

Expected: PASS with 2 passing tests and TypeScript exit code 0.

### Task 4: Add scraper contracts, timeouts, and the Adzuna REST scraper

**Files:**

- Create: `apps/scraper/src/scrapers/types.ts`
- Create: `apps/scraper/src/scrapers/utils.ts`
- Create: `apps/scraper/src/scrapers/adzuna.ts`
- Create: `apps/scraper/src/__tests__/scrapers/adzuna.test.ts`

- [ ] **Step 1: Write the failing Adzuna scraper tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("AdzunaScraper", () => {
  it("maps api payloads into shared Job records", async () => {
    const { default: axios } = await import("axios");
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        results: [
          {
            id: "123",
            title: "Software Developer",
            company: { display_name: "Acme" },
            location: { display_name: "Halifax, Nova Scotia" },
            redirect_url: "https://example.com/job/123",
            created: "2026-04-20T00:00:00Z",
          },
        ],
      },
    });

    const { adzunaScraper } = await import("../../scrapers/adzuna.js");
    const jobs = await adzunaScraper.scrape("developer", ["NS"]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "Software Developer",
      company: "Acme",
      province: "NS",
      source: "adzuna",
    });
  });

  it("returns an empty array when the request fails", async () => {
    const { default: axios } = await import("axios");
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("boom"));

    const { adzunaScraper } = await import("../../scrapers/adzuna.js");
    await expect(adzunaScraper.scrape("developer", ["NB"])).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/scrapers/adzuna.test.ts`

Expected: FAIL with `Cannot find module '../../scrapers/adzuna.js'`.

- [ ] **Step 3: Implement the shared scraper interface and Adzuna scraper**

```ts
import axios from "axios";
import type { Job, Province } from "@ocean-find/types";
import { detectAtlanticProvince } from "../lib/province-detection.js";
import type { Scraper } from "./types.js";

export const adzunaScraper: Scraper = {
  name: "adzuna",
  async scrape(query, provinces) {
    try {
      const response = await axios.get("https://api.adzuna.com/v1/api/jobs/ca/search/1", {
        params: {
          app_id: process.env.ADZUNA_APP_ID,
          app_key: process.env.ADZUNA_APP_KEY,
          what: query,
          where: provinces.join(" OR "),
          results_per_page: 50,
        },
        timeout: 15_000,
      });

      return (response.data.results ?? []).map((result: any): Job => ({
        id: `adzuna-${result.id}`,
        title: result.title,
        company: result.company?.display_name ?? "Unknown employer",
        location: result.location?.display_name ?? "",
        province: detectAtlanticProvince(result.location?.display_name ?? ""),
        url: result.redirect_url,
        source: "adzuna",
        postedAt: result.created,
      }));
    } catch (error) {
      console.error("[adzuna] scrape failed", error);
      return [];
    }
  },
};
```

- [ ] **Step 4: Run the targeted Adzuna test to verify GREEN**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/scrapers/adzuna.test.ts`

Expected: PASS with 2 passing tests.

### Task 5: Add the shared Playwright scraper factory and source modules

**Files:**

- Create: `apps/scraper/src/scrapers/playwright-factory.ts`
- Create: `apps/scraper/src/scrapers/index.ts`
- Create: `apps/scraper/src/scrapers/indeed.ts`
- Create: `apps/scraper/src/scrapers/jobbank.ts`
- Create: `apps/scraper/src/scrapers/nbjobs.ts`
- Create: `apps/scraper/src/scrapers/nsjobs.ts`
- Create: `apps/scraper/src/scrapers/nljobbank.ts`
- Create: `apps/scraper/src/scrapers/careerbeacon.ts`
- Create: `apps/scraper/src/scrapers/canadajobs.ts`
- Create: `apps/scraper/src/scrapers/remotehub.ts`
- Create: `apps/scraper/src/scrapers/workopolis.ts`
- Create: `apps/scraper/src/scrapers/simplyhired.ts`
- Create: `apps/scraper/src/scrapers/talentegg.ts`
- Create: `apps/scraper/src/scrapers/monster.ts`
- Create: `apps/scraper/src/__tests__/scrapers/playwright-factory.test.ts`

- [ ] **Step 1: Write the failing factory test**

```ts
import { describe, expect, it, vi } from "vitest";
import { createConfiguredPlaywrightScraper } from "../../scrapers/playwright-factory.js";

describe("createConfiguredPlaywrightScraper", () => {
  it("extracts normalized jobs from the provided page adapter", async () => {
    const scrapePage = vi.fn().mockResolvedValue([
      {
        id: "listing-1",
        title: "Backend Developer",
        company: "Acme",
        location: "Halifax, NS",
        url: "https://example.com/job/1",
      },
    ]);

    const scraper = createConfiguredPlaywrightScraper({
      name: "example",
      scrapePage,
    });

    const jobs = await scraper.scrape("developer", ["NS"]);

    expect(scrapePage).toHaveBeenCalledWith("developer", ["NS"]);
    expect(jobs[0]).toMatchObject({ province: "NS", source: "example" });
  });

  it("returns an empty array when the page adapter throws", async () => {
    const scraper = createConfiguredPlaywrightScraper({
      name: "example",
      scrapePage: vi.fn().mockRejectedValue(new Error("blocked")),
    });

    await expect(scraper.scrape("developer", ["NB"])).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/scrapers/playwright-factory.test.ts`

Expected: FAIL with `Cannot find module '../../scrapers/playwright-factory.js'`.

- [ ] **Step 3: Implement the Playwright factory and source modules**

```ts
import type { Job, Province } from "@ocean-find/types";
import { detectAtlanticProvince } from "../lib/province-detection.js";
import type { Scraper } from "./types.js";

type RawJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt?: string;
};

export function createConfiguredPlaywrightScraper({
  name,
  scrapePage,
}: {
  name: string;
  scrapePage: (query: string, provinces: Province[]) => Promise<RawJob[]>;
}): Scraper {
  return {
    name,
    async scrape(query, provinces) {
      try {
        const jobs = await scrapePage(query, provinces);
        return jobs.map((job): Job => ({
          ...job,
          province: detectAtlanticProvince(job.location),
          source: name,
        }));
      } catch (error) {
        console.error(`[${name}] scrape failed`, error);
        return [];
      }
    },
  };
}
```

Each source file should export one configured scraper instance. Use the same shape in each file so `src/scrapers/index.ts` can export a flat `scrapers` array containing Adzuna plus the twelve Playwright-based sources.

- [ ] **Step 4: Run the shared factory tests and scraper package tests**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/scrapers/playwright-factory.test.ts && pnpm --filter @ocean-find/scraper test`

Expected: PASS, including the new scraper tests and the existing parser tests.

### Task 6: Implement streamed search orchestration and `/api/search`

**Files:**

- Create: `apps/scraper/src/search/run-search.ts`
- Create: `apps/scraper/src/search/sse.ts`
- Create: `apps/scraper/src/__tests__/search/run-search.test.ts`
- Modify: `apps/scraper/src/index.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Write the failing search orchestration tests**

```ts
import { describe, expect, it, vi } from "vitest";
import type { Job } from "@ocean-find/types";
import { runSearch } from "../../search/run-search.js";

const baseJob: Job = {
  id: "job-1",
  title: "Developer",
  company: "Acme",
  location: "Halifax, NS",
  province: "NS",
  url: "https://example.com/job-1",
  source: "test-source",
};

describe("runSearch", () => {
  it("emits a batch event when a scraper resolves", async () => {
    const emit = vi.fn();
    const matcher = { matches: vi.fn().mockReturnValue(true) };

    await runSearch({
      query: "developer",
      provinces: ["NS"],
      scrapers: [
        {
          name: "source-a",
          scrape: vi.fn().mockResolvedValue([{ ...baseJob, source: "source-a" }]),
        },
      ],
      matcher,
      emit,
    });

    expect(emit).toHaveBeenCalledWith({
      type: "batch",
      source: "source-a",
      jobs: [{ ...baseJob, source: "source-a" }],
    });
    expect(emit).toHaveBeenCalledWith({ type: "done" });
  });

  it("filters out jobs with unmatched employers or provinces", async () => {
    const emit = vi.fn();
    const matcher = { matches: vi.fn().mockReturnValue(false) };

    await runSearch({
      query: "developer",
      provinces: ["NB"],
      scrapers: [
        {
          name: "source-a",
          scrape: vi.fn().mockResolvedValue([{ ...baseJob, province: "NS" }]),
        },
      ],
      matcher,
      emit,
    });

    expect(emit).toHaveBeenCalledWith({ type: "done" });
    expect(emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: "batch" }));
  });
});
```

- [ ] **Step 2: Run the targeted test to verify RED**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/search/run-search.test.ts`

Expected: FAIL with `Cannot find module '../../search/run-search.js'`.

- [ ] **Step 3: Implement search orchestration and route wiring**

```ts
import type { Job, Province, ScraperEvent } from "@ocean-find/types";
import type { Scraper } from "../scrapers/types.js";

export async function runSearch({
  query,
  provinces,
  scrapers,
  matcher,
  emit,
}: {
  query: string;
  provinces: Province[];
  scrapers: Scraper[];
  matcher: { matches(company: string, province: Province | null): boolean };
  emit: (event: ScraperEvent) => void;
}) {
  await Promise.allSettled(
    scrapers.map(async (scraper) => {
      const jobs = await scraper.scrape(query, provinces);
      const filtered = jobs.filter(
        (job) => job.province && provinces.includes(job.province) && matcher.matches(job.company, job.province),
      );

      if (filtered.length > 0) {
        emit({ type: "batch", source: scraper.name, jobs: filtered });
      }
    }),
  );

  emit({ type: "done" });
}
```

Update `packages/types/src/index.ts` only if the `ScraperEvent` shape needs an explicit exported helper type for the new orchestration code. Update `apps/scraper/src/index.ts` to validate `query`, parse comma-separated provinces, verify `req.query.token`, prepare SSE headers, fetch `employerCache.getMatcher()`, and hand the request off to `runSearch` with the assembled `scrapers` array.

- [ ] **Step 4: Run the search tests, full scraper tests, and typecheck**

Run: `pnpm --filter @ocean-find/scraper exec vitest run src/__tests__/search/run-search.test.ts && pnpm --filter @ocean-find/scraper test && pnpm --filter @ocean-find/scraper exec tsc --noEmit`

Expected: PASS for the new search tests, all scraper tests, and TypeScript.

### Task 7: Verify the full Phase 3 slice end-to-end at the package level

**Files:**

- Modify: `apps/scraper/src/__tests__/bootstrap.test.ts`

- [ ] **Step 1: Replace the bootstrap placeholder with a real smoke assertion**

```ts
import { describe, expect, it } from "vitest";
import { scrapers } from "../scrapers/index.js";

describe("scraper registry", () => {
  it("registers every named Phase 3 scraper", () => {
    expect(scrapers.map((scraper) => scraper.name)).toEqual([
      "adzuna",
      "indeed",
      "jobbank",
      "nbjobs",
      "nsjobs",
      "nljobbank",
      "careerbeacon",
      "canadajobs",
      "remotehub",
      "workopolis",
      "simplyhired",
      "talentegg",
      "monster",
    ]);
  });
});
```

- [ ] **Step 2: Run the full scraper package verification**

Run: `pnpm --filter @ocean-find/scraper test && pnpm --filter @ocean-find/scraper exec tsc --noEmit`

Expected: PASS for all parser, utility, search, and scraper tests, plus a clean TypeScript check.

- [ ] **Step 3: Run workspace verification that covers the touched slice**

Run: `pnpm --filter @ocean-find/types build && pnpm --filter @ocean-find/db build && pnpm --filter @ocean-find/scraper test && pnpm typecheck`

Expected: PASS. If the root `pnpm test` alias remains broken, do not widen scope to fix it here; rely on the package-level verification commands above.