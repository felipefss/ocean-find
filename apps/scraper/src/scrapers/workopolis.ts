import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const workopolisScraper = createConfiguredPlaywrightScraper({
  name: "workopolis",
  async scrapePage() {
    return [];
  },
});
