import { Router } from "express";
import {
  getAllOrders,
  getAllShops,
  getAllUsers,
  setUserRole,
  updateShopStatus,
  rotateShopAgentSecret,
  deleteUser,
  updateUser,
  deleteShop,
  updateShop,
} from "../controllers/superadmin.controller";
import { authorize, protect } from "../middleware/auth.middleware";

const router = Router();

router.get("/shops", protect, authorize("superadmin"), getAllShops);
router.patch("/shops/:id/status", protect, authorize("superadmin"), updateShopStatus);
router.patch("/shops/:id/agent-secret", protect, authorize("superadmin"), rotateShopAgentSecret);
router.patch("/shops/:id", protect, authorize("superadmin"), updateShop);
router.delete("/shops/:id", protect, authorize("superadmin"), deleteShop);

router.get("/users", protect, authorize("superadmin"), getAllUsers);
router.patch("/users/:id/role", protect, authorize("superadmin"), setUserRole);
router.patch("/users/:id", protect, authorize("superadmin"), updateUser);
router.delete("/users/:id", protect, authorize("superadmin"), deleteUser);

router.get("/orders", protect, authorize("superadmin"), getAllOrders);

export default router;
