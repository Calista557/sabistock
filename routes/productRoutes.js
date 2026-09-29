import express from "express";
import {
  createProduct,
  receiveStock,
  recordSale,
  getProducts,
} from "../controllers/productController.js";


const router = express.Router();


router.post("/", createProduct);
router.post("/:id/purchase", receiveStock);
router.post("/:id/sale", recordSale);
router.get("/", getProducts);

router.post("/", createProduct);

router.post("/:id/purchase", receiveStock);

router.post("/:id/purchase", receiveStock);

router.get("/", getProducts);

export default router;

