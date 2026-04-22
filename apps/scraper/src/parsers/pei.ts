import * as cheerio from "cheerio";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const PEI_URL =
  "https://www.princeedwardisland.ca/en/information/office-of-immigration/atlantic-immigration-program-designated-employers";

chromium.use(StealthPlugin());

export async function parseEmployers(): Promise<string[]> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(PEI_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Wait for the employer list to appear
    await page.waitForSelector("ul li", { timeout: 15_000 }).catch(() => null);
    const html = await page.content();
    return parseHtml(html);
  } catch (err) {
    console.error("[pei-parser] Failed to fetch PEI employer list:", err);
    return [];
  } finally {
    await browser?.close();
  }
}

export function parseHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const names: string[] = [];

  // PEI lists employers in <ul> elements within the main content area
  $("main ul li, .field-items ul li, .content ul li, article ul li").each((_i, el) => {
    const text = $(el).text().trim();
    if (text) names.push(text);
  });

  // Fallback: any <ul><li> that looks like an employer list (not nav, not footer)
  if (names.length === 0) {
    $("ul li").each((_i, el) => {
      const text = $(el).text().trim();
      const parent = $(el).closest("nav, header, footer, .menu, .breadcrumb");
      if (text && parent.length === 0 && text.length > 2 && text.length < 200) {
        names.push(text);
      }
    });
  }

  return [...new Set(names)];
}
