import { Router } from "express";
import { login, me, register } from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, me);

export default router;
