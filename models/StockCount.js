import mongoose from "mongoose";

const countItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    systemQuantity: {
      type: Number,
      required: true,
    },
    countedQuantity: {
      type: Number,
      min: 0,
      default: null,
    },
  },
  { _id: false },
);

const stockCountSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    countType: {
      type: String,
      enum: ["opening", "closing", "spot"],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    items: [countItemSchema],
    closedAt: Date,
    startedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  { timestamps: true },
);

export default mongoose.model("StockCount", stockCountSchema);