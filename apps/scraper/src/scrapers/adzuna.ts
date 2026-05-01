import type { Job } from "@ocean-find/types";
import axios from "axios";
import { detectAtlanticProvince } from "../lib/province-detection.js";
import type { Scraper } from "./types.js";
import { SCRAPER_TIMEOUT_MS } from "./utils.js";

type AdzunaResult = {
  id: string | number;
  title?: string;
  company?: {
    display_name?: string;
  };
  location?: {
    display_name?: string;
  };
  redirect_url?: string;
  created?: string;
};

export const adzunaScraper: Scraper = {
  name: "adzuna",
  async scrape(query, provinces) {
    try {
      const response = await axios.get("https://api.adzuna.com/v1/api/jobs/ca/search/1", {
        params: {
          app_id: process.env.ADZUNA_APP_ID,
          app_key: process.env.ADZUNA_APP_KEY,
          what: query,
          where: provinces.join(" OR "),
          results_per_page: 50,
        },
        timeout: SCRAPER_TIMEOUT_MS,
      });

      return (response.data.results ?? []).map((result: AdzunaResult): Job => {
        const location = result.location?.display_name ?? "";

        return {
          id: `adzuna-${result.id}`,
          title: result.title ?? "Untitled job",
          company: result.company?.display_name ?? "Unknown employer",
          location,
          province: detectAtlanticProvince(location),
          url: result.redirect_url ?? "",
          source: "adzuna",
          postedAt: result.created,
        };
      });
    } catch (error) {
      console.error("[adzuna] scrape failed", error);
      return [];
    }
  },
};
