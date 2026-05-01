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
  ["NL", /\b(st\.?\s*john'?s|corner brook|mount pearl|gander)\b/i],
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
