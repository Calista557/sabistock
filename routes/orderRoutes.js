import express from "express";
import {
  createOrder,
  getOrder,
  addPayment,
  voidOrder,
  getDailySalesSummary,
  getProfitReport,
  getOrders,
} from "../controllers/orderController.js";
import { requireLogin, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.get("/", getOrders);
router.get("/daily-summary", getDailySalesSummary);
router.get("/profit", getProfitReport);
router.post("/", createOrder);
router.get("/:id", getOrder);
router.post("/:id/payments", addPayment);
router.patch(
  "/:id/void",
  requireRole("owner", "manager"),
  voidOrder,
);

export default router;