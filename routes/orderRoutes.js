import express from "express";
import { createOrder, getOrder } from "../controllers/orderController.js";
import { requireLogin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.post("/", createOrder);
router.get("/:id", getOrder);

export default router;