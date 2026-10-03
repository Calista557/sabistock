import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import Order from "../models/Order.js";
import Customer from "../models/Customer.js";
import { allocateStock } from "../utils/allocateStock.js";

// Cost price is only for owners and managers. Everyone else gets items without it.
const hideCostFor = (order, role) => {
  const obj = typeof order.toObject === "function" ? order.toObject() : order;
  if (role !== "owner" && role !== "manager") {
    obj.items = obj.items.map(({ costPrice, ...rest }) => rest);
  }
  return obj;
};

export const createOrder = async (req, res) => {
  try {
    const { items, paymentMethod, clientId, amountPaid, customerId, customerName, customerPhone, dueDate } = req.body;

    if (clientId) {
      const existing = await Order.findOne({ clientId });
      if (existing) {
        return res.status(200).json(hideCostFor(existing, req.employee.role));
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

    // Decide where each product's stock comes from. Check everything before saving anything.
    const allocationsByProduct = new Map();
    for (const product of products) {
      const qty = wanted.get(product._id.toString());
      const { allocations, shortBy } = await allocateStock(product._id, qty);
      if (shortBy > 0) {
        return res.status(400).json({
          message: `Not enough stock for ${product.name}. Available: ${qty - shortBy}`,
        });
      }
      allocationsByProduct.set(product._id.toString(), allocations);
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
      const saleMovements = orderItems.flatMap((item) =>
        allocationsByProduct.get(item.product.toString()).map((a) => ({
          product: item.product,
          type: "sale",
          quantity: -a.quantity,
          batch: a.batch || undefined,
          note: `Order ${order._id}`,
          recordedBy: req.employee._id,
          order: order._id,
        })),
      );
      await StockMovement.insertMany(saleMovements);
    } catch (err) {
      await Order.findByIdAndDelete(order._id);
      throw err;
    }

    res.status(201).json(hideCostFor(order, req.employee.role));
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

    const order = await Order.findById(id)
      .populate("servedBy", "name role")
      .populate("customer", "name phone email address");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(hideCostFor(order, req.employee.role));
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

    res.json({
      ...hideCostFor(order, req.employee.role),
      balance: order.total - order.amountPaid,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const voidOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        message: "A reason is required when voiding an order",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "voided") {
      return res.status(400).json({
        message: "Order is already voided",
      });
    }

    // Reverse the order's own sale movements, keeping the same product and batch
    const saleMovements = await StockMovement.find({
      order: order._id,
      type: "sale",
    });

    if (saleMovements.length === 0) {
      return res.status(400).json({
        message: "No sale movements found for this order, so it cannot be voided safely",
      });
    }

    await StockMovement.insertMany(
      saleMovements.map((m) => ({
        product: m.product,
        type: "adjustment",
        quantity: -m.quantity,
        batch: m.batch || undefined,
        note: `Void order ${order._id}: ${reason.trim()}`,
        recordedBy: req.employee._id,
        order: order._id,
      })),
    );

    order.status = "voided";
    order.voidedAt = new Date();
    order.voidedBy = req.employee._id;
    order.voidReason = reason.trim();

    await order.save();

    res.json(hideCostFor(order, req.employee.role));
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("servedBy", "name role")
      .populate("customer", "name phone email address")
      .sort({ createdAt: -1 });

    res.json(
      orders.map((order) =>
        hideCostFor(order, req.employee.role),
      ),
    );
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

export const getDailySalesSummary = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        message: "Date is required in YYYY-MM-DD format",
      });
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
      return res.status(400).json({
        message: "Invalid date. Use YYYY-MM-DD format",
      });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    // Validate that the date actually exists.
    const check = new Date(Date.UTC(year, month - 1, day));

    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return res.status(400).json({
        message: "Invalid date",
      });
    }

    // Nigeria is UTC+1.
    // Local midnight in Nigeria = 23:00 UTC on the previous day.
    const start = new Date(
      Date.UTC(year, month - 1, day, -1, 0, 0, 0),
    );

    const end = new Date(
      Date.UTC(year, month - 1, day + 1, -1, 0, 0, 0),
    );

    // -------------------------
    // 1. SALES
    // -------------------------

    const salesResult = await Order.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: {
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          numberOfSales: { $sum: 1 },
        },
      },
    ]);

    const sales = salesResult[0] || {
      totalSales: 0,
      numberOfSales: 0,
    };

    // -------------------------
    // 2. COLLECTIONS
    // -------------------------
    // Collections are based on when money was actually received,
    // not when the order was created.

    const collectionsResult = await Order.aggregate([
    {
     $match: {
      status: "completed",
      "payments.paidAt": {
      $gte: start,
      $lt: end,
    },
   },
  },
      {
        $unwind: "$payments",
      },
      {
        $match: {
          "payments.paidAt": {
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $group: {
          _id: "$payments.method",
          total: { $sum: "$payments.amount" },
        },
      },
    ]);

    const collections = {
      cash: 0,
      transfer: 0,
      card: 0,
    };

    for (const item of collectionsResult) {
      if (item._id in collections) {
        collections[item._id] = item.total;
      }
    }

    const totalCollections =
      collections.cash +
      collections.transfer +
      collections.card;

    // -------------------------
    // 3. RESPONSE
    // -------------------------

    res.json({
      date,
      sales: {
        total: sales.totalSales,
        numberOfSales: sales.numberOfSales,
      },
      collections: {
        total: totalCollections,
        cash: collections.cash,
        transfer: collections.transfer,
        card: collections.card,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};


export const getProfitReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        message: "Both from and to dates are required in YYYY-MM-DD format",
      });
    }

    const fromMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
    const toMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);

    if (!fromMatch || !toMatch) {
      return res.status(400).json({
        message: "Invalid date. Use YYYY-MM-DD format",
      });
    }

    const fromYear = Number(fromMatch[1]);
    const fromMonth = Number(fromMatch[2]);
    const fromDay = Number(fromMatch[3]);

    const toYear = Number(toMatch[1]);
    const toMonth = Number(toMatch[2]);
    const toDay = Number(toMatch[3]);

    const fromCheck = new Date(
      Date.UTC(fromYear, fromMonth - 1, fromDay),
    );

    const toCheck = new Date(
      Date.UTC(toYear, toMonth - 1, toDay),
    );

    if (
      fromCheck.getUTCFullYear() !== fromYear ||
      fromCheck.getUTCMonth() !== fromMonth - 1 ||
      fromCheck.getUTCDate() !== fromDay ||
      toCheck.getUTCFullYear() !== toYear ||
      toCheck.getUTCMonth() !== toMonth - 1 ||
      toCheck.getUTCDate() !== toDay
    ) {
      return res.status(400).json({
        message: "Invalid date",
      });
    }

    if (from > to) {
      return res.status(400).json({
        message: "The from date cannot be after the to date",
      });
    }

    // Nigeria is UTC+1.
    const start = new Date(
      Date.UTC(fromYear, fromMonth - 1, fromDay, -1, 0, 0, 0),
    );

    const end = new Date(
      Date.UTC(toYear, toMonth - 1, toDay + 1, -1, 0, 0, 0),
    );

    const result = await Order.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: {
            $gte: start,
            $lt: end,
          },
        },
      },
      {
        $unwind: "$items",
      },
      {
        $group: {
          _id: null,
          sales: {
            $sum: "$items.lineTotal",
          },
          cost: {
            $sum: {
              $multiply: [
                "$items.costPrice",
                "$items.quantity",
              ],
            },
          },
          numberOfSales: {
            $addToSet: "$_id",
          },
        },
      },
    ]);

    const report = result[0] || {
      sales: 0,
      cost: 0,
      numberOfSales: [],
    };

    const grossProfit = report.sales - report.cost;

    res.json({
      from,
      to,
      sales: report.sales,
      cost: report.cost,
      grossProfit,
      numberOfSales: report.numberOfSales.length,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

