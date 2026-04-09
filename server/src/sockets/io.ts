import { Server, Socket } from "socket.io";
import { Shop } from "../models/Shop";
import { PrintJob, PrintProgress } from "../types";
import { verifyAgentSecret } from "../utils/agentSecret";

let io: Server | null = null;

// shopId → connected agent socket
const agentSockets = new Map<string, Socket>();
// shopId → last reported printer names from agent
const agentPrinters = new Map<string, string[]>();
// shopId → shop owner userId (cached after first lookup)
const shopOwnerCache = new Map<string, string>();

export const setSocketServer = (socketServer: Server): void => {
  io = socketServer;
};

export const emitQueueUpdate = (payload: unknown): void => {
  if (io) io.emit("queue:update", payload);
};

export const emitToUser = (userId: string, event: string, payload: unknown): void => {
  if (io) io.to(`user:${userId}`).emit(event, payload);
};

/** Returns true if a print agent is currently connected for the given shopId */
export const isAgentOnline = (shopId: string): boolean => agentSockets.has(shopId);

/**
 * Dispatches a print job to the agent connected for the given shop.
 * Returns false if no agent is connected.
 */
export const dispatchPrintJob = (shopId: string, job: PrintJob): boolean => {
  const agentSocket = agentSockets.get(shopId);
  if (!agentSocket) return false;
  agentSocket.emit("print:job", job);
  return true;
};

/**
 * Returns current aggregate agent status for a shop owner.
 * If owner has multiple approved shops, online=true when any owned shop agent is connected.
 */
export const getAgentStatusForOwner = async (
  ownerId: string,
): Promise<{ online: boolean; printers: string[] }> => {
  const shops = await Shop.find({ owner: ownerId, status: "approved" })
    .select("_id")
    .lean<Array<{ _id: unknown }>>();

  for (const shop of shops) {
    const shopId = String(shop._id);
    if (agentSockets.has(shopId)) {
      return { online: true, printers: agentPrinters.get(shopId) ?? [] };
    }
  }

  return { online: false, printers: [] };
};

/**
 * Sets up the /agent Socket.IO namespace.
 * Must be called after setSocketServer().
 */
export const setupAgentNamespace = (serverIo: Server): void => {
  const agentNs = serverIo.of("/agent");

  // Authenticate agent connections via per-shop secret + shopId
  agentNs.use((socket, next) => {
    void (async () => {
      const auth = socket.handshake.auth as { apiKey?: string; shopId?: string };
      if (!auth.apiKey || !auth.shopId) {
        next(new Error("Missing agent credentials"));
        return;
      }

      const shop = await Shop.findById(auth.shopId)
        .select("owner status +agentSecretHash")
        .lean<{ owner: unknown; status: string; agentSecretHash?: string }>();

      if (!shop || shop.status !== "approved") {
        next(new Error("Shop not approved or not found"));
        return;
      }
      if (!shop.agentSecretHash) {
        next(new Error("Agent secret is not configured for this shop"));
        return;
      }

      const valid = await verifyAgentSecret(auth.apiKey, shop.agentSecretHash);
      if (!valid) {
        next(new Error("Invalid agent secret"));
        return;
      }

      socket.data.shopId = auth.shopId;
      socket.data.ownerId = String(shop.owner);
      next();
    })().catch(() => next(new Error("Agent authentication failed")));
  });

  agentNs.on("connection", (socket) => {
    const shopId = socket.data.shopId as string;
    agentSockets.set(shopId, socket);
    console.log(`[agent] connected for shop ${shopId}`);

    /** Look up the shop owner once and notify them that the agent is online */
    const notifyOwner = async (printers: string[]) => {
      try {
        let ownerId = shopOwnerCache.get(shopId) || (socket.data.ownerId as string | undefined);
        if (!ownerId) {
          const shop = await Shop.findById(shopId).select("owner").lean();
          if (!shop) return;
          ownerId = String(shop.owner);
        }
        shopOwnerCache.set(shopId, ownerId);
        socket.emit("agent:ack", { shopId });
        if (io) io.to(`user:${ownerId}`).emit("agent:status", { online: true, printers });
      } catch (err) {
        console.error("[agent] failed to notify owner:", err);
      }
    };

    socket.on("agent:ready", ({ printers }: { printers: string[] }) => {
      agentPrinters.set(shopId, printers ?? []);
      void notifyOwner(printers);
    });

    // Forward print progress to the shop owner's admin socket
    const forward = (event: string) => {
      socket.on(event, (data: Record<string, unknown>) => {
        const ownerId = shopOwnerCache.get(shopId);
        if (ownerId && io) io.to(`user:${ownerId}`).emit(event, data);
      });
    };
    forward("print:progress");
    forward("print:done");
    forward("print:error");
    forward("print:warning");

    socket.on("disconnect", () => {
      agentSockets.delete(shopId);
      agentPrinters.delete(shopId);
      console.log(`[agent] disconnected for shop ${shopId}`);
      const ownerId = shopOwnerCache.get(shopId);
      if (ownerId && io) {
        io.to(`user:${ownerId}`).emit("agent:status", { online: false, printers: [] });
      }
    });
  });
};

// Re-export for use in print.service.ts
export type { PrintJob, PrintProgress };
