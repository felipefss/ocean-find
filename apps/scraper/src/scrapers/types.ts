import type { Job, Province } from "@ocean-find/types";

export interface Scraper {
  name: string;
  scrape(query: string, provinces: Province[]): Promise<Job[]>;
}
