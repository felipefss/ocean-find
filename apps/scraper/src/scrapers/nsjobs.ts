import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const nsjobsScraper = createConfiguredPlaywrightScraper({
  name: "nsjobs",
  async scrapePage() {
    return [];
  },
});
