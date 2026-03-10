import { Server } from "socket.io";

let io: Server | null = null;

export const setSocketServer = (socketServer: Server): void => {
  io = socketServer;
};

export const emitQueueUpdate = (payload: unknown): void => {
  if (io) {
    io.emit("queue:update", payload);
  }
};

export const emitToUser = (userId: string, event: string, payload: unknown): void => {
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
};
