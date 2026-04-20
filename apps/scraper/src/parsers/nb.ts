import axios from "axios";
import pdfParse from "pdf-parse";

const NB_PDF_URL =
  "https://www2.gnb.ca/content/dam/gnb/Corporate/Promo/Immigration/designated-employers-employeurs-designes.pdf";

export async function parseEmployers(): Promise<string[]> {
  try {
    const response = await axios.get<ArrayBuffer>(NB_PDF_URL, {
      responseType: "arraybuffer",
      timeout: 30_000,
    });
    return parsePdfBuffer(Buffer.from(response.data));
  } catch (err) {
    console.error("[nb-parser] Failed to fetch NB employer PDF:", err);
    return [];
  }
}

export async function parsePdfBuffer(buffer: Buffer): Promise<string[]> {
  try {
    const data = await pdfParse(buffer);
    return extractNames(data.text);
  } catch (err) {
    console.error("[nb-parser] Failed to parse NB PDF:", err);
    return [];
  }
}

function extractNames(text: string): string[] {
  const names: string[] = [];
  const lines = text.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    // Skip blank lines, page numbers, bilingual headers/footers
    if (!line) continue;
    if (/^\d+$/.test(line)) continue;
    // Skip lines that are purely a header/footer phrase (whole line match)
    if (
      /^(designated employer(s)?|employeur(s)? désigné(s)?|new brunswick|nouveau-brunswick|province|aip|atlantic immigration program?)[\s\-:]*$/i.test(
        line,
      )
    )
      continue;
    if (line.length < 3 || line.length > 200) continue;
    names.push(line);
  }

  return [...new Set(names)];
}
