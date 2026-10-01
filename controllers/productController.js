import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { getCurrentStock } from "../utils/stock.js";
import mongoose from "mongoose";
import Supplier from "../models/Supplier.js";

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
    const { quantity, note, supplierId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
if (supplierId) {
  if (!mongoose.isValidObjectId(supplierId)) {
    return res.status(400).json({
      message: "Invalid supplier id",
    });
  }

  const supplier = await Supplier.findOne({
    _id: supplierId,
    active: true,
  });

  if (!supplier) {
    return res.status(404).json({
      message: "Supplier not found",
    });
  }
}

    await StockMovement.create({
      product: product._id,
      type: "purchase",
      quantity,
      note,
      supplier: supplierId, 
      recordedBy: req.employee._id,
    });

    const currentStock = await getCurrentStock(product._id);

    res.status(201).json({ product: product.name, currentStock });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find()
  .select(
    req.employee.role === "cashier"
      ? "-costPrice"
      : "+costPrice",
  )
  .sort({ name: 1 });

    const stockTotals = await StockMovement.aggregate([
      { $group: { _id: "$product", total: { $sum: "$quantity" } } },
    ]);

    const stockById = {};
    stockTotals.forEach((item) => {
      stockById[item._id.toString()] = item.total;
    });

    const result = products.map((product) => {
      const currentStock = stockById[product._id.toString()] || 0;
      return {
        ...product.toObject(),
        currentStock,
        lowStock: currentStock <= product.minStock,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const recordSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, note } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Sale quantity must be a positive whole number" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const available = await getCurrentStock(product._id);
    if (quantity > available) {
      return res
        .status(400)
        .json({ message: `Not enough stock. Available: ${available}` });
    }

  

    await StockMovement.create({
      product: product._id,
      type: "sale",
      quantity: -quantity,
      note,
      recordedBy: req.employee._id,
    });

    const currentStock = await getCurrentStock(product._id);

    res.status(201).json({ product: product.name, currentStock });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getProductMovements = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const movements = await StockMovement.find({ product: product._id }).sort({
      createdAt: -1,
    });

    const currentStock = await getCurrentStock(product._id);

    res.json({ product: product.name, currentStock, movements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const allowedFields = [
      "name",
      "barcode",
      "costPrice",
      "sellingPrice",
      "minStock",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

