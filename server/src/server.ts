import http from "http";
import { Server } from "socket.io";
import { app } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { setSocketServer } from "./sockets/io";

const bootstrap = async (): Promise<void> => {
  await connectDB();

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      methods: ["GET", "POST", "PATCH"]
    }
  });

  setSocketServer(io);

  io.on("connection", (socket) => {
    // Students join a personal room so the server can send targeted notifications
    socket.on("join:user", (userId: string) => {
      if (userId) void socket.join(`user:${userId}`);
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
