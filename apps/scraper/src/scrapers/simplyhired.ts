import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const simplyhiredScraper = createConfiguredPlaywrightScraper({
  name: "simplyhired",
  async scrapePage() {
    return [];
  },
});
