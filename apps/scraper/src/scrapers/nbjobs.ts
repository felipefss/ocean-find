import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const nbjobsScraper = createConfiguredPlaywrightScraper({
  name: "nbjobs",
  async scrapePage() {
    return [];
  },
});
