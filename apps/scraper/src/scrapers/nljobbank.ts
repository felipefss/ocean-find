import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const nljobbankScraper = createConfiguredPlaywrightScraper({
  name: "nljobbank",
  async scrapePage() {
    return [];
  },
});
