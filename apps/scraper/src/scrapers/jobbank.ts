import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const jobbankScraper = createConfiguredPlaywrightScraper({
  name: "jobbank",
  async scrapePage() {
    return [];
  },
});
