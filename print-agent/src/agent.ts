import "dotenv/config";
import { io } from "socket.io-client";
import { listPrinters, detectAllPrinterCapabilities } from "./lib/printer";
import { processJob, purgeStaleFiles } from "./jobs/processJob";
import { PrintJob, PrinterCapabilities } from "./types";

// ── Config ────────────────────────────────────────────────────────────────────
const rawServerUrl = process.env.SERVER_URL || "http://localhost:5000";
const SERVER_URL = rawServerUrl.replace(/\/+$/, "");
const AGENT_SECRET = process.env.AGENT_SECRET  || "";
const SHOP_ID      = process.env.SHOP_ID       || "";
const RECONNECT_DELAY_MS = 2_000;
const RECONNECT_DELAY_MAX_MS = 20_000;
const RECONNECT_RANDOMIZATION = 0.5;

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
let lastKnownPrinters: string[] = [];

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

const estimateReconnectDelay = (attempt: number): { min: number; max: number } => {
  const base = Math.min(RECONNECT_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1)), RECONNECT_DELAY_MAX_MS);
  const jitter = Math.floor(base * RECONNECT_RANDOMIZATION);
  return {
    min: Math.max(0, base - jitter),
    max: base + jitter,
  };
};

const emitHealth = (
  socket: ReturnType<typeof io>,
  state: "online" | "reconnecting" | "degraded",
  message: string
) => {
  socket.emit("agent:health", {
    shopId: SHOP_ID,
    state,
    message,
    at: new Date().toISOString(),
  });
};

const detectPrintersStable = (): { printers: string[]; caps: Record<string, PrinterCapabilities> } => {
  const printers = listPrinters();
  const caps = detectAllPrinterCapabilities();
  const hasProbeData = printers.length > 0 || Object.keys(caps).length > 0;
  const hasPreviousData =
    lastKnownPrinters.length > 0 || Object.keys(printerCapabilities).length > 0;

  if (!hasProbeData && hasPreviousData) {
    console.warn("⚠️   Printer probe returned empty; keeping last known printer list/capabilities");
    return { printers: [...lastKnownPrinters], caps: { ...printerCapabilities } };
  }

  return { printers, caps };
};

/**
 * Refreshes printer list and capabilities, then notifies the server.
 * Called on connect and every PRINTER_REFRESH_MS thereafter.
 */
const refreshPrinters = (socket: ReturnType<typeof io>) => {
  const { printers, caps } = detectPrintersStable();

  // Only update the module-level map and notify if anything changed
  const nextSignature = JSON.stringify({
    printers: [...printers].sort(),
    caps: Object.values(caps)
      .map((c) => ({ name: c.name, color: c.color, duplex: c.duplex, paperSizes: [...c.paperSizes].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
  const prevSignature = JSON.stringify({
    printers: [...lastKnownPrinters].sort(),
    caps: Object.values(printerCapabilities)
      .map((c) => ({ name: c.name, color: c.color, duplex: c.duplex, paperSizes: [...c.paperSizes].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });

  const changed = nextSignature !== prevSignature;
  printerCapabilities = caps;
  lastKnownPrinters = printers;

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
    reconnectionDelay: RECONNECT_DELAY_MS,
    reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
    randomizationFactor: RECONNECT_RANDOMIZATION,
    reconnectionAttempts: Infinity,
  });

  socket.on("connect", () => {
    console.log(`✅  Connected to PrintQ server at ${SERVER_URL}`);
    emitHealth(socket, "online", "Connected to server");

    // Clean up any leftover temp files from the previous session / crash
    purgeStaleFiles();

    // Initial detection — always emit agent:ready on (re)connect
    const detected = detectPrintersStable();
    const printers = detected.printers;
    printerCapabilities = detected.caps;
    lastKnownPrinters = printers;

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
    emitHealth(socket, "degraded", `Connection error: ${err.message}`);
  });

  socket.on("disconnect", (reason: string) => {
    console.warn(`🔌  Disconnected: ${reason}. Reconnecting…`);
    emitHealth(socket, "reconnecting", `Disconnected: ${reason}`);
    // Stop periodic refresh — it restarts on the next connect event
    if (printerRefreshTimer) {
      clearInterval(printerRefreshTimer);
      printerRefreshTimer = null;
    }
  });

  socket.io.on("reconnect_attempt", (attempt: number) => {
    const window = estimateReconnectDelay(attempt);
    const msg = `Reconnect attempt ${attempt} (next delay ${window.min}-${window.max} ms)`;
    console.warn(`🔁  ${msg}`);
    emitHealth(socket, "reconnecting", msg);
  });

  socket.io.on("reconnect_error", (err: Error) => {
    const msg = `Reconnect failed: ${err.message}`;
    console.error(`⚠️   ${msg}`);
    emitHealth(socket, "degraded", msg);
  });

  socket.io.on("reconnect_failed", () => {
    const msg = "Reconnect attempts exhausted";
    console.error(`❌  ${msg}`);
    emitHealth(socket, "degraded", msg);
  });

  return socket;
};

// ── Startup ───────────────────────────────────────────────────────────────────
console.log("PrintQ Local Print Agent");
console.log(`  Server : ${SERVER_URL}`);
console.log(`  Shop   : ${SHOP_ID}`);
console.log("");

connect();

