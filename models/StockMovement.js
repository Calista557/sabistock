import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: {
      type: String,
      enum: ["opening", "purchase", "sale", "return", "adjustment"],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => value !== 0,
        message: "Quantity cannot be zero",
      },
    },
    note: {
      type: String,
      trim: true,
    },
    stockCount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StockCount",
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  { timestamps: true },
);

stockMovementSchema.pre("validate", function () {
  const incoming = ["opening", "purchase", "return"];

  if (incoming.includes(this.type) && this.quantity < 0) {
    this.invalidate("quantity", `${this.type} quantity must be positive`);
  }

  if (this.type === "sale" && this.quantity > 0) {
    this.invalidate("quantity", "Sale quantity must be negative");
  }
});

export default mongoose.model("StockMovement", stockMovementSchema);
