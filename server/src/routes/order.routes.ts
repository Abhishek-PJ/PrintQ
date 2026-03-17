import { Router } from "express";
import {
  createOrder,
  getOrderHistory,
  getMyOrders,
  getQueue,
  updateOrderAction,
  previewPrice,
  markPaid,
  downloadFile,
  getOrderQueueStatus,
  editOrder,
  deleteOrder,
  setPriorityOrder,
} from "../controllers/order.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.post("/", protect, authorize("student"), upload.single("document"), createOrder);
router.post("/preview-price", protect, authorize("student"), previewPrice);
router.get("/my", protect, authorize("student"), getMyOrders);
router.get("/queue", protect, authorize("admin"), getQueue);
router.get("/history", protect, authorize("admin"), getOrderHistory);
router.patch("/:id/pay", protect, authorize("student"), markPaid);
router.get("/:id/queue-status", protect, authorize("student"), getOrderQueueStatus);
router.patch("/:id/edit", protect, authorize("student"), editOrder);
router.delete("/:id", protect, authorize("student"), deleteOrder);
router.patch("/:id/action", protect, authorize("admin"), updateOrderAction);
router.patch("/:id/priority", protect, authorize("admin"), setPriorityOrder);
router.get("/:id/download", protect, authorize("admin"), downloadFile);

export default router;
