import "dotenv/config";
import { io } from "socket.io-client";
import { listPrinters, detectAllPrinterCapabilities } from "./lib/printer";
import { processJob, purgeStaleFiles } from "./jobs/processJob";
import { PrintJob, PrinterCapabilities } from "./types";

// ── Config ────────────────────────────────────────────────────────────────────
const SERVER_URL   = process.env.SERVER_URL    || "http://localhost:5000";
const AGENT_SECRET = process.env.AGENT_SECRET  || "";
const SHOP_ID      = process.env.SHOP_ID       || "";

if (!AGENT_SECRET || !SHOP_ID) {
  console.error("❌  AGENT_SECRET and SHOP_ID must be set in .env");
  process.exit(1);
}

// ── State ─────────────────────────────────────────────────────────────────────
/** Ensures only one job runs at a time; rules within a job are also sequential */
let busy = false;
const jobQueue: PrintJob[] = [];

/** Populated at connect; passed into processJob for per-printer capability checks */
let printerCapabilities: Record<string, PrinterCapabilities> = {};

const processNext = async (socket: ReturnType<typeof io>) => {
  if (busy || jobQueue.length === 0) return;
  busy = true;
  const job = jobQueue.shift()!;
  try {
    await processJob(socket, job, printerCapabilities);
  } finally {
    busy = false;
    void processNext(socket);
  }
};

// ── Printer refresh ───────────────────────────────────────────────────────────
const PRINTER_REFRESH_MS = 60_000;
let printerRefreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Refreshes printer list and capabilities, then notifies the server.
 * Called on connect and every PRINTER_REFRESH_MS thereafter.
 */
const refreshPrinters = (socket: ReturnType<typeof io>) => {
  const printers = listPrinters();
  const caps     = detectAllPrinterCapabilities();

  // Only update the module-level map and notify if anything changed
  const changed =
    JSON.stringify(Object.keys(caps).sort()) !==
    JSON.stringify(Object.keys(printerCapabilities).sort());

  printerCapabilities = caps;

  if (changed) {
    console.log(`🖨️   Printers updated: ${printers.length ? printers.join(", ") : "(none)"}`);
    Object.values(caps).forEach((c) => {
      console.log(`     ${c.name}: color=${c.color}, duplex=${c.duplex}`);
    });
    socket.emit("agent:ready", {
      printers,
      capabilities: Object.values(caps),
    });
  }
};

// ── Socket connection ─────────────────────────────────────────────────────────
const connect = () => {
  const socket = io(`${SERVER_URL}/agent`, {
    auth: { apiKey: AGENT_SECRET, shopId: SHOP_ID },
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
  });

  socket.on("connect", () => {
    console.log(`✅  Connected to PrintQ server at ${SERVER_URL}`);

    // Clean up any leftover temp files from the previous session / crash
    purgeStaleFiles();

    // Initial detection — always emit agent:ready on (re)connect
    const printers = listPrinters();
    printerCapabilities = detectAllPrinterCapabilities();

    console.log(`🖨️   Printers: ${printers.length ? printers.join(", ") : "(none detected)"}`);
    Object.values(printerCapabilities).forEach((c) => {
      console.log(`     ${c.name}: color=${c.color}, duplex=${c.duplex}`);
    });

    socket.emit("agent:ready", {
      printers,
      capabilities: Object.values(printerCapabilities),
    });

    // Start periodic refresh — clear any previous timer first (reconnect case)
    if (printerRefreshTimer) clearInterval(printerRefreshTimer);
    printerRefreshTimer = setInterval(() => refreshPrinters(socket), PRINTER_REFRESH_MS);
  });

  socket.on("agent:ack", ({ shopId }: { shopId: string }) => {
    console.log(`🏪  Shop registered: ${shopId}`);
  });

  socket.on("print:job", (job: PrintJob) => {
    console.log(`📄  Received job for order #${job.token} (${job.fileName})`);

    // If the agent is currently busy, tell the admin the job is queued
    if (busy) {
      socket.emit("print:progress", {
        orderId: job.orderId,
        step: "queued",
        message: `Waiting behind ${jobQueue.length} other job(s)`,
      });
    }

    jobQueue.push(job);
    void processNext(socket);
  });

  socket.on("connect_error", (err: Error) => {
    console.error(`⚠️   Connection error: ${err.message}`);
  });

  socket.on("disconnect", (reason: string) => {
    console.warn(`🔌  Disconnected: ${reason}. Reconnecting…`);
    // Stop periodic refresh — it restarts on the next connect event
    if (printerRefreshTimer) {
      clearInterval(printerRefreshTimer);
      printerRefreshTimer = null;
    }
  });

  return socket;
};

// ── Startup ───────────────────────────────────────────────────────────────────
console.log("PrintQ Local Print Agent");
console.log(`  Server : ${SERVER_URL}`);
console.log(`  Shop   : ${SHOP_ID}`);
console.log("");

connect();

