"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget ping to the Render scraper service on app load.
 * This wakes the container before the user triggers a search,
 * reducing the cold-start delay from ~30s to near-zero.
 */
export function ScraperWakeUp() {
  useEffect(() => {
    const scraperUrl = process.env.NEXT_PUBLIC_SCRAPER_URL;
    if (!scraperUrl) return;

    fetch(`${scraperUrl}/health`, { method: "GET" }).catch(() => {
      // Intentionally ignored — this is a best-effort wake-up ping
    });
  }, []);

  return null;
}
