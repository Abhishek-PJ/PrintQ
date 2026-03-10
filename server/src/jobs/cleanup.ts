import cron from "node-cron";
import { IOrder } from "../models/Order";
import { deleteFromS3 } from "../utils/s3";

/**
 * Runs every hour. Deletes S3 files for orders that were skipped
 * more than 24 hours ago and whose files have not yet been deleted.
 */
export const startCleanupJob = (): void => {
  cron.schedule("0 * * * *", async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const orders = await IOrder.find({
        status: "skipped",
        fileDeleted: false,
        fileKey: { $ne: "" },
        updatedAt: { $lte: oneDayAgo }
      });

      for (const order of orders) {
        try {
          await deleteFromS3(order.fileKey);
          order.fileDeleted = true;
          await order.save();
        } catch {
          // Continue with remaining orders even if one fails
        }
      }
    } catch {
      // Silently handle errors to keep the cron alive
    }
  });
};
