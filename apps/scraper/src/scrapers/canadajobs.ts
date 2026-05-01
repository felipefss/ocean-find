import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const canadajobsScraper = createConfiguredPlaywrightScraper({
  name: "canadajobs",
  async scrapePage() {
    return [];
  },
});
