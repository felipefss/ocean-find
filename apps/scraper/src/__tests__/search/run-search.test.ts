import type { Job } from "@ocean-find/types";
import { describe, expect, it, vi } from "vitest";
import { runSearch } from "../../search/run-search.js";

const baseJob: Job = {
  id: "job-1",
  title: "Developer",
  company: "Acme",
  location: "Halifax, NS",
  province: "NS",
  url: "https://example.com/job-1",
  source: "test-source",
};

describe("runSearch", () => {
  it("emits a batch event when a scraper resolves", async () => {
    const emit = vi.fn();
    const matcher = { matches: vi.fn().mockReturnValue(true) };

    await runSearch({
      query: "developer",
      provinces: ["NS"],
      scrapers: [
        {
          name: "source-a",
          scrape: vi.fn().mockResolvedValue([{ ...baseJob, source: "source-a" }]),
        },
      ],
      matcher,
      emit,
    });

    expect(emit).toHaveBeenCalledWith({
      type: "batch",
      source: "source-a",
      jobs: [{ ...baseJob, source: "source-a" }],
    });
    expect(emit).toHaveBeenCalledWith({ type: "done" });
  });

  it("filters out jobs with unmatched employers or provinces", async () => {
    const emit = vi.fn();
    const matcher = { matches: vi.fn().mockReturnValue(false) };

    await runSearch({
      query: "developer",
      provinces: ["NB"],
      scrapers: [
        {
          name: "source-a",
          scrape: vi.fn().mockResolvedValue([{ ...baseJob, province: "NS" }]),
        },
      ],
      matcher,
      emit,
    });

    expect(emit).toHaveBeenCalledWith({ type: "done" });
    expect(emit).not.toHaveBeenCalledWith(expect.objectContaining({ type: "batch" }));
  });
});
