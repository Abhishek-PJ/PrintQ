import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes";
import orderRoutes from "./routes/order.routes";
import shopRoutes from "./routes/shop.routes";
import superadminRoutes from "./routes/superadmin.routes";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/error.middleware";
import { startCleanupJob } from "./jobs/cleanup";

export const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://printq.vercel.app"
  ],
  credentials: true
}));
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

startCleanupJob();

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/superadmin", superadminRoutes);

app.use(notFound);
app.use(errorHandler);
