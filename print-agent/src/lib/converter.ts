import { execFile } from "child_process";
import fs from "fs";
import path from "path";

const MAX_RETRIES  = 2;
const RETRY_DELAY  = 2_000; // ms – doubles each attempt

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Converts a DOCX/DOC/ODT/RTF file to PDF using LibreOffice headless.
 * Retries up to MAX_RETRIES times on failure.
 * Verifies that the output PDF exists and is non-empty before returning.
 * Returns the absolute path of the generated PDF.
 */
export const convertToPdf = async (filePath: string): Promise<string> => {
  const soffice = process.env.LIBREOFFICE_PATH || "soffice";
  const dir     = path.dirname(filePath);
  const pdfPath = filePath.replace(/\.(docx?|odt|rtf)$/i, ".pdf");

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(
          soffice,
          ["--headless", "--convert-to", "pdf", "--outdir", dir, filePath],
          { timeout: 90_000 },
          (err, _stdout, stderr) => {
            if (err) {
              reject(new Error(`LibreOffice failed (attempt ${attempt}): ${stderr || err.message}`));
            } else {
              resolve();
            }
          }
        );
      });

      // Verify output file was actually produced
      if (!fs.existsSync(pdfPath)) {
        throw new Error("LibreOffice completed but produced no output PDF");
      }
      const { size } = fs.statSync(pdfPath);
      if (size < 100) {
        throw new Error(`Converted PDF appears empty or corrupt (${size} bytes)`);
      }

      return pdfPath;

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[converter] Attempt ${attempt} failed: ${lastError.message}`);
      if (attempt <= MAX_RETRIES) {
        await sleep(RETRY_DELAY * attempt); // 2 s, 4 s
      }
    }
  }

  throw lastError!;
};

/** Returns true if the file needs DOCX→PDF conversion */
export const needsConversion = (fileName: string): boolean =>
  /\.(docx?|odt|rtf)$/i.test(fileName);

