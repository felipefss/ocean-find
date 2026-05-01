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
