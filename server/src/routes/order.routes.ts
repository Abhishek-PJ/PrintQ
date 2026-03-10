import { Router } from "express";
import {
  createOrder,
  getOrderHistory,
  getMyOrders,
  getQueue,
  updateOrderAction,
  previewPrice,
  markPaid,
  downloadFile
} from "../controllers/order.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";

const router = Router();

router.post("/", protect, authorize("student"), upload.single("document"), createOrder);
router.post("/preview-price", protect, authorize("student"), previewPrice);
router.patch("/:id/pay", protect, authorize("student"), markPaid);
router.get("/my", protect, authorize("student"), getMyOrders);
router.get("/queue", protect, authorize("admin"), getQueue);
router.get("/history", protect, authorize("admin"), getOrderHistory);
router.patch("/:id/action", protect, authorize("admin"), updateOrderAction);
router.get("/:id/download", protect, authorize("admin"), downloadFile);

export default router;
