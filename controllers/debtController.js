import Order from "../models/Order.js";

export const getDebts = async (req, res) => {
  try {
   const orders = await Order.find({
  paymentMethod: "credit",
  $expr: {
    $lt: ["$amountPaid", "$total"],
  },
})
  .populate("servedBy", "name")
  .sort({ dueDate: 1 });

    const debts = orders.map((order) => {
      const balance = order.total - order.amountPaid;

      let status = "part-paid";

    if (order.amountPaid === 0) {
    status = "unpaid";
    }

    if (order.amountPaid < order.total && order.dueDate && order.dueDate < new Date()) {
     status = "overdue";
    }

      return {
        _id: order._id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        total: order.total,
        amountPaid: order.amountPaid,
        balance,
        dueDate: order.dueDate,
        status,
        servedBy: order.servedBy,
        createdAt: order.createdAt,
      };
    });

    res.json(debts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch debts" });
  }
};