import { Router } from "express";
import { getApprovedShops, getMyShop, registerShop, updateShopPricing } from "../controllers/shop.controller";
import { authorize, protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/register",  protect, authorize("admin"),   registerShop);
router.get("/mine",       protect, authorize("admin"),   getMyShop);
router.patch("/pricing",  protect, authorize("admin"),   updateShopPricing);
router.get("/approved",   protect, authorize("student"), getApprovedShops);

export default router;
