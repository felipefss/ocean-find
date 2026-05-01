import type { ScraperEvent } from "@ocean-find/types";
import type { Response } from "express";

export function prepareSseResponse(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
}

export function writeSseEvent(res: Response, event: ScraperEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
