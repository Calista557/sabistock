import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import StockCount from "../models/StockCount.js";

export const startCount = async (req, res) => {
  try {
    const { title, countType } = req.body;

    const existing = await StockCount.findOne({ status: "open" });
    if (existing) {
      return res.status(400).json({
        message: "A count is already open. Close it before starting a new one.",
        countId: existing._id,
      });
    }

    const products = await Product.find().sort({ name: 1 });
    if (products.length === 0) {
      return res.status(400).json({ message: "No products to count" });
    }

    const totals = await StockMovement.aggregate([
      { $group: { _id: "$product", total: { $sum: "$quantity" } } },
    ]);

    const stockById = {};
    totals.forEach((item) => {
      stockById[item._id.toString()] = item.total;
    });

    const items = products.map((product) => ({
      product: product._id,
      systemQuantity: stockById[product._id.toString()] || 0,
    }));

    const count = await StockCount.create({ title, countType, items, startedBy: req.employee._id });


    res.status(201).json(count);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const enterCounts = async (req, res) => {
  try {
    const { id } = req.params;
    const { counts } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid count id" });
    }

    if (!Array.isArray(counts) || counts.length === 0) {
      return res.status(400).json({ message: "Provide a list of counts" });
    }

    const count = await StockCount.findById(id);
    if (!count) {
      return res.status(404).json({ message: "Count not found" });
    }

    if (count.status !== "open") {
      return res.status(400).json({ message: "This count is already closed" });
    }

    // Validate everything first, so a bad entry saves nothing
    for (const entry of counts) {
      if (!mongoose.isValidObjectId(entry.product)) {
        return res.status(400).json({ message: "Invalid product id in counts" });
      }

      if (!Number.isInteger(entry.countedQuantity) || entry.countedQuantity < 0) {
        return res.status(400).json({
          message: "Counted quantity must be a whole number, zero or more",
        });
      }

      const found = count.items.find(
        (item) => item.product.toString() === entry.product,
      );
      if (!found) {
        return res.status(400).json({
          message: `Product ${entry.product} is not part of this count`,
        });
      }
    }

    // Then apply
    for (const entry of counts) {
      const item = count.items.find(
        (item) => item.product.toString() === entry.product,
      );
      item.countedQuantity = entry.countedQuantity;
    }

    await count.save();

    res.json({ message: "Counts saved", countId: count._id });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getCount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid count id" });
    }

    const count = await StockCount.findById(id).populate(
      "items.product",
      "name barcode",
    );
    if (!count) {
      return res.status(404).json({ message: "Count not found" });
    }

    const items = count.items.map((item) => ({
      product: item.product,
      systemQuantity: item.systemQuantity,
      countedQuantity: item.countedQuantity,
      variance:
        item.countedQuantity === null
          ? null
          : item.countedQuantity - item.systemQuantity,
    }));

    const counted = items.filter((i) => i.countedQuantity !== null).length;

    res.json({
      _id: count._id,
      title: count.title,
      countType: count.countType,
      status: count.status,
      counted,
      total: items.length,
      items,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const closeCount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid count id" });
    }

    const count = await StockCount.findById(id);
    if (!count) {
      return res.status(404).json({ message: "Count not found" });
    }

    if (count.status !== "open") {
      return res.status(400).json({ message: "This count is already closed" });
    }

    const countedItems = count.items.filter(
      (item) => item.countedQuantity !== null,
    );

    if (countedItems.length === 0) {
      return res
        .status(400)
        .json({ message: "Enter at least one counted quantity before closing" });
    }

    const totals = await StockMovement.aggregate([
      {
        $match: { product: { $in: countedItems.map((item) => item.product) } },
      },
      { $group: { _id: "$product", total: { $sum: "$quantity" } } },
    ]);

    const liveById = {};
    totals.forEach((item) => {
      liveById[item._id.toString()] = item.total;
    });

    const adjustments = [];
    countedItems.forEach((item) => {
      const live = liveById[item.product.toString()] || 0;
      const variance = item.countedQuantity - live;

      if (variance !== 0) {
        adjustments.push({
          product: item.product,
          type: "adjustment",
          quantity: variance,
          note: `${count.title}: counted ${item.countedQuantity}, system had ${live}`,
          stockCount: count._id,
          recordedBy: req.employee._id,
        });
      }
    });

    if (adjustments.length > 0) {
      await StockMovement.insertMany(adjustments);
    }

    count.status = "closed";
    count.closedAt = new Date();
    count.closedBy = req.employee._id;
    await count.save();

    res.json({
      message: "Count closed",
      countId: count._id,
      productsCounted: countedItems.length,
      productsNotCounted: count.items.length - countedItems.length,
      adjustmentsMade: adjustments.length,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};