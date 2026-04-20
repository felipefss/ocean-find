import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseHtml } from "../../parsers/nl.js";

const fixtureHtml = readFileSync(join(__dirname, "../../__fixtures__/nl-employers.html"), "utf-8");

describe("NL parser — parseHtml", () => {
  it("extracts employer names from DataTables table first column", () => {
    const names = parseHtml(fixtureHtml);
    expect(names).toContain("Acme NL Inc.");
    expect(names).toContain("Atlantic Marine Services");
  });

  it("extracts employer names without anchor links too", () => {
    const names = parseHtml(fixtureHtml);
    expect(names).toContain("No Link Employer");
  });

  it("returns 3 employers from fixture", () => {
    const names = parseHtml(fixtureHtml);
    expect(names.length).toBe(3);
  });

  it("returns empty array when table has no rows", () => {
    const emptyHtml = `
      <html><body>
        <table><thead><tr><th>Employer Name</th></tr></thead><tbody></tbody></table>
      </body></html>
    `;
    const names = parseHtml(emptyHtml);
    expect(names).toEqual([]);
  });

  it("skips rows with empty first cell", () => {
    const html = `
      <html><body>
        <table><tbody>
          <tr><td></td><td>Location</td></tr>
          <tr><td><a href="#">Valid Employer</a></td><td>City</td></tr>
        </tbody></table>
      </body></html>
    `;
    const names = parseHtml(html);
    expect(names).toEqual(["Valid Employer"]);
  });
});
