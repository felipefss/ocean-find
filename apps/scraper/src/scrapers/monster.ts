import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const monsterScraper = createConfiguredPlaywrightScraper({
  name: "monster",
  async scrapePage() {
    return [];
  },
});
