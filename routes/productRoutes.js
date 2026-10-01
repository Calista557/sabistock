import express from "express";
import {
  createProduct,
  receiveStock,
  recordSale,
  getProducts,
  getProductMovements,
  updateProduct,
} from "../controllers/productController.js";
import { requireLogin } from "../middleware/auth.js";

const router = express.Router();

router.use(requireLogin);

router.post("/", createProduct);
router.post("/:id/purchase", receiveStock);
router.post("/:id/sale", recordSale);
router.get("/", getProducts);

router.post("/", createProduct);

router.post("/:id/purchase", receiveStock);

router.post("/:id/purchase", receiveStock);

router.get("/", getProducts);

router.get("/:id/movements", getProductMovements);

router.patch("/:id", updateProduct);

export default router;

