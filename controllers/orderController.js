import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import Order from "../models/Order.js";

export const createOrder = async (req, res) => {
  try {
    const { items, paymentMethod, clientId } = req.body;

    if (clientId) {
      const existing = await Order.findOne({ clientId });
      if (existing) {
        return res.status(200).json(existing);
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "An order needs at least one item" });
    }

    if (!["cash", "transfer", "card"].includes(paymentMethod)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    // Validate each line and merge repeated products
    const wanted = new Map();
    for (const line of items) {
      if (!mongoose.isValidObjectId(line.product)) {
        return res.status(400).json({ message: "Invalid product id in items" });
      }
      if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
        return res
          .status(400)
          .json({ message: "Each quantity must be a positive whole number" });
      }
      const key = String(line.product);
      wanted.set(key, (wanted.get(key) || 0) + line.quantity);
    }

    const productIds = [...wanted.keys()].map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== wanted.size) {
      return res.status(404).json({ message: "One or more products not found" });
    }

    const totals = await StockMovement.aggregate([
      { $match: { product: { $in: productIds } } },
      { $group: { _id: "$product", total: { $sum: "$quantity" } } },
    ]);

    const stockById = {};
    totals.forEach((t) => {
      stockById[t._id.toString()] = t.total;
    });

    // Check all stock before saving anything
    for (const product of products) {
      const available = stockById[product._id.toString()] || 0;
      const qty = wanted.get(product._id.toString());
      if (qty > available) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}. Available: ${available}`,
        });
      }
    }

    const orderItems = products.map((product) => {
      const quantity = wanted.get(product._id.toString());
      return {
        product: product._id,
        name: product.name,
        quantity,
        unitPrice: product.sellingPrice,
        lineTotal: quantity * product.sellingPrice,
      };
    });

    const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

    const order = await Order.create({
      items: orderItems,
      total,
      paymentMethod,
      servedBy: req.employee._id,
      clientId,
    });

    try {
      await StockMovement.insertMany(
        orderItems.map((item) => ({
          product: item.product,
          type: "sale",
          quantity: -item.quantity,
          note: `Order ${order._id}`,
          recordedBy: req.employee._id,
          order: order._id,
        })),
      );
    } catch (err) {
      await Order.findByIdAndDelete(order._id);
      throw err;
    }

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(id).populate("servedBy", "name role");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};