import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const indeedScraper = createConfiguredPlaywrightScraper({
  name: "indeed",
  async scrapePage() {
    return [];
  },
});
