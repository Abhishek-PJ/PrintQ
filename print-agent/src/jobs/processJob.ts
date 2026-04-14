import fs from "fs";
import os from "os";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { Socket } from "socket.io-client";
import { PrintJob, PrintProgress, PrinterCapabilities, PrintRule } from "../types";
import { downloadFile } from "../lib/downloader";
import { needsConversion, convertToPdf } from "../lib/converter";
import { extractPages, rangeFilePath } from "../lib/pdfSplit";
import { printFile } from "../lib/printer";

const PRINTER_NAME    = process.env.PRINTER_NAME || undefined;
const TEMP_DIR        = path.join(os.tmpdir(), "printq-agent");
const JOB_TIMEOUT_MS  = 5 * 60 * 1_000; // 5 minutes hard cap

const ensureTempDir = () => {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
};

/** Silently removes a single file. */
const cleanup = (filePath: string) => {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
};

/**
 * Deletes every file in TEMP_DIR whose name starts with orderId.
 * Belt-and-suspenders: catches any stragglers created after the tracked
 * jobTempFiles list was snapshotted (e.g. when timeout fired mid-job).
 */
const cleanupByOrderId = (orderId: string): void => {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;
    for (const file of fs.readdirSync(TEMP_DIR)) {
      if (file.startsWith(orderId)) cleanup(path.join(TEMP_DIR, file));
    }
  } catch { /* non-critical */ }
};

/**
 * Wipes all files in TEMP_DIR.
 * Called on agent startup/reconnect to remove anything left over from
 * a previous crash, kill, or aborted job.
 */
export const purgeStaleFiles = (): void => {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;
    for (const file of fs.readdirSync(TEMP_DIR)) {
      cleanup(path.join(TEMP_DIR, file));
    }
    console.log("[cleanup] Purged stale temp files from TEMP_DIR");
  } catch { /* non-critical */ }
};

const progress = (socket: Socket, data: PrintProgress) => {
  socket.emit("print:progress", data);
  console.log(
    `[${data.orderId}] ${data.step}` +
    (data.current !== undefined ? ` (${data.current}/${data.total})` : "") +
    (data.message ? ` — ${data.message}` : "")
  );
};

const toFriendlyPdfLoadError = (err: unknown): Error => {
  const raw = err instanceof Error ? err.message : String(err);
  if (/PDFDocument\.load.*encrypted|input document.*encrypted/i.test(raw)) {
    return new Error(
      "This PDF is encrypted or password-protected and cannot be auto-printed. Please upload an unlocked PDF."
    );
  }
  return err instanceof Error ? err : new Error(raw);
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validates print rules against the actual page count.
 * Returns an error string, or null if all rules are valid.
 */
const validateRules = (job: PrintJob, totalPages: number): string | null => {
  const { printOptions } = job;
  if (!printOptions.printRules.length) return "No print rules specified";
  if (printOptions.copies < 1)         return "Copies must be at least 1";
  if (!["A4", "A3"].includes(printOptions.paperSize))
    return `Unsupported paper size: ${printOptions.paperSize}`;

  for (let i = 0; i < printOptions.printRules.length; i++) {
    const r = printOptions.printRules[i];
    if (r.fromPage < 1 || r.toPage < r.fromPage)
      return `Rule ${i + 1}: invalid page range ${r.fromPage}–${r.toPage}`;
    if (r.toPage > totalPages)
      return `Rule ${i + 1}: page ${r.toPage} exceeds document length (${totalPages} pages)`;
  }
  return null;
};

/**
 * Returns rules adjusted to what the printer can actually do.
 * Color is downgraded to B&W if the printer lacks color support.
 * Duplex is downgraded to simplex if the printer has no duplex unit.
 * Emits a print:warning event for each downgrade so the admin UI can surface it.
 */
const adjustToCapabilities = (
  socket: Socket,
  rules: PrintRule[],
  cap: PrinterCapabilities | undefined,
  orderId: string
): PrintRule[] => {
  if (!cap) return rules;
  return rules.map((r, i) => {
    const adj = { ...r };
    if (r.colorMode === "color" && !cap.color) {
      const warning = `Rule ${i + 1}: printer does not support color — converted to B&W.`;
      console.log(`[${orderId}] ${warning}`);
      socket.emit("print:warning", { orderId, warning });
      adj.colorMode = "bw";
    }
    if (r.sided === "double" && !cap.duplex) {
      const warning = `Rule ${i + 1}: printer does not support duplex — converted to single-sided.`;
      console.log(`[${orderId}] ${warning}`);
      socket.emit("print:warning", { orderId, warning });
      adj.sided = "single";
    }
    return adj;
  });
};

// ── Core job body ─────────────────────────────────────────────────────────────

const runJob = async (
  socket: Socket,
  job: PrintJob,
  jobTempFiles: string[],
  cap: PrinterCapabilities | undefined
): Promise<void> => {
  const { orderId, fileUrl, fileName, printOptions } = job;

  // ── 1. Download ─────────────────────────────────────────────────────────────
  progress(socket, { orderId, step: "downloading", message: `Downloading ${fileName}` });
  const ext            = path.extname(fileName) || ".pdf";
  const downloadedPath = await downloadFile(fileUrl, TEMP_DIR, `${orderId}${ext}`);
  jobTempFiles.push(downloadedPath);

  // ── 2. Convert if needed ────────────────────────────────────────────────────
  let pdfPath = downloadedPath;
  if (needsConversion(fileName)) {
    progress(socket, { orderId, step: "converting", message: "Converting document to PDF…" });
    pdfPath = await convertToPdf(downloadedPath);
    jobTempFiles.push(pdfPath);
  }

  // ── 3. Validate rules against actual page count ─────────────────────────────
  let srcDoc: PDFDocument;
  try {
    srcDoc = await PDFDocument.load(fs.readFileSync(pdfPath));
  } catch (err) {
    throw toFriendlyPdfLoadError(err);
  }
  const totalPages = srcDoc.getPageCount();
  const validErr  = validateRules(job, totalPages);
  if (validErr) throw new Error(`Validation failed: ${validErr}`);

  // ── 4. Adjust rules to printer capabilities ─────────────────────────────────
  const rules      = adjustToCapabilities(socket, printOptions.printRules, cap, orderId);
  const totalRules = rules.length;

  // ── 5. Split + print each rule ──────────────────────────────────────────────
  for (let i = 0; i < totalRules; i++) {
    const rule = rules[i];

    progress(socket, {
      orderId,
      step: "splitting",
      current: i + 1,
      total: totalRules,
      message: `Extracting pages ${rule.fromPage}–${rule.toPage}`,
    });

    const splitPath = rangeFilePath(TEMP_DIR, orderId, i);
    await extractPages(pdfPath, rule.fromPage, rule.toPage, splitPath);
    jobTempFiles.push(splitPath);

    progress(socket, {
      orderId,
      step: "printing",
      current: i + 1,
      total: totalRules,
      message: `Rule ${i + 1}/${totalRules}: pp${rule.fromPage}–${rule.toPage} ${
        rule.colorMode === "bw" ? "B&W" : "Color"
      } ${rule.sided === "double" ? "duplex" : "simplex"}`,
    });

    await printFile(splitPath, {
      printer:   PRINTER_NAME,
      colorMode: rule.colorMode,
      sided:     rule.sided,
      copies:    printOptions.copies,
      paperSize: printOptions.paperSize,
    });
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Hard printer lock — independent of the agent's job queue.
 * Prevents two processJob calls from running concurrently even if a bug
 * bypasses the queue (e.g. direct call, test harness, future refactor).
 */
let printerLocked = false;

/**
 * Processes a single print job end-to-end:
 *   download → (convert) → validate rules → split by rule → print each → cleanup
 *
 * Enforces a 5-minute hard timeout so a stuck job never blocks the queue.
 * Enforces a hard printer lock so two jobs can never print simultaneously.
 */
export const processJob = async (
  socket: Socket,
  job: PrintJob,
  capabilities: Record<string, PrinterCapabilities> = {}
): Promise<void> => {
  const { orderId } = job;

  // Hard lock: reject immediately rather than silently overlap
  if (printerLocked) {
    const message = "Printer is busy — job rejected by hard lock (should not happen in normal operation)";
    console.error(`[${orderId}] ✗ ${message}`);
    progress(socket, { orderId, step: "error", message });
    socket.emit("print:error", { orderId, message });
    return;
  }
  printerLocked = true;

  const cap         = PRINTER_NAME ? capabilities[PRINTER_NAME] : undefined;
  const jobTempFiles: string[] = [];

  ensureTempDir();

  try {
    await Promise.race([
      runJob(socket, job, jobTempFiles, cap),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Job timed out after 5 minutes (paper jam or printer offline?)")),
          JOB_TIMEOUT_MS
        )
      ),
    ]);

    socket.emit("print:done", { orderId });
    console.log(`[${orderId}] ✓ Print job completed`);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    progress(socket, { orderId, step: "error", message });
    socket.emit("print:error", { orderId, message });
    console.error(`[${orderId}] ✗ Print job failed: ${message}`);

  } finally {
    printerLocked = false;
    // Delete the files we explicitly tracked (covers normal + error paths)
    jobTempFiles.forEach(cleanup);
    // Belt-and-suspenders: remove any orderId-prefixed files that were created
    // after the finally block's snapshot, e.g. when the timeout fired mid-job
    cleanupByOrderId(orderId);
  }
};
