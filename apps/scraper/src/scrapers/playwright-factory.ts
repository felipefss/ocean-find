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
        return jobs.map(
          (job): Job => ({
            ...job,
            province: detectAtlanticProvince(job.location),
            source: name,
          }),
        );
      } catch (error) {
        console.error(`[${name}] scrape failed`, error);
        return [];
      }
    },
  };
}
