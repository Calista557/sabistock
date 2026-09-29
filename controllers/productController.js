import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { getCurrentStock } from "../utils/stock.js";
import mongoose from "mongoose";

export const createProduct = async (req, res) => {
  try {
    const { name, barcode, costPrice, sellingPrice, minStock, openingStock } =
      req.body;

    const product = await Product.create({
      name,
      barcode,
      costPrice,
      sellingPrice,
      minStock,
    });

    if (openingStock > 0) {
      try {
        await StockMovement.create({
          product: product._id,
          type: "opening",
          quantity: openingStock,
          note: "Opening stock",
        });
      } catch (err) {
        await Product.findByIdAndDelete(product._id);
        throw err;
      }
    }

    const currentStock = await getCurrentStock(product._id);

    res.status(201).json({ product, currentStock });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const receiveStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, note } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await StockMovement.create({
      product: product._id,
      type: "purchase",
      quantity,
      note,
    });

    const currentStock = await getCurrentStock(product._id);

    res.status(201).json({ product: product.name, currentStock });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};