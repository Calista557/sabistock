import Order from "../models/Order.js";

export const getCustomerDebtTotals = async (req, res) => {
  try {
    const totals = await Order.aggregate([
      {
        $match: {
          paymentMethod: "credit",
          $expr: {
            $gt: [
              { $subtract: ["$total", "$amountPaid"] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$customer",
          totalDebt: {
            $sum: {
              $subtract: ["$total", "$amountPaid"],
            },
          },
          orders: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: "$customer",
      },
      {
        $project: {
          _id: 0,
          customerId: "$customer._id",
          customerName: "$customer.name",
          customerPhone: "$customer.phone",
          totalDebt: 1,
          orders: 1,
        },
      },
      {
        $sort: {
          customerName: 1,
        },
      },
    ]);

    res.json(totals);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch customer debt totals",
    });
  }
};