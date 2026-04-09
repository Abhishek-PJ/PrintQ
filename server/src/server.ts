import http from "http";
import { Server } from "socket.io";
import { app } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { getAgentStatusForOwner, setSocketServer, setupAgentNamespace } from "./sockets/io";
import { verifyToken } from "./utils/jwt";

const bootstrap = async (): Promise<void> => {
  await connectDB();

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      methods: ["GET", "POST", "PATCH"]
    }
  });

  // Authenticate each user socket connection using the JWT sent from the client
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error("Authentication required"));
    try {
      const payload = verifyToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  setSocketServer(io);

  // Register the /agent namespace for local print agents
  setupAgentNamespace(io);

  io.on("connection", (socket) => {
    // Only allow a user to join their own notification room
    socket.on("join:user", (userId: string) => {
      if (userId && socket.data.userId === userId) {
        void socket.join(`user:${userId}`);
        void (async () => {
          const status = await getAgentStatusForOwner(userId);
          socket.emit("agent:status", status);
        })();
      }
    });
    socket.on("disconnect", () => undefined);
  });

  httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${env.port}`);
  });
};

bootstrap().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

