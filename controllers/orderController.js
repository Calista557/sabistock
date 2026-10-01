import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";

export const createOrder = async (req, res) => {
  try {
    const { items, paymentMethod, clientId, amountPaid, customerId, customerName, customerPhone, dueDate } = req.body;

    if (clientId) {
      const existing = await Order.findOne({ clientId });
      if (existing) {
        return res.status(200).json(existing);
      }
    }

    if (customerId) {
     if (!mongoose.isValidObjectId(customerId)) {
     return res.status(400).json({ message: "Invalid customer id" });
     }

  const customer = await Customer.findById(customerId);

     if (!customer) {
     return res.status(404).json({ message: "Customer not found" });
    }
}

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "An order needs at least one item" });
    }

       if (!["cash", "transfer", "card", "credit"].includes(paymentMethod)) {
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
        costPrice: product.costPrice,
        lineTotal: quantity * product.sellingPrice,
      };
    });

    const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

    const paid =
      amountPaid === undefined
        ? paymentMethod === "credit"
          ? 0
          : total
        : amountPaid;

    if (!Number.isInteger(paid) || paid < 0 || paid > total) {
      return res.status(400).json({
        message: "Amount paid must be a whole number from 0 up to the order total",
      });
    }

    if (paymentMethod === "credit" && paid !== 0) {
      return res
        .status(400)
        .json({ message: "A credit sale has nothing paid at the till" });
    }

    if (paymentMethod !== "credit" && paid === 0) {
      return res
        .status(400)
        .json({ message: "Use credit when nothing is paid" });
    }

    let due;
    if (paid < total) {
      if (!customerName || !customerName.trim()) {
        return res.status(400).json({
          message: "Customer name is required when the order is not fully paid",
        });
      }
      due = new Date(dueDate);
      if (!dueDate || Number.isNaN(due.getTime())) {
        return res.status(400).json({
          message: "A valid due date is required when the order is not fully paid",
        });
      }
    }

     const order = await Order.create({
      items: orderItems,
      total,
      paymentMethod,
      servedBy: req.employee._id,
      amountPaid: paid,
      customer: customerId,
      customerName,
      customerPhone,
      dueDate: due,
      payments:
        paid > 0
          ? [
              {
                amount: paid,
                method: paymentMethod,
                receivedBy: req.employee._id,
              },
            ]
          : [],
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

    const order = await Order.findById(id).populate("servedBy", "name role").populate("customer", "name phone email address");;
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ message: "Amount must be a positive whole number" });
    }

    if (!["cash", "transfer", "card"].includes(method)) {
      return res.status(400).json({ message: "Invalid payment method" });
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: id,
        $expr: {
          $lte: [
            { $add: [{ $ifNull: ["$amountPaid", "$total"] }, amount] },
            "$total",
          ],
        },
      },
      {
        $inc: { amountPaid: amount },
        $push: {
          payments: {
            amount,
            method,
            receivedBy: req.employee._id,
            paidAt: new Date(),
          },
        },
      },
      { new: true },
    );

    if (!order) {
      const exists = await Order.findById(id);
      if (!exists) {
        return res.status(404).json({ message: "Order not found" });
      }
      return res.status(400).json({
        message:
          "Amount is more than the balance owed, or the order is already fully paid",
      });
    }

    res.json({ ...order.toObject(), balance: order.total - order.amountPaid });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};