import "dotenv/config";
import { db, designatedEmployers } from "@ocean-find/db";
import cors from "cors";
import express from "express";
import { requireAuth } from "./middleware/auth.js";
import { parseEmployers as parseNB } from "./parsers/nb.js";
import { parseEmployers as parseNL } from "./parsers/nl.js";
import { parseEmployers as parseNS } from "./parsers/ns.js";
import { parseEmployers as parsePEI } from "./parsers/pei.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors());
app.use(express.json());

// Health check — used by apps/web to wake Render container on load
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Routes (stubbed — implemented in later phases)
app.get("/api/search", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

// ─── POST /api/employers/load ─────────────────────────────────────────────────
// Requires valid JWT. Runs all 4 province parsers and upserts results to DB.
// Streams SSE progress events as each province completes.
app.post("/api/employers/load", requireAuth, async (_req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
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
    send({ province, status: "loading" });

    try {
      const names = await parse();
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
      total += names.length;
      send({ province, status: "done", count: names.length });
    } catch (err) {
      console.error(`[employers/load] Error loading ${province}:`, err);
      send({ province, status: "error", message: String(err) });
    }
  }

  send({ type: "done", total });
  res.end();
});

app.listen(PORT, () => {
  console.log(`[scraper] Server running on port ${PORT}`);
});
