import "dotenv/config";
import cors from "cors";
import express from "express";

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

app.post("/api/employers/load", (_req, res) => {
  res.status(501).json({ error: "Not implemented yet" });
});

app.listen(PORT, () => {
  console.log(`[scraper] Server running on port ${PORT}`);
});
