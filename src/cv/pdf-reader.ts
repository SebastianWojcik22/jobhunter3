import fs from 'fs';
// pdf-parse uses CommonJS default export
import pdfParse from 'pdf-parse';

export async function extractTextFromPdf(pdfPath: string): Promise<string> {
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`CV PDF not found at: ${pdfPath}`);
  }
  const buffer = fs.readFileSync(pdfPath);
  const result = await pdfParse(buffer);
  const text = result.text.trim();
  if (!text) {
    throw new Error('PDF appears to be empty or image-only (no extractable text)');
  }
  return text;
}
