import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { getCurrentStock } from "../utils/stock.js";

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
