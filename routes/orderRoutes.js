import express from "express";
import {
  createOrder,
  getOrder,
  addPayment,
  voidOrder,
} from "../controllers/orderController.js";
import { requireLogin, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.post("/", createOrder);
router.get("/:id", getOrder);
router.post("/:id/payments", addPayment);
router.patch(
  "/:id/void",
  requireRole("owner", "manager"),
  voidOrder,
);

export default router;