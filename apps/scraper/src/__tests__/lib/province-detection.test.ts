import { describe, expect, it } from "vitest";
import { detectAtlanticProvince } from "../../lib/province-detection.js";

describe("detectAtlanticProvince", () => {
  it("matches full province names", () => {
    expect(detectAtlanticProvince("Saint John, New Brunswick")).toBe("NB");
    expect(detectAtlanticProvince("Halifax, Nova Scotia")).toBe("NS");
    expect(detectAtlanticProvince("Charlottetown, Prince Edward Island")).toBe("PE");
    expect(detectAtlanticProvince("Corner Brook, Newfoundland and Labrador")).toBe("NL");
  });

  it("matches province abbreviations", () => {
    expect(detectAtlanticProvince("Moncton, NB")).toBe("NB");
    expect(detectAtlanticProvince("Sydney, NS")).toBe("NS");
    expect(detectAtlanticProvince("Summerside, PEI")).toBe("PE");
    expect(detectAtlanticProvince("St. John's, NL")).toBe("NL");
  });

  it("maps known Atlantic cities when the province is missing", () => {
    expect(detectAtlanticProvince("Fredericton")).toBe("NB");
    expect(detectAtlanticProvince("Dartmouth")).toBe("NS");
    expect(detectAtlanticProvince("Charlottetown")).toBe("PE");
    expect(detectAtlanticProvince("Mount Pearl")).toBe("NL");
  });

  it("returns null for non-Atlantic locations", () => {
    expect(detectAtlanticProvince("Toronto, ON")).toBeNull();
    expect(detectAtlanticProvince("Remote - Canada")).toBeNull();
    expect(detectAtlanticProvince("")).toBeNull();
  });
});
