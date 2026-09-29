import express from "express";
import { createProduct, receiveStock } from "../controllers/productController.js";

const router = express.Router();

router.post("/", createProduct);

router.post("/:id/purchase", receiveStock);

router.post("/:id/purchase", receiveStock);

export default router;

