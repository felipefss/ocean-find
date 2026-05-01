import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const remotehubScraper = createConfiguredPlaywrightScraper({
  name: "remotehub",
  async scrapePage() {
    return [];
  },
});
