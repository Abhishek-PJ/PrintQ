import { IOrder } from "../models/Order";
import { getSignedDownloadUrl } from "../utils/s3";
import { isAgentOnline, dispatchPrintJob } from "../sockets/io";
import { PrintJob } from "../types";

/**
 * Builds a print job from an order and dispatches it to the shop's local print agent.
 * Throws an Error with message 'AGENT_OFFLINE' if no agent is connected.
 */
export const triggerPrintJob = async (orderId: string): Promise<void> => {
  const order = await IOrder.findById(orderId);
  if (!order) {
    throw new Error("Order not found for print trigger");
  }

  const shopId = String(order.shop);

  if (!isAgentOnline(shopId)) {
    throw new Error("AGENT_OFFLINE");
  }

  // Generate a short-lived presigned URL (5 min) so the agent can download the file
  const fileUrl = await getSignedDownloadUrl(order.fileKey, order.originalFileName);

  const job: PrintJob = {
    orderId: String(order._id),
    fileUrl,
    fileName: order.originalFileName,
    printOptions: {
      printRules: order.printOptions.printRules,
      copies: order.printOptions.copies,
      paperSize: order.printOptions.paperSize,
      binding: order.printOptions.binding,
    },
    token: order.token,
  };

  const dispatched = dispatchPrintJob(shopId, job);
  if (!dispatched) {
    throw new Error("AGENT_OFFLINE");
  }
};

