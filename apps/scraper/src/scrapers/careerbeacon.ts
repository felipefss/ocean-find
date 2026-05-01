import { createConfiguredPlaywrightScraper } from "./playwright-factory.js";

export const careerbeaconScraper = createConfiguredPlaywrightScraper({
  name: "careerbeacon",
  async scrapePage() {
    return [];
  },
});
