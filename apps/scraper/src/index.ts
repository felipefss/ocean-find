import "dotenv/config";
import { designatedEmployers, getDb } from "@ocean-find/db";
import type { Province, ScraperEvent } from "@ocean-find/types";
import cors from "cors";
import express from "express";
import type { Request } from "express";
import { employerCache } from "./lib/employer-cache.js";
import { requireAuth, verifyToken } from "./middleware/auth.js";
import { parseEmployers as parseNB } from "./parsers/nb.js";
import { parseEmployers as parseNL } from "./parsers/nl.js";
import { parseEmployers as parseNS } from "./parsers/ns.js";
import { parseEmployers as parsePEI } from "./parsers/pei.js";
import { scrapers } from "./scrapers/index.js";
import { runSearch } from "./search/run-search.js";
import { prepareSseResponse, writeSseEvent } from "./search/sse.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Health check — used by apps/web to wake Render container on load
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/search", async (req, res) => {
  const query = getStringQueryParam(req.query.query).trim();
  const token = getStringQueryParam(req.query.token);
  const provinces = parseProvinceQuery(req.query.provinces);

  if (!query) {
    res.status(400).json({ error: "Missing query" });
    return;
  }

  if (provinces.length === 0) {
    res.status(400).json({ error: "Missing provinces" });
    return;
  }

  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  try {
    await verifyToken(token);
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_SECRET environment variable is not set") {
      console.error("[auth] AUTH_SECRET is not set");
      res.status(500).json({ error: "Server misconfiguration" });
      return;
    }

    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  let isClientConnected = true;
  const markDisconnected = () => {
    isClientConnected = false;
  };

  req.on("close", markDisconnected);
  req.on("aborted", markDisconnected);

  prepareSseResponse(res);

  const send = (event: ScraperEvent) => {
    if (!isRequestActive(req) || !isClientConnected) {
      isClientConnected = false;
      return;
    }

    writeSseEvent(res, event);
  };

  try {
    const matcher = await employerCache.getMatcher();
    await runSearch({
      query,
      provinces,
      scrapers,
      matcher,
      emit: send,
    });
  } catch (error) {
    console.error("[search] Search failed:", error);
    send({ type: "error", message: "Search failed" });
    send({ type: "done" });
  } finally {
    if (isRequestActive(req) && isClientConnected) {
      res.end();
    }
  }
});

// ─── POST /api/employers/load ─────────────────────────────────────────────────
// Requires valid JWT. Runs all 4 province parsers and upserts results to DB.
// Streams SSE progress events as each province completes.
app.post("/api/employers/load", requireAuth, async (req, res) => {
  const db = getDb();
  let isClientConnected = true;

  const markDisconnected = () => {
    isClientConnected = false;
  };

  req.on("close", markDisconnected);
  req.on("aborted", markDisconnected);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => {
    if (!isRequestActive(req) || !isClientConnected) {
      isClientConnected = false;
      return false;
    }

    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  };

  type ProvinceConfig = {
    province: "PE" | "NS" | "NB" | "NL";
    parse: () => Promise<string[]>;
  };

  const provinces: ProvinceConfig[] = [
    { province: "PE", parse: parsePEI },
    { province: "NS", parse: parseNS },
    { province: "NB", parse: parseNB },
    { province: "NL", parse: parseNL },
  ];

  let total = 0;

  for (const { province, parse } of provinces) {
    if (!send({ province, status: "loading" })) {
      break;
    }

    try {
      const names = await parse();

      if (!isRequestActive(req) || !isClientConnected) {
        break;
      }

      if (names.length > 0) {
        await db
          .insert(designatedEmployers)
          .values(
            names.map((name) => ({
              name,
              province: province as "PE" | "NS" | "NB" | "NL",
            })),
          )
          .onConflictDoUpdate({
            target: [designatedEmployers.name, designatedEmployers.province],
            set: { updatedAt: new Date() },
          });
      }

      if (!isRequestActive(req) || !isClientConnected) {
        break;
      }

      total += names.length;
      if (!send({ province, status: "done", count: names.length })) {
        break;
      }
    } catch (err) {
      console.error(`[employers/load] Error loading ${province}:`, err);

      if (!send({ province, status: "error", message: String(err) })) {
        break;
      }
    }
  }

  if (isRequestActive(req) && isClientConnected) {
    send({ type: "done", total });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[scraper] Server running on port ${PORT}`);
});

function isRequestActive(req: Request): boolean {
  return !req.destroyed;
}

function getStringQueryParam(value: Request["query"][string]): string {
  return typeof value === "string" ? value : "";
}

const validProvinces: Province[] = ["NB", "NS", "PE", "NL"];

function parseProvinceQuery(value: Request["query"][string]): Province[] {
  if (typeof value !== "string") {
    return [];
  }

  const selected = value
    .split(",")
    .map((province) => province.trim().toUpperCase())
    .filter((province): province is Province => validProvinces.includes(province as Province));

  return [...new Set(selected)];
}
