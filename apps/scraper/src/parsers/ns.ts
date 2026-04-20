import axios from "axios";
import pdfParse from "pdf-parse";

const NS_PDF_URL =
  "https://liveinnovascotia.com/sites/default/files/2024-07/Designated_AIP_employers.pdf";

export async function parseEmployers(): Promise<string[]> {
  try {
    const response = await axios.get<ArrayBuffer>(NS_PDF_URL, {
      responseType: "arraybuffer",
      timeout: 30_000,
    });
    return parsePdfBuffer(Buffer.from(response.data));
  } catch (err) {
    console.error("[ns-parser] Failed to fetch NS employer PDF:", err);
    return [];
  }
}

export async function parsePdfBuffer(buffer: Buffer): Promise<string[]> {
  try {
    const data = await pdfParse(buffer);
    return extractNames(data.text);
  } catch (err) {
    console.error("[ns-parser] Failed to parse NS PDF:", err);
    return [];
  }
}

// Alias for tests
export { parsePdfBuffer as parsePdfAsync };

function extractNames(text: string): string[] {
  const names: string[] = [];
  const lines = text.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    // Skip blank lines, page numbers, headers, footers
    if (!line) continue;
    if (/^\d+$/.test(line)) continue; // page number
    // Skip lines that are purely a header/footer phrase (whole line match)
    if (
      /^(nova scotia|designated employer(s)?|province|aip|atlantic immigration program?)[\s\-:]*$/i.test(
        line,
      )
    )
      continue;
    if (line.length < 3 || line.length > 200) continue;
    names.push(line);
  }

  return [...new Set(names)];
}
