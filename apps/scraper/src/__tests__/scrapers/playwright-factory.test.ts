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
