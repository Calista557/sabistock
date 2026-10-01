import express from "express";

import {
  createProduct,
  receiveStock,
  recordSale,
  getProducts,
  getProductMovements,
  updateProduct,
} from "../controllers/productController.js";

import { requireLogin, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.post("/", requireRole("owner", "manager"), createProduct);

router.post("/:id/purchase", receiveStock);

router.post("/:id/sale", recordSale);

router.get("/", getProducts);

router.get("/:id/movements", getProductMovements);

router.patch(
  "/:id",
  requireRole("owner", "manager"),
  updateProduct,
);

export default router;