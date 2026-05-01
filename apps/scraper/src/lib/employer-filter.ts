import type { Province } from "@ocean-find/types";
import Fuse from "fuse.js";

type EmployerRow = {
  id: string;
  name: string;
  province: Province;
};

const suffixPattern = /\b(inc|incorporated|corp|corporation|ltd|limited|llc|ltee|ltée)\b/gi;

export function normalizeEmployerName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
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
      if (!normalizedCompany) return false;

      return fuse
        .search(normalizedCompany)
        .some((result) => result.item.province === province && (result.score ?? 1) <= 0.2);
    },
  };
}
