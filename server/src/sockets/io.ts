import { Server, Socket } from "socket.io";
import { Types } from "mongoose";
import { Shop } from "../models/Shop";
import { IOrder } from "../models/Order";
import { PrintJob, PrintProgress } from "../types";
import { verifyAgentSecret } from "../utils/agentSecret";
import { deleteFromS3 } from "../utils/s3";

let io: Server | null = null;

type AgentHealthState = "online" | "reconnecting" | "degraded";

interface AgentHealth {
  state: AgentHealthState;
  message: string;
  at: string;
}

// shopId → connected agent socket
const agentSockets = new Map<string, Socket>();
// shopId → last reported printer names from agent
const agentPrinters = new Map<string, string[]>();
// shopId → last reported health state from agent
const agentHealth = new Map<string, AgentHealth>();
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
): Promise<{ online: boolean; printers: string[]; health: AgentHealth | null }> => {
  const shops = await Shop.find({ owner: ownerId, status: "approved" })
    .select("_id")
    .lean<Array<{ _id: unknown }>>();

  for (const shop of shops) {
    const shopId = String(shop._id);
    if (agentSockets.has(shopId)) {
      return {
        online: true,
        printers: agentPrinters.get(shopId) ?? [],
        health: agentHealth.get(shopId) ?? {
          state: "online",
          message: "Connected to server",
          at: new Date().toISOString(),
        },
      };
    }
  }

  return {
    online: false,
    printers: [],
    health: {
      state: "degraded",
      message: "Agent offline",
      at: new Date().toISOString(),
    },
  };
};

/**
 * Sets up the /agent Socket.IO namespace.
 * Must be called after setSocketServer().
 */
export const setupAgentNamespace = (serverIo: Server): void => {
  const agentNs = serverIo.of("/agent");

  const resolveShopForAgentAuth = async (shopOrOwnerId: string) => {
    const projection = "owner status name +agentSecretHash";

    const byShopId = await Shop.findById(shopOrOwnerId)
      .select(projection)
      .lean<{ owner: unknown; status?: string; name: string; agentSecretHash?: string }>();
    if (byShopId) return byShopId;

    if (!Types.ObjectId.isValid(shopOrOwnerId)) return null;
    const byOwnerId = await Shop.findOne({ owner: new Types.ObjectId(shopOrOwnerId) })
      .select(projection)
      .lean<{ owner: unknown; status?: string; name: string; agentSecretHash?: string }>();

    return byOwnerId;
  };

  // Authenticate agent connections via per-shop secret + shopId
  agentNs.use((socket, next) => {
    void (async () => {
      const auth = socket.handshake.auth as { apiKey?: string; shopId?: string };
      if (!auth.apiKey || !auth.shopId) {
        next(new Error("Missing agent credentials"));
        return;
      }

      const shop = await resolveShopForAgentAuth(auth.shopId);

      const isApproved = String(shop?.status ?? "").toLowerCase() === "approved";

      if (!shop || !isApproved) {
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
      socket.data.shopName = shop.name;
      next();
    })().catch(() => next(new Error("Agent authentication failed")));
  });

  agentNs.on("connection", (socket) => {
    const shopId = socket.data.shopId as string;
    agentSockets.set(shopId, socket);
    agentHealth.set(shopId, {
      state: "online",
      message: "Connected to server",
      at: new Date().toISOString(),
    });
    const shopName = socket.data.shopName as string | undefined;
    console.log(`[agent] connected for shop ${shopName ?? shopId}`);

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
        socket.emit("agent:ack", { shopId, shopName: socket.data.shopName ?? null });
        if (io) {
          io.to(`user:${ownerId}`).emit("agent:status", {
            online: true,
            printers,
            health: agentHealth.get(shopId) ?? null,
          });
        }
      } catch (err) {
        console.error("[agent] failed to notify owner:", err);
      }
    };

    socket.on("agent:ready", ({ printers }: { printers: string[] }) => {
      agentPrinters.set(shopId, printers ?? []);
      void notifyOwner(printers);
    });

    socket.on("agent:health", (data: { state?: AgentHealthState; message?: string; at?: string }) => {
      const health: AgentHealth = {
        state: data.state ?? "degraded",
        message: data.message ?? "Unknown health state",
        at: data.at ?? new Date().toISOString(),
      };
      agentHealth.set(shopId, health);

      const ownerId = shopOwnerCache.get(shopId);
      if (ownerId && io) {
        io.to(`user:${ownerId}`).emit("agent:health", {
          shopId,
          online: agentSockets.has(shopId),
          printers: agentPrinters.get(shopId) ?? [],
          health,
        });
      }
    });

    // Forward print progress to the shop owner's admin socket
    const forward = (event: string) => {
      socket.on(event, (data: Record<string, unknown>) => {
        const ownerId = shopOwnerCache.get(shopId);
        if (ownerId && io) io.to(`user:${ownerId}`).emit(event, data);
      });
    };
    forward("print:progress");
    forward("print:error");
    forward("print:warning");

    socket.on("print:done", (data: { orderId?: string }) => {
      const ownerId = shopOwnerCache.get(shopId);
      if (ownerId && io) io.to(`user:${ownerId}`).emit("print:done", data);

      void (async () => {
        const orderId = data?.orderId;
        if (!orderId) return;

        const order = await IOrder.findOne({ _id: orderId, shop: shopId });
        if (!order) return;
        if (order.status === "completed" || order.status === "skipped") return;

        order.status = "completed";

        // Mirror existing completion behavior: clean up source file once done.
        if (order.fileKey && !order.fileDeleted) {
          try {
            await deleteFromS3(order.fileKey);
            order.fileDeleted = true;
          } catch {
            // Non-fatal: status update should still proceed.
          }
        }

        await order.save();

        emitToUser(String(order.student), "order:notification", {
          message: `✅ Token #${order.token} — Your order is ready! Please collect it.`,
          status: "completed",
          token: order.token,
        });

        emitQueueUpdate({
          type: "ORDER_UPDATED",
          orderId: order._id,
          token: order.token,
          status: order.status,
        });
      })();
    });

    socket.on("disconnect", () => {
      agentSockets.delete(shopId);
      agentPrinters.delete(shopId);
      agentHealth.delete(shopId);
      const shopName = socket.data.shopName as string | undefined;
      console.log(`[agent] disconnected for shop ${shopName ?? shopId}`);
      const ownerId = shopOwnerCache.get(shopId);
      if (ownerId && io) {
        io.to(`user:${ownerId}`).emit("agent:status", {
          online: false,
          printers: [],
          health: {
            state: "degraded",
            message: "Agent disconnected",
            at: new Date().toISOString(),
          },
        });
      }
    });
  });
};

// Re-export for use in print.service.ts
export type { PrintJob, PrintProgress };
