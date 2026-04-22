import { describe, expect, it, vi } from "vitest";
import { parsePdfAsync } from "../../parsers/ns.js";

// Mock pdf-parse so tests don't need a real PDF binary
vi.mock("pdf-parse", () => ({
  default: vi.fn(async (_buf: Buffer) => ({
    text: `
Nova Scotia
Page 1

Acme NS Technologies
Atlantic Seafood Co.
Halifax Engineering Ltd.
Maritime Consulting Group

1

Page 2

Nova Tech Solutions
Blueberry Hill Farms Ltd.

2
`,
  })),
}));

describe("NS parser — parsePdfAsync", () => {
  it("extracts employer names from PDF text", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");
    const names = await parsePdfAsync(fakeBuffer);

    expect(names).toContain("Acme NS Technologies");
    expect(names).toContain("Atlantic Seafood Co.");
    expect(names).toContain("Halifax Engineering Ltd.");
    expect(names).toContain("Maritime Consulting Group");
    expect(names).toContain("Nova Tech Solutions");
    expect(names).toContain("Blueberry Hill Farms Ltd.");
  });

  it("filters out page numbers and headers", async () => {
    const fakeBuffer = Buffer.from("fake-pdf-content");
    const names = await parsePdfAsync(fakeBuffer);

    expect(names).not.toContain("1");
    expect(names).not.toContain("2");
    // Whole-line headers are filtered
    expect(names).not.toContain("Nova Scotia Designated AIP Employers");
    expect(names.some((n) => /^nova scotia$/i.test(n))).toBe(false);
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

    const names = await parsePdfAsync(Buffer.from("x"));
    expect(names.filter((n) => n === "Company A").length).toBe(1);
  });

  it("returns empty array on pdf-parse failure", async () => {
    const { default: pdfParse } = await import("pdf-parse");
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error("corrupt PDF"));

    const names = await parsePdfAsync(Buffer.from("x"));
    expect(names).toEqual([]);
  });
});
