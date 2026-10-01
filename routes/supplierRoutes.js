import express from "express";

import {
  createSupplier,
  getSuppliers,
} from "../controllers/supplierController.js";

import { requireLogin, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.post(
  "/",
  requireRole("owner"),
  createSupplier,
);

router.get("/", getSuppliers);

export default router;