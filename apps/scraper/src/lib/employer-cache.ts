import { designatedEmployers, getDb } from "@ocean-find/db";
import type { Province } from "@ocean-find/types";
import { buildEmployerMatcher } from "./employer-filter.js";

type EmployerRow = {
  id: string;
  name: string;
  province: Province;
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
