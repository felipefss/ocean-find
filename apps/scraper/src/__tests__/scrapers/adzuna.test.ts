import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

describe("AdzunaScraper", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps api payloads into shared Job records", async () => {
    const { default: axios } = await import("axios");
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        results: [
          {
            id: "123",
            title: "Software Developer",
            company: { display_name: "Acme" },
            location: { display_name: "Halifax, Nova Scotia" },
            redirect_url: "https://example.com/job/123",
            created: "2026-04-20T00:00:00Z",
          },
        ],
      },
    });

    const { adzunaScraper } = await import("../../scrapers/adzuna.js");
    const jobs = await adzunaScraper.scrape("developer", ["NS"]);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "Software Developer",
      company: "Acme",
      province: "NS",
      source: "adzuna",
    });
  });

  it("returns an empty array when the request fails", async () => {
    const { default: axios } = await import("axios");
    vi.mocked(axios.get).mockRejectedValueOnce(new Error("boom"));

    const { adzunaScraper } = await import("../../scrapers/adzuna.js");
    await expect(adzunaScraper.scrape("developer", ["NB"])).resolves.toEqual([]);
  });
});
