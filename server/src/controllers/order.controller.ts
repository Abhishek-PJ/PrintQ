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

const validatePrintRules = (rules: PrintRule[], documentPageCount?: number): string | null => {
  if (!Array.isArray(rules) || rules.length === 0) {
    return "At least one print rule is required";
  }

  const seen = new Map<string, number>();
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    const from = Number(r.fromPage);
    const to = Number(r.toPage);

    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
      return `Rule ${i + 1} has an invalid page range`;
    }
    if (documentPageCount && (from > documentPageCount || to > documentPageCount)) {
      return `Rule ${i + 1} exceeds document length (${documentPageCount} pages)`;
    }

    const signature = `${from}-${to}-${r.colorMode}-${r.sided}`;
    const firstSeenAt = seen.get(signature);
    if (firstSeenAt !== undefined) {
      return `Rule ${i + 1} duplicates Rule ${firstSeenAt + 1}`;
    }
    seen.set(signature, i);
  }

  return null;
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

  const rawPageCount = Number(req.body.documentPageCount);
  const documentPageCount = Number.isInteger(rawPageCount) && rawPageCount > 0 ? rawPageCount : undefined;
  const ruleValidationError = validatePrintRules(printRules, documentPageCount);
  if (ruleValidationError) {
    res.status(400).json({ message: ruleValidationError });
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
    documentPageCount,
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
      ,documentPageCount: order.documentPageCount
    }
  });
};

export const getMyOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  const orders = await IOrder.find({ student: req.user?.userId })
    .populate("shop", "name")
    .sort({ createdAt: -1 });
  res.json({ orders });
};

export const getQueue = async (req: AuthRequest, res: Response): Promise<void> => {
  const shop = await Shop.findOne({ owner: req.user?.userId });
  if (!shop) {
    res.status(400).json({ message: "No shop registered" });
    return;
  }

  const queue = await IOrder.find({ shop: shop._id, status: { $nin: ["completed", "skipped"] } })
    .populate("student", "name email mobile phone")
    .sort({ priority: -1, createdAt: 1 });

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
    .populate("student", "name email mobile phone")
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
    try {
      await triggerPrintJob(id);
    } catch (err) {
      // Revert the status change so the admin can retry
      order.status = "called";
      await order.save();
      emitQueueUpdate({ type: "ORDER_UPDATED", orderId: order._id, token: order.token, status: order.status });
      const message =
        (err as Error).message === "AGENT_OFFLINE"
          ? "Print agent is offline. Make sure the PrintQ Agent is running on the shop computer."
          : "Failed to dispatch print job. Please try again.";
      res.status(503).json({ message });
      return;
    }
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

export const getOrderQueueStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const order = await IOrder.findOne({ _id: id, student: req.user?.userId });
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  const isActive = order.status !== "completed" && order.status !== "skipped";
  if (!isActive) {
    res.json({ inQueue: false, position: 0, ordersAhead: 0, estimatedMinutes: 0, totalInQueue: 0 });
    return;
  }

  const activeQueue = await IOrder.find({
    shop: order.shop,
    status: { $nin: ["completed", "skipped"] },
  }).sort({ priority: -1, createdAt: 1 });

  const index = activeQueue.findIndex((o) => String(o._id) === String(id));
  const ordersAhead = index < 0 ? 0 : index;

  let etaMinutes = 0;
  for (let i = 0; i < ordersAhead; i++) {
    const o = activeQueue[i];
    etaMinutes += 1; // 1 min setup per order
    for (const rule of o.printOptions.printRules) {
      const pages = (rule.toPage - rule.fromPage + 1) * o.printOptions.copies;
      etaMinutes += rule.colorMode === "bw" ? pages * (5 / 60) : pages * (10 / 60);
    }
  }

  res.json({
    inQueue: true,
    position: index < 0 ? activeQueue.length + 1 : index + 1,
    ordersAhead,
    estimatedMinutes: Math.ceil(etaMinutes),
    totalInQueue: activeQueue.length,
  });
};

export const editOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const order = await IOrder.findOne({ _id: id, student: req.user?.userId }).populate("shop", "name");
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  if (order.status !== "pending") {
    res.status(400).json({ message: "Order can only be edited while it is pending" });
    return;
  }

  const { printRules, copies, paperSize, binding } = req.body as {
    printRules?: PrintRule[];
    copies?: number;
    paperSize?: "A4" | "A3";
    binding?: "none" | "spiral" | "staple";
  };

  if (printRules !== undefined) {
    const ruleValidationError = validatePrintRules(printRules, order.documentPageCount);
    if (ruleValidationError) {
      res.status(400).json({ message: ruleValidationError });
      return;
    }
    order.printOptions.printRules = printRules;
  }
  if (copies !== undefined) order.printOptions.copies = Math.max(1, Number(copies));
  if (paperSize !== undefined && ["A4", "A3"].includes(paperSize)) order.printOptions.paperSize = paperSize;
  if (binding !== undefined && ["none", "spiral", "staple"].includes(binding)) order.printOptions.binding = binding;

  const shop = await Shop.findById(order.shop);
  if (shop) {
    const { breakdown, total } = calculatePrice(order.printOptions.printRules, order.printOptions.copies, shop.pricing);
    order.totalPrice = total;
    order.priceBreakdown = breakdown;
  }

  await order.save();
  emitQueueUpdate({ type: "ORDER_UPDATED", orderId: order._id, token: order.token, status: order.status });
  res.json({ message: "Order updated", order });
};

export const deleteOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const order = await IOrder.findOne({ _id: id, student: req.user?.userId });
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  if (order.status !== "pending") {
    res.status(400).json({ message: "Order can only be deleted while it is pending" });
    return;
  }

  if (order.fileKey && !order.fileDeleted) {
    try { await deleteFromS3(order.fileKey); } catch { /* non-fatal */ }
  }

  emitQueueUpdate({ type: "ORDER_UPDATED", orderId: order._id, token: order.token, status: order.status });
  await order.deleteOne();
  res.json({ message: "Order deleted" });
};

export const setPriorityOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { priority } = req.body as { priority?: boolean };

  const shop = await Shop.findOne({ owner: req.user?.userId });
  if (!shop) {
    res.status(400).json({ message: "No shop registered" });
    return;
  }

  const order = await IOrder.findOne({ _id: id, shop: shop._id });
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }

  if (order.status === "completed" || order.status === "skipped") {
    res.status(400).json({ message: "Cannot prioritize a completed or skipped order" });
    return;
  }

  order.priority = priority !== false;
  await order.save();
  emitQueueUpdate({ type: "ORDER_UPDATED", orderId: order._id, token: order.token, status: order.status });
  res.json({ message: order.priority ? "Order marked as priority" : "Priority removed", order });
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
