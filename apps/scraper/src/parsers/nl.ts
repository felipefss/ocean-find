import * as cheerio from "cheerio";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const NL_URL =
  "https://www.gov.nl.ca/immigration/immigrating-to-newfoundland-and-labrador/atlantic-immigration-program/designated-employers/";

chromium.use(StealthPlugin());

export async function parseEmployers(): Promise<string[]> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(NL_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait for DataTable to initialize
    await page.waitForSelector("table tbody tr", { timeout: 15_000 }).catch(() => null);

    // Try to show all entries at once via the DataTables length select
    await page
      .evaluate(() => {
        const select = document.querySelector<HTMLSelectElement>("select[name*='length']");
        if (select) {
          // Set to the highest available option, or -1 for "All"
          const options = Array.from(select.options).map((o) => Number(o.value));
          const max = Math.max(...options);
          select.value = max === -1 ? "-1" : String(max);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      })
      .catch(() => null);

    // Wait briefly for DataTables to re-render
    await page.waitForTimeout(1500).catch(() => null);

    // Collect all employer names, paginating if needed
    const names: string[] = [];
    let hasNextPage = true;

    while (hasNextPage) {
      const html = await page.content();
      const pageNames = parseHtml(html);
      names.push(...pageNames);

      // Check for a "Next" pagination button that isn't disabled
      const nextBtn = page.locator(
        ".dataTables_wrapper .paginate_button.next:not(.disabled), #DataTables_Table_0_next:not(.disabled)",
      );
      const nextCount = await nextBtn.count();
      if (nextCount > 0) {
        await nextBtn.click();
        await page.waitForTimeout(1000).catch(() => null);
      } else {
        hasNextPage = false;
      }
    }

    return [...new Set(names)];
  } catch (err) {
    console.error("[nl-parser] Failed to fetch NL employer list:", err);
    return [];
  } finally {
    await browser?.close();
  }
}

export function parseHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const names: string[] = [];

  // NL uses a DataTables table; employer name is in the first column <td>
  $("table tbody tr").each((_i, row) => {
    const firstCell = $(row).find("td").first();
    // The employer name may be wrapped in an anchor
    const name = firstCell.find("a").first().text().trim() || firstCell.text().trim();
    if (name && name.length > 1) {
      names.push(name);
    }
  });

  return names;
}
