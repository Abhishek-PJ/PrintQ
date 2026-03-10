import { Response } from "express";
import { IOrder } from "../models/Order";
import { Shop } from "../models/Shop";
import { AuthRequest, OrderAction, OrderStatus, PrintRule } from "../types";
import { nextToken } from "../utils/token";
import { emitQueueUpdate, emitToUser } from "../sockets/io";
import { triggerPrintJob } from "../services/print.service";
import { calculatePrice } from "../utils/pricing";
import { uploadToS3, deleteFromS3, getSignedDownloadUrl } from "../utils/s3";

const actionToStatus: Record<OrderAction, OrderStatus> = {
  call: "called",
  print: "printing",
  skip: "skipped",
  complete: "completed"
};

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ message: "Document file is required" });
    return;
  }

  const shopId = req.body.shopId;
  if (!shopId) {
    res.status(400).json({ message: "Shop selection is required" });
    return;
  }

  const shop = await Shop.findById(shopId);
  if (!shop || shop.status !== "approved") {
    res.status(400).json({ message: "Selected shop is not available" });
    return;
  }

  let printRules: PrintRule[] = [];
  try {
    printRules = JSON.parse(req.body.printRules || "[]");
  } catch {
    res.status(400).json({ message: "Invalid print rules" });
    return;
  }

  if (!Array.isArray(printRules) || printRules.length === 0) {
    res.status(400).json({ message: "At least one print rule is required" });
    return;
  }

  const copies = Math.max(1, Number(req.body.copies || 1));
  const paperSize = req.body.paperSize === "A3" ? "A3" : "A4";
  const binding = (["none", "spiral", "staple"].includes(req.body.binding) ? req.body.binding : "none") as "none" | "spiral" | "staple";
  const paymentStatus = req.body.paymentStatus === "paid" ? "paid" : "unpaid";

  const { breakdown, total } = calculatePrice(printRules, copies, shop.pricing);

  const mimeType = file.mimetype || "application/octet-stream";
  const { fileKey, fileUrl } = await uploadToS3(file.buffer, file.originalname, mimeType);

  const token = await nextToken();
  const order = await IOrder.create({
    student: req.user?.userId,
    shop: shopId,
    token,
    originalFileName: file.originalname,
    storedFileName: "",
    filePath: "",
    fileKey,
    fileUrl,
    fileDeleted: false,
    printOptions: {
      printRules,
      copies,
      paperSize,
      binding
    },
    totalPrice: total,
    priceBreakdown: breakdown,
    paymentStatus,
    status: "pending"
  });

  emitQueueUpdate({ type: "ORDER_CREATED", token: order.token, orderId: order._id });

  res.status(201).json({
    message: "Order submitted",
    order: {
      id: order._id,
      token: order.token,
      status: order.status,
      printOptions: order.printOptions,
      totalPrice: order.totalPrice,
      priceBreakdown: order.priceBreakdown,
      paymentStatus: order.paymentStatus,
      originalFileName: order.originalFileName
    }
  });
};

export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  const orders = await IOrder.find({ student: req.user?.userId }).sort({ createdAt: -1 });
  res.json({ orders });
};

export const getQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  const shop = await Shop.findOne({ owner: req.user?.userId });
  if (!shop) {
    res.status(400).json({ message: "No shop registered" });
    return;
  }

  const queue = await IOrder.find({ shop: shop._id, status: { $ne: "completed" } })
    .populate("student", "name email")
    .sort({ token: 1 });

  res.json({ queue });
};

export const getOrderHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status, colorMode, from, to, search } = req.query as {
    status?: OrderStatus | "all";
    colorMode?: "bw" | "color" | "all";
    from?: string;
    to?: string;
    search?: string;
  };

  const shop = await Shop.findOne({ owner: req.user?.userId });
  if (!shop) {
    res.json({ orders: [] });
    return;
  }

  const query: Record<string, unknown> = { shop: shop._id };

  if (status && status !== "all") {
    query.status = status;
  }

  if (colorMode && colorMode !== "all") {
    query["printOptions.colorMode"] = colorMode;
  }

  if (from || to) {
    query.createdAt = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {})
    };
  }

  if (search) {
    query.originalFileName = { $regex: search, $options: "i" };
  }

  const orders = await IOrder.find(query)
    .populate("student", "name email")
    .sort({ createdAt: -1 })
    .limit(300);

  res.json({ orders });
};

export const updateOrderAction = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { action } = req.body as { action: OrderAction };

  if (!action || !(action in actionToStatus)) {
    res.status(400).json({ message: "Invalid action" });
    return;
  }

  const order = await IOrder.findById(id);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  order.status = actionToStatus[action];
  await order.save();

  if (action === "print") {
    await triggerPrintJob(id);
  }

  // Delete file from S3 immediately on completion; skipped files are cleaned up by cron after 1 day
  if (action === "complete" && order.fileKey && !order.fileDeleted) {
    try {
      await deleteFromS3(order.fileKey);
      order.fileDeleted = true;
      await order.save();
    } catch {
      // Non-fatal: file cleanup failure should not block the response
    }
  }

  // Notify the student whose order this is
  const notificationMessages: Partial<Record<typeof action, string>> = {
    call: `📢 Token #${order.token} — You're being called! Please come to the counter.`,
    print: `🖨️ Token #${order.token} — Your document is now being printed.`,
    complete: `✅ Token #${order.token} — Your order is ready! Please collect it.`,
    skip: `⏭️ Token #${order.token} — Your token was skipped. Please check with the shop.`,
  };
  const msg = notificationMessages[action];
  if (msg) {
    emitToUser(String(order.student), "order:notification", { message: msg, status: actionToStatus[action], token: order.token });
  }

  emitQueueUpdate({
    type: "ORDER_UPDATED",
    orderId: order._id,
    token: order.token,
    status: order.status
  });

  res.json({ message: "Order updated", order });
};

export const previewPrice = async (req: AuthRequest, res: Response): Promise<void> => {
  const { printRules, copies, shopId } = req.body as { printRules: PrintRule[]; copies: number; shopId: string };

  if (!Array.isArray(printRules) || printRules.length === 0) {
    res.status(400).json({ message: "At least one print rule is required" });
    return;
  }

  if (!shopId) {
    res.status(400).json({ message: "Shop ID is required for price preview" });
    return;
  }

  const shop = await Shop.findById(shopId);
  if (!shop || shop.status !== "approved") {
    res.status(400).json({ message: "Shop not found or not approved" });
    return;
  }

  const { breakdown, total } = calculatePrice(printRules, Math.max(1, copies || 1), shop.pricing);
  res.json({ breakdown, total });
};

export const markPaid = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const order = await IOrder.findOne({ _id: id, student: req.user?.userId });
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  order.paymentStatus = "paid";
  await order.save();

  emitQueueUpdate({ type: "ORDER_UPDATED", orderId: order._id, token: order.token, status: order.status });
  res.json({ message: "Payment marked as paid", order });
};

export const downloadFile = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const shop = await Shop.findOne({ owner: req.user?.userId });
  if (!shop) {
    res.status(403).json({ message: "Unauthorized" });
    return;
  }

  const order = await IOrder.findOne({ _id: id, shop: shop._id });
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  if (order.fileDeleted || !order.fileKey) {
    res.status(410).json({ message: "File has been deleted" });
    return;
  }

  const url = await getSignedDownloadUrl(order.fileKey, order.originalFileName);
  res.json({ url });
};
