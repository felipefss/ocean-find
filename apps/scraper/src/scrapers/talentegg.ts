import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const talenteggScraper = createConfiguredPlaywrightScraper({
  name: "talentegg",
  async scrapePage() {
    return [];
  },
});
