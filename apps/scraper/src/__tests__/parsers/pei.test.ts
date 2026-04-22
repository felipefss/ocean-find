import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHtml } from "../../parsers/pei.js";

const fixtureHtml = readFileSync(join(__dirname, "../../__fixtures__/pei-employers.html"), "utf-8");

describe("PEI parser — parseHtml", () => {
  it("extracts employer names from <ul><li> in main content", () => {
    const names = parseHtml(fixtureHtml);
    expect(names).toContain("Acme Solutions Inc.");
    expect(names).toContain("Atlantic Tech Corp");
    expect(names).toContain("Charlottetown Foods Ltd.");
    expect(names).toContain("Island Fisheries Co.");
    expect(names).toContain("PEI Aerospace Ltd.");
  });

  it("returns at least 5 employers from fixture", () => {
    const names = parseHtml(fixtureHtml);
    expect(names.length).toBeGreaterThanOrEqual(5);
  });

  it("deduplicates entries", () => {
    const dupeHtml = `
      <html><body><main><ul><li>Company A</li><li>Company A</li><li>Company B</li></ul></main></body></html>
    `;
    const names = parseHtml(dupeHtml);
    expect(names.filter((n) => n === "Company A").length).toBe(1);
  });

  it("returns empty array for HTML with no list items in content", () => {
    const emptyHtml = "<html><body><main><p>No employers listed.</p></main></body></html>";
    const names = parseHtml(emptyHtml);
    expect(names).toEqual([]);
  });

  it("skips nav/header/footer list items", () => {
    const navHtml = `
      <html><body>
        <nav><ul><li>Home</li><li>About</li></ul></nav>
        <main><ul><li>Real Employer</li></ul></main>
        <footer><ul><li>Contact</li></ul></footer>
      </body></html>
    `;
    const names = parseHtml(navHtml);
    expect(names).toContain("Real Employer");
    expect(names).not.toContain("Home");
    expect(names).not.toContain("Contact");
  });
});
