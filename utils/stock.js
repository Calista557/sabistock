import mongoose from "mongoose";
import StockMovement from "../models/StockMovement.js";

export const getCurrentStock = async (productId) => {
  const result = await StockMovement.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]);

  return result.length > 0 ? result[0].total : 0;
};
