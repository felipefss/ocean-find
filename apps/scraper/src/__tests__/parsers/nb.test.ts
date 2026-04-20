import { describe, expect, it, vi } from "vitest";
import { parsePdfBuffer } from "../../parsers/nb.js";

// Mock pdf-parse so tests don't need a real PDF binary
vi.mock("pdf-parse", () => ({
  default: vi.fn(async (_buf: Buffer) => ({
    text: `
Designated Employers
New Brunswick

ABC Construction Ltd.
Fredericton Tech Inc.
Moncton Marine Services

1

Nouveau-Brunswick Consulting
Saint John Fisheries Co.

2
`,
  })),
}));

describe("NB parser — parsePdfBuffer", () => {
  it("extracts employer names from PDF text", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");
    const names = await parsePdfBuffer(fakeBuffer);

    expect(names).toContain("ABC Construction Ltd.");
    expect(names).toContain("Fredericton Tech Inc.");
    expect(names).toContain("Moncton Marine Services");
    expect(names).toContain("Nouveau-Brunswick Consulting");
    expect(names).toContain("Saint John Fisheries Co.");
  });

  it("filters out page numbers and bilingual headers", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");
    const names = await parsePdfBuffer(fakeBuffer);

    expect(names).not.toContain("1");
    expect(names).not.toContain("2");
    // Whole-line header should be filtered
    expect(names.some((n) => /^designated employers$/i.test(n))).toBe(false);
    expect(names.some((n) => /^new brunswick$/i.test(n))).toBe(false);
    // Employer name that contains "Nouveau-Brunswick" as part of its name survives
    expect(names).toContain("Nouveau-Brunswick Consulting");
  });

  it("deduplicates names", async () => {
    const { default: pdfParse } = await import("pdf-parse");
    vi.mocked(pdfParse).mockResolvedValueOnce({
      text: "Company A\nCompany A\nCompany B\n",
      numpages: 1,
      numrender: 1,
      info: {},
      metadata: {},
      // biome-ignore lint/suspicious/noExplicitAny: mock return value
      version: "1.0" as any,
    });

    const names = await parsePdfBuffer(Buffer.from("x"));
    expect(names.filter((n) => n === "Company A").length).toBe(1);
  });

  it("returns empty array on pdf-parse failure", async () => {
    const { default: pdfParse } = await import("pdf-parse");
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error("corrupt PDF"));

    const names = await parsePdfBuffer(Buffer.from("x"));
    expect(names).toEqual([]);
  });
});
