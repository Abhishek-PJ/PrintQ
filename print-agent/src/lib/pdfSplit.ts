import { PDFDocument, PDFPage } from "pdf-lib";
import fs from "fs";
import path from "path";

/**
 * Extracts a page range [fromPage, toPage] (1-based, inclusive) from a PDF
 * and writes it to a new temp file.
 *
 * Returns the path to the extracted PDF.
 */
export const extractPages = async (
  sourcePdfPath: string,
  fromPage: number,
  toPage: number,
  outputPath: string
): Promise<string> => {
  const sourceBytes = fs.readFileSync(sourcePdfPath);
  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(sourceBytes);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/PDFDocument\.load.*encrypted|input document.*encrypted/i.test(raw)) {
      throw new Error(
        "This PDF is encrypted or password-protected and cannot be auto-printed. Please upload an unlocked PDF."
      );
    }
    throw err instanceof Error ? err : new Error(raw);
  }
  const totalPages = srcDoc.getPageCount();

  // Clamp to actual page count
  const start = Math.max(0, fromPage - 1);           // 0-based
  const end   = Math.min(totalPages - 1, toPage - 1); // 0-based inclusive

  if (start > end) {
    throw new Error(
      `Page range ${fromPage}–${toPage} is out of bounds (document has ${totalPages} pages)`
    );
  }

  const newDoc  = await PDFDocument.create();
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const copied  = await newDoc.copyPages(srcDoc, indices);
  copied.forEach((p: PDFPage) => newDoc.addPage(p));

  const pdfBytes = await newDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return outputPath;
};

/** Generates a deterministic temp file path for an extracted page range */
export const rangeFilePath = (dir: string, orderId: string, ruleIndex: number): string =>
  path.join(dir, `${orderId}_rule${ruleIndex}.pdf`);
