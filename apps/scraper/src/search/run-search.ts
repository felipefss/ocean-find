import type { Province, ScraperEvent } from "@ocean-find/types";
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
        (job) =>
          job.province &&
          provinces.includes(job.province) &&
          matcher.matches(job.company, job.province),
      );

      if (filtered.length > 0) {
        emit({ type: "batch", source: scraper.name, jobs: filtered });
      }
    }),
  );

  emit({ type: "done" });
}
