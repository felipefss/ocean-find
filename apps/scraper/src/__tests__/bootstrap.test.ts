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
